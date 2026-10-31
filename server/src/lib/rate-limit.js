import { clientId } from "./client.js";
import { HttpError } from "./errors.js";

/**
 * Fixed-window in-memory rate limiter. State is per process, which fits the
 * single-instance PM2 deployment; use a shared store before scaling out.
 */
export function rateLimit({ windowMs, max, key = clientId, message = "Too many requests" }) {
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

/**
 * Sliding-window counter: at most `limit` events in any `windowMs` span per key.
 * `take()` reserves a slot up front, so concurrent requests can't overshoot the limit,
 * and returns `release()` to hand the slot back when the work fails.
 * In-memory and per process, like `rateLimit` above.
 */
export function createSlidingWindow({ windowMs, now = Date.now }) {
  const events = new Map();
  const prune = (key, at) => {
    const list = (events.get(key) ?? []).filter((t) => t > at - windowMs);
    if (list.length) events.set(key, list);
    else events.delete(key);
    return list;
  };
  const timer = setInterval(() => {
    const at = now();
    for (const key of events.keys()) prune(key, at);
  }, windowMs);
  timer.unref();

  return {
    peek(key, limit) {
      const at = now();
      const list = prune(key, at);
      return {
        limit,
        used: list.length,
        remaining: Math.max(0, limit - list.length),
        resetsAt: list.length ? new Date(list[0] + windowMs).toISOString() : null,
      };
    },
    take(key, limit) {
      const at = now();
      const list = prune(key, at);
      if (list.length >= limit) {
        return { allowed: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((list[0] + windowMs - at) / 1000)) };
      }
      list.push(at);
      events.set(key, list);
      return {
        allowed: true,
        remaining: limit - list.length,
        release() {
          const current = events.get(key);
          const index = current?.lastIndexOf(at) ?? -1;
          if (index !== -1) current.splice(index, 1);
        },
      };
    },
  };
}
