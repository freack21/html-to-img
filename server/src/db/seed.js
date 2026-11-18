import fs from "node:fs";
import path from "node:path";
import { createPlan } from "../services/plans.js";
import { createTemplate, getTemplateBySlug } from "../services/templates.js";
import { now, transaction } from "./index.js";

const PLANS = [
  {
    slug: "free",
    name: "Free",
    description: "For trying things out and personal projects.",
    price: 0,
    monthlyQuota: 100,
    maxScale: 1,
    retentionHours: 24,
    watermark: false,
    apiAccess: true,
    premiumTemplates: false,
    isDefault: true,
    sortOrder: 0,
  },
  {
    slug: "pro",
    name: "Pro",
    description: "For creators and bots that render every day.",
    price: 49000,
    monthlyQuota: 2000,
    maxScale: 2,
    retentionHours: 72,
    premiumTemplates: true,
    sortOrder: 1,
  },
  {
    slug: "business",
    name: "Business",
    description: "High volume rendering with long file retention.",
    price: 149000,
    monthlyQuota: 10000,
    maxScale: 3,
    retentionHours: 168,
    premiumTemplates: true,
    sortOrder: 2,
  },
];

/**
 * Inserts default plans into an empty database, and every bundled template this
 * database hasn't been offered yet (so new releases ship new templates, while
 * templates an admin deleted or replaced are left alone).
 */
export function seed(db, { templatesDir }) {
  if (!db.prepare("SELECT 1 FROM plans LIMIT 1").get()) {
    for (const plan of PLANS) createPlan(db, plan);
  }
  const seeded = new Set(db.prepare("SELECT slug FROM seeded_templates").all().map((r) => r.slug));
  const mark = db.prepare("INSERT INTO seeded_templates (slug, seeded_at) VALUES (?, ?)");
  const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith(".json")).sort();
  transaction(db, () => {
    for (const file of files) {
      const template = JSON.parse(fs.readFileSync(path.join(templatesDir, file), "utf8"));
      if (seeded.has(template.slug)) continue;
      // An admin may already have created a template with this slug: keep theirs.
      if (!getTemplateBySlug(db, template.slug)) createTemplate(db, template);
      mark.run(template.slug, now());
    }
  });
}
