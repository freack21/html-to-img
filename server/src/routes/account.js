import { Router } from "express";
import { z } from "zod";
import { readCookie, requireUser, SESSION_COOKIE, sessionCookieOptions } from "../auth/middleware.js";
import { clientId } from "../lib/client.js";
import { HttpError } from "../lib/errors.js";
import { rateLimit } from "../lib/rate-limit.js";
import { listPlans } from "../services/plans.js";
import { listUserRenders, policyFor, usageFor } from "../services/renders.js";
import { getSettings } from "../services/settings.js";
import { getTemplateBySlug, listTemplates, publicTemplate } from "../services/templates.js";
import {
  changePassword,
  createApiKey,
  createSession,
  createUser,
  deleteSession,
  getUser,
  listApiKeys,
  parse,
  resolveSession,
  revokeApiKey,
  verifyCredentials,
} from "../services/users.js";

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function accountRoutes({ db, config }) {
  const router = Router();
  const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, message: "Too many attempts, try again later" });

  const startSession = (req, res, user) => {
    const token = createSession(db, user.id, { ip: req.ip, userAgent: req.get("user-agent") });
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(config));
    return resolveSession(db, token);
  };

  const me = (principal, req) => {
    const settings = getSettings(db);
    return {
      user: principal?.user ?? null,
      plan: principal?.plan ?? null,
      usage: usageFor(db, principal, clientId(req), settings),
      limits: policyFor(principal, settings),
      registrationOpen: settings.registrationOpen,
    };
  };

  // Public catalog ------------------------------------------------------------

  router.get("/templates", (req, res) => {
    res.json({ success: true, data: listTemplates(db, { activeOnly: true }).map(publicTemplate) });
  });

  router.get("/templates/:slug", (req, res) => {
    const template = getTemplateBySlug(db, req.params.slug);
    if (!template?.isActive) throw new HttpError(404, "Template not found");
    res.json({ success: true, data: publicTemplate(template) });
  });

  router.get("/plans", (req, res) => {
    res.json({ success: true, data: listPlans(db, { activeOnly: true }) });
  });

  // Auth ------------------------------------------------------------------------

  router.post("/auth/register", authLimiter, async (req, res) => {
    if (!getSettings(db).registrationOpen) throw new HttpError(403, "Registration is currently closed");
    const user = await createUser(db, req.body);
    const principal = startSession(req, res, user);
    res.status(201).json({ success: true, data: me(principal, req) });
  });

  router.post("/auth/login", authLimiter, async (req, res) => {
    const user = await verifyCredentials(db, req.body);
    const principal = startSession(req, res, user);
    res.json({ success: true, data: me(principal, req) });
  });

  router.post("/auth/logout", (req, res) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) deleteSession(db, token);
    const { maxAge, ...options } = sessionCookieOptions(config);
    res.clearCookie(SESSION_COOKIE, options);
    res.json({ success: true, data: null });
  });

  // Works for guests too: returns their remaining daily renders.
  router.get("/auth/me", (req, res) => {
    res.json({ success: true, data: me(req.principal, req) });
  });

  // Account -------------------------------------------------------------------

  router.patch("/me", requireUser, (req, res) => {
    const { name } = parse(z.object({ name: z.string().trim().min(1).max(80) }).strict(), req.body);
    db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, req.principal.user.id);
    res.json({ success: true, data: getUser(db, req.principal.user.id) });
  });

  router.post("/me/password", requireUser, authLimiter, async (req, res) => {
    await changePassword(db, req.principal.user.id, req.body, { keepToken: readCookie(req, SESSION_COOKIE) });
    res.json({ success: true, data: null });
  });

  router.get("/me/renders", requireUser, (req, res) => {
    const query = parse(pageQuery, req.query);
    res.json({ success: true, data: listUserRenders(db, req.principal.user.id, query) });
  });

  // API keys are managed from the dashboard session only.
  const requireSession = (req, res, next) => {
    if (req.principal?.via !== "session") return next(new HttpError(401, "Login required"));
    next();
  };

  router.get("/me/api-keys", requireSession, (req, res) => {
    res.json({ success: true, data: listApiKeys(db, req.principal.user.id) });
  });

  router.post("/me/api-keys", requireSession, (req, res) => {
    const created = createApiKey(db, req.principal.user.id, req.body);
    res.status(201).json({ success: true, data: created });
  });

  router.delete("/me/api-keys/:id", requireSession, (req, res) => {
    revokeApiKey(db, req.principal.user.id, Number(req.params.id));
    res.json({ success: true, data: null });
  });

  return router;
}
