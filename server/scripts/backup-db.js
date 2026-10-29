// Writes a consistent online backup of the SQLite database and prunes old ones.
// Usage: npm run backup-db [-- --keep 14]
// Backups go to <DATA_DIR>/backups/app-YYYY-MM-DDTHH-MM-SS.db. Copy them off the server too:
// they share the disk (and the Docker volume) with the live database.
import fs from "node:fs";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";
import { loadConfig } from "../src/config.js";

const { values } = parseArgs({ options: { keep: { type: "string", default: "14" } } });
const keep = Number(values.keep);
if (!Number.isInteger(keep) || keep < 1) {
  console.error("--keep must be a positive integer");
  process.exit(1);
}

const { databasePath } = loadConfig();
if (!fs.existsSync(databasePath)) {
  console.error(`Database not found: ${databasePath}`);
  process.exit(1);
}

const dir = path.join(path.dirname(databasePath), "backups");
fs.mkdirSync(dir, { recursive: true });
const target = path.join(dir, `app-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.db`);

const db = new DatabaseSync(databasePath, { readOnly: true });
try {
  await backup(db, target);
} finally {
  db.close();
}
console.log(`Backup written: ${target} (${fs.statSync(target).size} bytes)`);

const old = fs
  .readdirSync(dir)
  .filter((f) => /^app-[\dT-]+\.db$/.test(f))
  .sort()
  .reverse()
  .slice(keep);
for (const file of old) {
  fs.unlinkSync(path.join(dir, file));
  console.log(`Pruned ${file}`);
}
