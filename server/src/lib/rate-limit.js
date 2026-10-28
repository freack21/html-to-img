import { HttpError } from "./errors.js";

/**
 * Fixed-window in-memory rate limiter. State is per process, which fits the
 * single-instance PM2 deployment; use a shared store before scaling out.
 */
export function rateLimit({ windowMs, max, key = (req) => req.ip, message = "Too many requests" }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [k, entry] of hits) if (entry.start < cutoff) hits.delete(k);
  }, windowMs);
  timer.unref();

  return (req, res, next) => {
    const id = key(req);
    const current = Date.now();
    let entry = hits.get(id);
    if (!entry || current - entry.start >= windowMs) {
      entry = { start: current, count: 0 };
      hits.set(id, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.start + windowMs - current) / 1000)));
      return next(new HttpError(429, message));
    }
    next();
  };
}
