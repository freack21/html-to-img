import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

export function loadConfig(env = process.env) {
  const dataDir = path.resolve(ROOT, env.DATA_DIR || "data");
  return {
    port: Number(env.PORT || 3003),
    host: env.HOST || "127.0.0.1",
    isProduction: env.NODE_ENV === "production",
    // Express "trust proxy" setting; "loopback" fits Nginx on the same host.
    trustProxy: env.TRUST_PROXY || "loopback",
    publicUrl: (env.PUBLIC_URL || "").replace(/\/+$/, ""),
    databasePath: env.DATABASE_PATH ? path.resolve(ROOT, env.DATABASE_PATH) : path.join(dataDir, "app.db"),
    storageDir: env.STORAGE_DIR ? path.resolve(ROOT, env.STORAGE_DIR) : path.join(dataDir, "storage"),
    webDistDir: path.join(ROOT, "web/dist"),
    templatesDir: path.join(ROOT, "server/templates"),
    emojiBaseUrl: env.EMOJI_BASE_URL ?? "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/",
    images: {
      maxBytes: Number(env.MAX_IMAGE_BYTES || 5 * 1024 * 1024),
      timeoutMs: Number(env.IMAGE_TIMEOUT_MS || 5000),
      allowPrivate: env.ALLOW_PRIVATE_IMAGE_HOSTS === "true",
    },
  };
}
