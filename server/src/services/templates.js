import { now } from "../db/index.js";
import { parseDefinition, parseTemplateMeta } from "../engine/index.js";
import { HttpError } from "../lib/errors.js";

function toTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    isActive: Boolean(row.is_active),
    isPremium: Boolean(row.is_premium),
    version: row.version,
    definition: JSON.parse(row.definition),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Public view: params and size only, no layout tree. */
export function publicTemplate(t) {
  return {
    slug: t.slug,
    name: t.name,
    description: t.description,
    category: t.category,
    isPremium: t.isPremium,
    version: t.version,
    width: t.definition.width,
    height: t.definition.height ?? null,
    params: t.definition.params,
  };
}

export function listTemplates(db, { activeOnly = false } = {}) {
  const where = activeOnly ? "WHERE is_active = 1" : "";
  return db.prepare(`SELECT * FROM templates ${where} ORDER BY category, name`).all().map(toTemplate);
}

export function getTemplate(db, id) {
  return toTemplate(db.prepare("SELECT * FROM templates WHERE id = ?").get(id));
}

export function getTemplateBySlug(db, slug) {
  return toTemplate(db.prepare("SELECT * FROM templates WHERE slug = ?").get(slug));
}

function assertSlugFree(db, slug, exceptId = 0) {
  if (db.prepare("SELECT 1 FROM templates WHERE slug = ? AND id != ?").get(slug, exceptId)) {
    throw new HttpError(409, `Template slug "${slug}" is already used`);
  }
}

export function createTemplate(db, { definition, ...meta }) {
  const data = parseTemplateMeta(meta);
  const def = parseDefinition(definition);
  assertSlugFree(db, data.slug);
  const ts = now();
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO templates (slug, name, description, category, is_active, is_premium, definition, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(data.slug, data.name, data.description, data.category, Number(data.isActive), Number(data.isPremium), JSON.stringify(def), ts, ts);
  return getTemplate(db, lastInsertRowid);
}

export function updateTemplate(db, id, { definition, ...meta }) {
  const existing = getTemplate(db, id);
  if (!existing) throw new HttpError(404, "Template not found");
  const data = parseTemplateMeta(meta, { partial: true });
  if (data.slug) assertSlugFree(db, data.slug, id);
  const next = { ...existing, ...data };
  const def = definition === undefined ? existing.definition : parseDefinition(definition);
  // Bump the version on any change that alters rendered output.
  const version = definition === undefined ? existing.version : existing.version + 1;
  db.prepare(
    `UPDATE templates SET slug = ?, name = ?, description = ?, category = ?, is_active = ?, is_premium = ?,
       definition = ?, version = ?, updated_at = ? WHERE id = ?`,
  ).run(next.slug, next.name, next.description, next.category, Number(next.isActive), Number(next.isPremium), JSON.stringify(def), version, now(), id);
  return getTemplate(db, id);
}

export function deleteTemplate(db, id) {
  const { changes } = db.prepare("DELETE FROM templates WHERE id = ?").run(id);
  if (!changes) throw new HttpError(404, "Template not found");
}
