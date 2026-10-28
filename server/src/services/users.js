import { z } from "zod";
import { DUMMY_HASH, hashPassword, randomToken, sha256, verifyPassword } from "../auth/crypto.js";
import { now, transaction } from "../db/index.js";
import { HttpError, ValidationError, zodDetails } from "../lib/errors.js";
import { getDefaultPlan, getPlan, toPlan } from "./plans.js";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_API_KEYS = 10;
export const SESSION_PREFIX = "hts_";
export const API_KEY_PREFIX = "hti_";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8, "Password must be at least 8 characters").max(200);
const name = z.string().trim().min(1).max(80);

export const registerSchema = z.object({ email, password, name });
export const loginSchema = z.object({ email, password: z.string().min(1).max(200) });
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: password });
export const adminUserPatchSchema = z
  .object({
    name,
    role: z.enum(["user", "admin"]),
    status: z.enum(["active", "disabled"]),
    planId: z.number().int().positive(),
  })
  .partial()
  .strict();

export function parse(schema, input) {
  const result = schema.safeParse(input ?? {});
  if (!result.success) throw new ValidationError("Invalid request", zodDetails(result.error));
  return result.data;
}

export function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    planId: row.plan_id,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export function getUser(db, id) {
  return toUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

export async function createUser(db, input, { role = "user" } = {}) {
  const data = parse(registerSchema, input);
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(data.email)) {
    throw new HttpError(409, "Email is already registered", { code: "email_taken" });
  }
  const plan = getDefaultPlan(db);
  if (!plan) throw new HttpError(500, "No default plan configured");
  const hash = await hashPassword(data.password);
  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (email, name, password_hash, role, plan_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(data.email, data.name, hash, role, plan.id, now());
  return getUser(db, lastInsertRowid);
}

/** Returns the user for valid credentials, or throws 401 without revealing which part was wrong. */
export async function verifyCredentials(db, input) {
  const data = parse(loginSchema, input);
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(data.email);
  const ok = await verifyPassword(data.password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) throw new HttpError(401, "Invalid email or password", { code: "invalid_credentials" });
  if (row.status !== "active") throw new HttpError(403, "This account is disabled", { code: "account_disabled" });
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now(), row.id);
  return toUser(row);
}

export async function changePassword(db, userId, input) {
  const data = parse(passwordChangeSchema, input);
  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId);
  if (!(await verifyPassword(data.currentPassword, row.password_hash))) {
    throw new HttpError(400, "Current password is incorrect", { code: "invalid_password" });
  }
  const hash = await hashPassword(data.newPassword);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
}

export function setPassword(db, userId, hash) {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
}

// Sessions ------------------------------------------------------------------

export function createSession(db, userId, { ip, userAgent } = {}) {
  const token = randomToken(SESSION_PREFIX);
  const created = new Date();
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, ip, user_agent, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(sha256(token), userId, ip ?? null, (userAgent ?? "").slice(0, 300), created.toISOString(), new Date(created.getTime() + SESSION_TTL_MS).toISOString());
  return token;
}

export function deleteSession(db, token) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

export function deleteUserSessions(db, userId) {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

const PRINCIPAL_SQL = `
  SELECT u.*, p.id AS p_id, p.slug AS p_slug, p.name AS p_name, p.description AS p_description, p.price AS p_price,
         p.monthly_quota AS p_monthly_quota, p.max_scale AS p_max_scale, p.retention_hours AS p_retention_hours,
         p.watermark AS p_watermark, p.api_access AS p_api_access, p.premium_templates AS p_premium_templates,
         p.is_default AS p_is_default, p.is_active AS p_is_active, p.sort_order AS p_sort_order`;

function toPrincipal(row) {
  if (!row || row.status !== "active") return null;
  const planRow = Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => key.startsWith("p_"))
      .map(([key, value]) => [key.slice(2), value]),
  );
  return { user: toUser(row), plan: toPlan(planRow) };
}

export function resolveSession(db, token) {
  const row = db
    .prepare(
      `${PRINCIPAL_SQL} FROM sessions s JOIN users u ON u.id = s.user_id JOIN plans p ON p.id = u.plan_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), now());
  return toPrincipal(row);
}

// API keys ------------------------------------------------------------------

function toApiKey(row) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

export function listApiKeys(db, userId) {
  return db.prepare("SELECT * FROM api_keys WHERE user_id = ? ORDER BY id DESC").all(userId).map(toApiKey);
}

export function createApiKey(db, userId, input) {
  const { name: keyName } = parse(z.object({ name: z.string().trim().min(1).max(60) }), input);
  return transaction(db, () => {
    const { count } = db
      .prepare("SELECT COUNT(*) AS count FROM api_keys WHERE user_id = ? AND revoked_at IS NULL")
      .get(userId);
    if (count >= MAX_API_KEYS) throw new HttpError(409, `You can have at most ${MAX_API_KEYS} active API keys`);
    const key = randomToken(API_KEY_PREFIX);
    const { lastInsertRowid } = db
      .prepare("INSERT INTO api_keys (user_id, name, prefix, key_hash, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(userId, keyName, key.slice(0, 12), sha256(key), now());
    const apiKey = toApiKey(db.prepare("SELECT * FROM api_keys WHERE id = ?").get(lastInsertRowid));
    return { key, apiKey };
  });
}

export function revokeApiKey(db, userId, id) {
  const { changes } = db
    .prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL")
    .run(now(), id, userId);
  if (!changes) throw new HttpError(404, "API key not found");
}

export function resolveApiKey(db, key) {
  const row = db
    .prepare(
      `${PRINCIPAL_SQL}, k.id AS key_id FROM api_keys k JOIN users u ON u.id = k.user_id JOIN plans p ON p.id = u.plan_id
       WHERE k.key_hash = ? AND k.revoked_at IS NULL`,
    )
    .get(sha256(key));
  const principal = toPrincipal(row);
  if (!principal) return null;
  db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(now(), row.key_id);
  return { ...principal, apiKeyId: row.key_id };
}

// Admin -----------------------------------------------------------------------

export function listUsers(db, { q = "", page = 1, pageSize = 25 } = {}) {
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const where = "WHERE u.email LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\'";
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM users u ${where}`).get(like, like);
  const rows = db
    .prepare(
      `SELECT u.*, p.name AS plan_name FROM users u JOIN plans p ON p.id = u.plan_id ${where}
       ORDER BY u.id DESC LIMIT ? OFFSET ?`,
    )
    .all(like, like, pageSize, (page - 1) * pageSize);
  return { total, page, pageSize, items: rows.map((row) => ({ ...toUser(row), planName: row.plan_name })) };
}

export function updateUserAsAdmin(db, actorId, id, input) {
  const data = parse(adminUserPatchSchema, input);
  const user = getUser(db, id);
  if (!user) throw new HttpError(404, "User not found");
  if (id === actorId && (data.role === "user" || data.status === "disabled")) {
    throw new HttpError(409, "You cannot demote or disable your own account");
  }
  if (data.planId !== undefined && !getPlan(db, data.planId)) throw new ValidationError("Plan does not exist");
  const columns = { name: "name", role: "role", status: "status", planId: "plan_id" };
  const entries = Object.entries(data);
  if (entries.length) {
    db.prepare(`UPDATE users SET ${entries.map(([k]) => `${columns[k]} = ?`).join(", ")} WHERE id = ?`).run(
      ...entries.map(([, v]) => v),
      id,
    );
  }
  if (data.status === "disabled") deleteUserSessions(db, id);
  return getUser(db, id);
}
