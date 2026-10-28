// Creates an admin account, or promotes an existing user to admin.
// Usage: npm run create-admin -- --email you@example.com [--name "Your Name"]
// The password is read from ADMIN_PASSWORD, or generated and printed once.
import crypto from "node:crypto";
import { parseArgs } from "node:util";
import { hashPassword } from "../src/auth/crypto.js";
import { loadConfig } from "../src/config.js";
import { openDatabase } from "../src/db/index.js";
import { seed } from "../src/db/seed.js";
import { createUser, setPassword } from "../src/services/users.js";

const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string", default: "Admin" } } });
if (!values.email) {
  console.error('Usage: npm run create-admin -- --email you@example.com [--name "Your Name"]');
  process.exit(1);
}

const config = loadConfig();
const db = openDatabase(config.databasePath);
seed(db, { templatesDir: config.templatesDir });

const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString("base64url");
const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(values.email.toLowerCase());
try {
  if (existing) {
    db.prepare("UPDATE users SET role = 'admin', status = 'active' WHERE id = ?").run(existing.id);
    if (process.env.ADMIN_PASSWORD) setPassword(db, existing.id, await hashPassword(password));
    console.log(`Promoted ${values.email} to admin${process.env.ADMIN_PASSWORD ? " and reset the password" : ""}.`);
  } else {
    await createUser(db, { email: values.email, name: values.name, password }, { role: "admin" });
    console.log(`Created admin ${values.email}`);
    if (!process.env.ADMIN_PASSWORD) console.log(`Generated password (shown once): ${password}`);
  }
} catch (err) {
  console.error(err.details ? `${err.message}: ${JSON.stringify(err.details)}` : err.message);
  process.exitCode = 1;
} finally {
  db.close();
}
