import { z } from "zod";
import { transaction, now } from "../db/index.js";
import { HttpError, ValidationError, zodDetails } from "../lib/errors.js";
import { onlyProvided } from "../lib/patch.js";

export const planSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,29}$/, "Slug must be 2-30 chars of a-z, 0-9 and dashes"),
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).default(""),
  price: z.number().int().min(0).default(0),
  monthlyQuota: z.number().int().min(0).nullable().default(null),
  maxScale: z.number().int().min(1).max(4).default(1),
  retentionHours: z.number().int().min(1).max(8760).default(24),
  watermark: z.boolean().default(false),
  apiAccess: z.boolean().default(true),
  premiumTemplates: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const COLUMNS = {
  slug: "slug",
  name: "name",
  description: "description",
  price: "price",
  monthlyQuota: "monthly_quota",
  maxScale: "max_scale",
  retentionHours: "retention_hours",
  watermark: "watermark",
  apiAccess: "api_access",
  premiumTemplates: "premium_templates",
  isDefault: "is_default",
  isActive: "is_active",
  sortOrder: "sort_order",
};
const BOOLEAN_FIELDS = new Set(["watermark", "apiAccess", "premiumTemplates", "isDefault", "isActive"]);

export function toPlan(row) {
  if (!row) return null;
  const plan = { id: row.id };
  for (const [field, column] of Object.entries(COLUMNS)) {
    plan[field] = BOOLEAN_FIELDS.has(field) ? Boolean(row[column]) : row[column];
  }
  return plan;
}

function toRow(data) {
  const row = {};
  for (const [field, value] of Object.entries(data)) {
    row[COLUMNS[field]] = typeof value === "boolean" ? Number(value) : value;
  }
  return row;
}

function parse(input, partial) {
  const schema = partial ? planSchema.partial().strict() : planSchema.strict();
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError("Invalid plan", zodDetails(result.error));
  return partial ? onlyProvided(result.data, input) : result.data;
}

export function listPlans(db, { activeOnly = false } = {}) {
  const where = activeOnly ? "WHERE is_active = 1" : "";
  return db.prepare(`SELECT * FROM plans ${where} ORDER BY sort_order, price, id`).all().map(toPlan);
}

export function getPlan(db, id) {
  return toPlan(db.prepare("SELECT * FROM plans WHERE id = ?").get(id));
}

export function getDefaultPlan(db) {
  return toPlan(db.prepare("SELECT * FROM plans WHERE is_default = 1 ORDER BY id LIMIT 1").get());
}

function assertSlugFree(db, slug, exceptId = 0) {
  if (db.prepare("SELECT 1 FROM plans WHERE slug = ? AND id != ?").get(slug, exceptId)) {
    throw new HttpError(409, `Plan slug "${slug}" is already used`);
  }
}

export function createPlan(db, input) {
  const data = parse(input, false);
  assertSlugFree(db, data.slug);
  return transaction(db, () => {
    if (data.isDefault) db.exec("UPDATE plans SET is_default = 0");
    const row = { ...toRow(data), created_at: now() };
    const cols = Object.keys(row);
    const { lastInsertRowid } = db
      .prepare(`INSERT INTO plans (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
      .run(...Object.values(row));
    return getPlan(db, lastInsertRowid);
  });
}

export function updatePlan(db, id, input) {
  const existing = getPlan(db, id);
  if (!existing) throw new HttpError(404, "Plan not found");
  const data = parse(input, true);
  if (data.slug) assertSlugFree(db, data.slug, id);
  if (existing.isDefault && (data.isDefault === false || data.isActive === false)) {
    throw new HttpError(409, "Choose another default plan first");
  }
  return transaction(db, () => {
    if (data.isDefault) db.exec("UPDATE plans SET is_default = 0");
    const row = toRow(data);
    const cols = Object.keys(row);
    if (cols.length) {
      db.prepare(`UPDATE plans SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(...Object.values(row), id);
    }
    return getPlan(db, id);
  });
}

export function deletePlan(db, id) {
  const plan = getPlan(db, id);
  if (!plan) throw new HttpError(404, "Plan not found");
  if (plan.isDefault) throw new HttpError(409, "The default plan cannot be deleted");
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM users WHERE plan_id = ?").get(id);
  if (count > 0) throw new HttpError(409, `Plan still has ${count} user(s); move them to another plan first`);
  db.prepare("DELETE FROM plans WHERE id = ?").run(id);
}
