import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db/index.js";
import { seed } from "./db/seed.js";
import { createRenderer } from "./engine/index.js";
import { cleanupExpired } from "./services/renders.js";
import { ensureAdmin } from "./services/users.js";
import { createStorage } from "./services/storage.js";

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

const config = loadConfig();
const db = openDatabase(config.databasePath);
seed(db, { templatesDir: config.templatesDir });

try {
  const admin = await ensureAdmin(db, {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME,
  });
  if (admin) console.log(`Created admin account ${admin.email} from ADMIN_EMAIL`);
} catch (err) {
  // Keep serving; a bad ADMIN_* value should not take the site down.
  console.error("Could not create admin from ADMIN_EMAIL/ADMIN_PASSWORD:", err.message, err.details ?? "");
}

const storage = createStorage(config.storageDir);
const renderer = createRenderer({ images: config.images, emojiBaseUrl: config.emojiBaseUrl });
const app = createApp({ db, config, renderer, storage });

const runCleanup = () =>
  cleanupExpired(db, storage)
    .then((count) => count && console.log(`cleanup: removed ${count} expired file(s)`))
    .catch((err) => console.error("cleanup failed:", err));
runCleanup();
const cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);

const server = app.listen(config.port, config.host, () => {
  console.log(`html-to-img listening on http://${config.host}:${config.port}`);
});
server.on("error", (err) => {
  console.error("server error:", err);
  process.exit(1);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  clearInterval(cleanupTimer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
