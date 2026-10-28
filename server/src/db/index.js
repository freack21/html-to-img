import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const MIGRATIONS_DIR = path.join(import.meta.dirname, "migrations");

export function openDatabase(file) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

/** Applies `migrations/NNN_*.sql` files newer than PRAGMA user_version. */
function migrate(db) {
  const current = db.prepare("PRAGMA user_version").get().user_version;
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
  for (const file of files) {
    const version = Number.parseInt(file, 10);
    if (version <= current) continue;
    transaction(db, () => {
      db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
      db.exec(`PRAGMA user_version = ${version}`);
    });
  }
}

export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export const now = () => new Date().toISOString();
