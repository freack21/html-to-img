import crypto from "node:crypto";

/** JSON with sorted object keys, so `{a, b}` and `{b, a}` hash the same. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * In-memory LRU of rendered images, bounded by total bytes and entry age. Identical
 * requests (same template version, params, format, scale, watermark) are served from
 * here without rendering again. The TTL bounds how stale remote images can get.
 */
export function createRenderCache({ maxBytes = 64 * 1024 * 1024, maxEntryBytes = 8 * 1024 * 1024, ttlMs = 10 * 60 * 1000, now = Date.now } = {}) {
  const entries = new Map();
  let bytes = 0;

  const remove = (key) => {
    const entry = entries.get(key);
    if (!entry) return;
    entries.delete(key);
    bytes -= entry.result.buffer.length;
  };

  return {
    key({ slug, version, params, format, scale, watermark }) {
      return crypto
        .createHash("sha256")
        .update(canonical([slug, version, format, scale, watermark ?? null, params]))
        .digest("base64url");
    },
    get(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (now() - entry.at > ttlMs) {
        remove(key);
        return null;
      }
      // Refresh LRU position.
      entries.delete(key);
      entries.set(key, entry);
      return entry.result;
    },
    set(key, result) {
      if (result.buffer.length > Math.min(maxEntryBytes, maxBytes)) return;
      remove(key);
      entries.set(key, { result, at: now() });
      bytes += result.buffer.length;
      for (const oldest of entries.keys()) {
        if (bytes <= maxBytes) break;
        remove(oldest);
      }
    },
    stats: () => ({ entries: entries.size, bytes }),
  };
}
