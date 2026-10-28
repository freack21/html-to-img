import fs from "node:fs";
import path from "node:path";
import { createPlan } from "../services/plans.js";
import { createTemplate } from "../services/templates.js";

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

/** Inserts default plans and bundled templates into an empty database. */
export function seed(db, { templatesDir }) {
  if (!db.prepare("SELECT 1 FROM plans LIMIT 1").get()) {
    for (const plan of PLANS) createPlan(db, plan);
  }
  if (!db.prepare("SELECT 1 FROM templates LIMIT 1").get()) {
    for (const file of fs.readdirSync(templatesDir).filter((f) => f.endsWith(".json")).sort()) {
      createTemplate(db, JSON.parse(fs.readFileSync(path.join(templatesDir, file), "utf8")));
    }
  }
}
