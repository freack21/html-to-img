import { z } from "zod";
import { ValidationError, zodDetails } from "../lib/errors.js";
import { onlyProvided } from "../lib/patch.js";

export const settingsSchema = z.object({
  registrationOpen: z.boolean().default(true),
  guestDailyLimit: z.number().int().min(0).max(100000).default(10),
  guestWatermark: z.boolean().default(true),
  guestRetentionHours: z.number().int().min(1).max(720).default(1),
  guestMaxScale: z.number().int().min(1).max(4).default(1),
  watermarkText: z.string().trim().min(1).max(40).default("html-to-img"),
});

const DEFAULTS = settingsSchema.parse({});

export function getSettings(db) {
  const stored = Object.fromEntries(
    db
      .prepare("SELECT key, value FROM settings")
      .all()
      .filter((row) => Object.hasOwn(DEFAULTS, row.key))
      .map((row) => [row.key, JSON.parse(row.value)]),
  );
  return { ...DEFAULTS, ...stored };
}

export function updateSettings(db, patch) {
  const result = settingsSchema.partial().strict().safeParse(patch);
  if (!result.success) throw new ValidationError("Invalid settings", zodDetails(result.error));
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
  );
  for (const [key, value] of Object.entries(onlyProvided(result.data, patch))) upsert.run(key, JSON.stringify(value));
  return getSettings(db);
}
