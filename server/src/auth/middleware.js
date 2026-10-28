import { HttpError } from "../lib/errors.js";
import { API_KEY_PREFIX, resolveApiKey, resolveSession, SESSION_TTL_MS } from "../services/users.js";

export const SESSION_COOKIE = "hti_session";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function readCookie(req, name) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null; // malformed value, treat as absent
      }
    }
  }
  return null;
}

export function sessionCookieOptions(config) {
  return { httpOnly: true, sameSite: "lax", secure: config.isProduction, path: "/", maxAge: SESSION_TTL_MS };
}

function isSameHost(origin, host) {
  try {
    return new URL(origin).host === host;
  } catch {
    return false; // e.g. "Origin: null"
  }
}

function bearerToken(req) {
  const header = req.get("authorization") || "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : req.get("x-api-key") || null;
}

/**
 * Sets `req.principal` ({ user, plan, apiKeyId?, via }) or null for guests.
 * An API key that is present but invalid is rejected instead of falling back to guest access.
 */
export function authenticate(db) {
  return (req, res, next) => {
    req.principal = null;
    const key = bearerToken(req);
    if (key) {
      const principal = key.startsWith(API_KEY_PREFIX) ? resolveApiKey(db, key) : null;
      if (!principal) return next(new HttpError(401, "Invalid or revoked API key", { code: "invalid_api_key" }));
      req.principal = { ...principal, via: "api_key" };
      return next();
    }
    const token = readCookie(req, SESSION_COOKIE);
    if (token) {
      const principal = resolveSession(db, token);
      if (principal) {
        // Cookie auth + unsafe method: require a same-origin request (CSRF defense in depth
        // on top of SameSite=Lax and JSON-only bodies).
        const origin = req.get("origin");
        if (!SAFE_METHODS.has(req.method) && origin && !isSameHost(origin, req.get("host"))) {
          return next(new HttpError(403, "Cross-origin request rejected", { code: "bad_origin" }));
        }
        req.principal = { ...principal, via: "session" };
      }
    }
    next();
  };
}

export function requireUser(req, res, next) {
  if (!req.principal) return next(new HttpError(401, "Login required"));
  next();
}

/** Admin routes only accept browser sessions, never API keys. */
export function requireAdmin(req, res, next) {
  if (!req.principal || req.principal.via !== "session") return next(new HttpError(401, "Login required"));
  if (req.principal.user.role !== "admin") return next(new HttpError(403, "Admin access required"));
  next();
}
