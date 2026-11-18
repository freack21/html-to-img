import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

/**
 * Trims trailing slashes, and drops the port from an https URL on the app's own port:
 * Coolify's SERVICE_URL_APP_3003 includes ":3003", but the app only speaks plain HTTP
 * there, so an https URL on that port is always the proxy's public origin.
 */
export function normalizePublicUrl(raw, port) {
  const value = (raw || "").trim().replace(/\/+$/, "");
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.port === String(port)) url.port = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return value;
  }
}

export function loadConfig(env = process.env) {
  const dataDir = path.resolve(ROOT, env.DATA_DIR || "data");
  return {
    port: Number(env.PORT || 3003),
    host: env.HOST || "127.0.0.1",
    isProduction: env.NODE_ENV === "production",
    // Express "trust proxy" setting; "loopback" fits Nginx on the same host.
    trustProxy: env.TRUST_PROXY || "loopback",
    publicUrl: normalizePublicUrl(env.PUBLIC_URL, env.PORT || "3003"),
    databasePath: env.DATABASE_PATH ? path.resolve(ROOT, env.DATABASE_PATH) : path.join(dataDir, "app.db"),
    storageDir: env.STORAGE_DIR ? path.resolve(ROOT, env.STORAGE_DIR) : path.join(dataDir, "storage"),
    webDistDir: path.join(ROOT, "web/dist"),
    templatesDir: path.join(ROOT, "server/templates"),
    emojiBaseUrl: env.EMOJI_BASE_URL ?? "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/",
    // Render worker threads; 0 renders on the main thread (not recommended in production).
    renderWorkers: env.RENDER_WORKERS === undefined || env.RENDER_WORKERS === "" ? null : Number(env.RENDER_WORKERS),
    renderTimeoutMs: Number(env.RENDER_TIMEOUT_MS || 30_000),
    renderCache: {
      maxBytes: Number(env.RENDER_CACHE_MB ?? 64) * 1024 * 1024,
      ttlMs: Number(env.RENDER_CACHE_TTL_SECONDS ?? 600) * 1000,
    },
    images: {
      maxBytes: Number(env.MAX_IMAGE_BYTES || 5 * 1024 * 1024),
      timeoutMs: Number(env.IMAGE_TIMEOUT_MS || 5000),
      allowPrivate: env.ALLOW_PRIVATE_IMAGE_HOSTS === "true",
    },
  };
}
