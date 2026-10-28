import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { ValidationError } from "../lib/errors.js";

const blockList = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]) {
  blockList.addSubnet(addr, prefix, "ipv4");
}
for (const [addr, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["64:ff9b::", 96],
]) {
  blockList.addSubnet(addr, prefix, "ipv6");
}

export function isBlockedAddress(address) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return blockList.check(mapped[1], "ipv4");
  const family = net.isIP(address);
  if (family === 0) return true;
  return blockList.check(address, family === 4 ? "ipv4" : "ipv6");
}

const SIGNATURES = [
  ["image/png", (b) => b.length > 8 && b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG"],
  ["image/jpeg", (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/gif", (b) => b.toString("ascii", 0, 4) === "GIF8"],
  ["image/webp", (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP"],
];

/** Detects the image type from magic bytes. SVG is intentionally unsupported. */
export function sniffImage(buffer) {
  return SIGNATURES.find(([, test]) => test(buffer))?.[0] ?? null;
}

function toDataUri(buffer) {
  const mime = sniffImage(buffer);
  if (!mime) throw new ValidationError("Unsupported image format (use PNG, JPEG, GIF or WebP)");
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function parseDataUri(uri, maxBytes) {
  const match = /^data:image\/[\w.+-]+;base64,([A-Za-z0-9+/=\s]+)$/.exec(uri);
  if (!match) throw new ValidationError("Invalid image data URI");
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length > maxBytes) throw new ValidationError(`Image exceeds ${maxBytes} bytes`);
  return buffer;
}

function safeLookup(allowPrivate) {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err) return callback(err);
      const blocked = !allowPrivate && addresses.some(({ address }) => isBlockedAddress(address));
      if (blocked || addresses.length === 0) {
        return callback(Object.assign(new Error(`Blocked image host: ${hostname}`), { code: "EBLOCKED" }));
      }
      if (options.all) return callback(null, addresses);
      callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

function request(url, { maxBytes, timeoutMs, allowPrivate }) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.get(
      url,
      {
        lookup: safeLookup(allowPrivate),
        headers: { "user-agent": "html-to-img/2.0", accept: "image/*" },
        signal: AbortSignal.timeout(timeoutMs),
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: new URL(res.headers.location, url) });
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        if (Number(res.headers["content-length"]) > maxBytes) {
          res.destroy();
          return reject(new Error(`image exceeds ${maxBytes} bytes`));
        }
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            res.destroy();
            reject(new Error(`image exceeds ${maxBytes} bytes`));
          } else {
            chunks.push(chunk);
          }
        });
        res.on("end", () => resolve({ buffer: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
  });
}

export async function fetchImage(rawUrl, { maxBytes, timeoutMs = 5000, allowPrivate = false, maxRedirects = 3 }) {
  let url = new URL(rawUrl);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("only http(s) URLs are allowed");
    if (url.username || url.password) throw new Error("credentials in URLs are not allowed");
    // IP-literal hosts skip DNS, so the custom lookup never sees them.
    const literal = url.hostname.replace(/^\[|\]$/g, "");
    if (!allowPrivate && net.isIP(literal) && isBlockedAddress(literal)) {
      throw new Error(`Blocked image host: ${url.hostname}`);
    }
    const result = await request(url, { maxBytes, timeoutMs, allowPrivate });
    if (result.buffer) return result.buffer;
    url = result.redirect;
  }
  throw new Error("too many redirects");
}

/**
 * Resolves image sources (http(s) URLs or base64 data URIs) into validated data URIs.
 * Remote images are cached in memory, bounded by total size.
 */
export function createImageLoader({ maxBytes = 5 * 1024 * 1024, timeoutMs = 5000, allowPrivate = false, cacheBytes = 64 * 1024 * 1024 } = {}) {
  const cache = new Map();
  let cachedBytes = 0;

  const remember = (key, value) => {
    cache.set(key, value);
    cachedBytes += value.length;
    for (const [oldKey, oldValue] of cache) {
      if (cachedBytes <= cacheBytes) break;
      cache.delete(oldKey);
      cachedBytes -= oldValue.length;
    }
  };

  return async function load(src) {
    if (src.startsWith("data:")) return toDataUri(parseDataUri(src, maxBytes));
    if (cache.has(src)) return cache.get(src);
    let buffer;
    try {
      buffer = await fetchImage(src, { maxBytes, timeoutMs, allowPrivate });
    } catch (err) {
      throw new ValidationError(`Could not load image ${src.slice(0, 200)}: ${err.message}`);
    }
    const dataUri = toDataUri(buffer);
    remember(src, dataUri);
    return dataUri;
  };
}
