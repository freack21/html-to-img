import { now } from "../db/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** What a caller is allowed to do: guests use admin settings, users use their plan. */
export function policyFor(principal, settings) {
  if (!principal) {
    return {
      watermark: settings.guestWatermark ? settings.watermarkText : null,
      maxScale: settings.guestMaxScale,
      retentionHours: settings.guestRetentionHours,
      premiumTemplates: false,
    };
  }
  const { plan } = principal;
  return {
    watermark: plan.watermark ? settings.watermarkText : null,
    maxScale: plan.maxScale,
    retentionHours: plan.retentionHours,
    premiumTemplates: plan.premiumTemplates,
  };
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Guests: rolling 24h limit per IP. Users: calendar-month (UTC) quota from their plan.
 * `limit === null` means unlimited.
 */
export function usageFor(db, principal, ip, settings) {
  const current = new Date();
  if (!principal) {
    const since = new Date(current.getTime() - DAY_MS).toISOString();
    const { used } = db
      .prepare("SELECT COUNT(*) AS used FROM renders WHERE user_id IS NULL AND ip = ? AND created_at > ?")
      .get(ip, since);
    const limit = settings.guestDailyLimit;
    return { period: "day", limit, used, remaining: Math.max(0, limit - used), resetsAt: null };
  }
  const start = startOfMonth(current);
  const { used } = db
    .prepare("SELECT COUNT(*) AS used FROM renders WHERE user_id = ? AND created_at >= ?")
    .get(principal.user.id, start.toISOString());
  const limit = principal.plan.monthlyQuota;
  return {
    period: "month",
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resetsAt: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString(),
  };
}

export function recordRender(db, render) {
  db.prepare(
    `INSERT INTO renders (id, user_id, api_key_id, ip, template_slug, format, width, height, bytes, duration_ms,
       source, file_name, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    render.id,
    render.userId ?? null,
    render.apiKeyId ?? null,
    render.ip ?? null,
    render.templateSlug,
    render.format,
    render.width,
    render.height,
    render.bytes,
    render.durationMs,
    render.source,
    render.fileName ?? null,
    render.expiresAt ?? null,
    now(),
  );
}

export function listUserRenders(db, userId, { page = 1, pageSize = 20 } = {}) {
  const { total } = db.prepare("SELECT COUNT(*) AS total FROM renders WHERE user_id = ?").get(userId);
  const items = db
    .prepare(
      `SELECT id, template_slug, format, width, height, bytes, duration_ms, source, file_name, expires_at, created_at
       FROM renders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(userId, pageSize, (page - 1) * pageSize)
    .map((row) => ({
      id: row.id,
      template: row.template_slug,
      format: row.format,
      width: row.width,
      height: row.height,
      bytes: row.bytes,
      durationMs: row.duration_ms,
      source: row.source,
      url: row.file_name && row.expires_at > now() ? `/files/${row.file_name}` : null,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
  return { total, page, pageSize, items };
}

/** Deletes stored files past their retention and expired sessions. Safe to run repeatedly. */
export async function cleanupExpired(db, storage) {
  const ts = now();
  const expired = db
    .prepare("SELECT id, file_name FROM renders WHERE file_name IS NOT NULL AND expires_at <= ?")
    .all(ts);
  const clear = db.prepare("UPDATE renders SET file_name = NULL WHERE id = ?");
  for (const row of expired) {
    await storage.remove(row.file_name);
    clear.run(row.id);
  }
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(ts);
  return expired.length;
}

export function adminStats(db) {
  const since30 = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  return {
    users: one("SELECT COUNT(*) AS n FROM users").n,
    templates: one("SELECT COUNT(*) AS n FROM templates WHERE is_active = 1").n,
    rendersToday: one("SELECT COUNT(*) AS n FROM renders WHERE created_at >= ?", today).n,
    renders30d: one("SELECT COUNT(*) AS n FROM renders WHERE created_at >= ?", since30).n,
    guestRenders30d: one("SELECT COUNT(*) AS n FROM renders WHERE user_id IS NULL AND created_at >= ?", since30).n,
    avgDurationMs: Math.round(one("SELECT AVG(duration_ms) AS v FROM renders WHERE created_at >= ?", since30).v ?? 0),
    daily: db
      .prepare(
        `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS renders FROM renders
         WHERE created_at >= ? GROUP BY day ORDER BY day`,
      )
      .all(since30),
    topTemplates: db
      .prepare(
        `SELECT template_slug AS template, COUNT(*) AS renders FROM renders
         WHERE created_at >= ? GROUP BY template_slug ORDER BY renders DESC LIMIT 10`,
      )
      .all(since30),
    usersByPlan: db
      .prepare("SELECT p.name AS plan, COUNT(u.id) AS users FROM plans p LEFT JOIN users u ON u.plan_id = p.id GROUP BY p.id ORDER BY p.sort_order")
      .all(),
  };
}
