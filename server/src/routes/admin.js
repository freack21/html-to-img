import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../auth/middleware.js";
import { FONT_FAMILIES } from "../engine/index.js";
import { HttpError } from "../lib/errors.js";
import { createPlan, deletePlan, listPlans, updatePlan } from "../services/plans.js";
import { adminStats } from "../services/renders.js";
import { getSettings, updateSettings } from "../services/settings.js";
import { createTemplate, deleteTemplate, getTemplate, listTemplates, updateTemplate } from "../services/templates.js";
import { listUsers, parse, updateUserAsAdmin } from "../services/users.js";

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Not found");
  return id;
};

const userQuery = z.object({
  q: z.string().max(100).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export function adminRoutes({ db }) {
  const router = Router();
  router.use(requireAdmin);

  router.get("/stats", (req, res) => res.json({ success: true, data: adminStats(db) }));
  router.get("/fonts", (req, res) => res.json({ success: true, data: FONT_FAMILIES }));

  router.get("/templates", (req, res) => res.json({ success: true, data: listTemplates(db) }));
  router.get("/templates/:id", (req, res) => {
    const template = getTemplate(db, idParam(req));
    if (!template) throw new HttpError(404, "Template not found");
    res.json({ success: true, data: template });
  });
  router.post("/templates", (req, res) => {
    res.status(201).json({ success: true, data: createTemplate(db, req.body ?? {}) });
  });
  router.patch("/templates/:id", (req, res) => {
    res.json({ success: true, data: updateTemplate(db, idParam(req), req.body ?? {}) });
  });
  router.delete("/templates/:id", (req, res) => {
    deleteTemplate(db, idParam(req));
    res.json({ success: true, data: null });
  });

  router.get("/users", (req, res) => {
    res.json({ success: true, data: listUsers(db, parse(userQuery, req.query)) });
  });
  router.patch("/users/:id", (req, res) => {
    res.json({ success: true, data: updateUserAsAdmin(db, req.principal.user.id, idParam(req), req.body) });
  });

  router.get("/plans", (req, res) => res.json({ success: true, data: listPlans(db) }));
  router.post("/plans", (req, res) => res.status(201).json({ success: true, data: createPlan(db, req.body ?? {}) }));
  router.patch("/plans/:id", (req, res) => {
    res.json({ success: true, data: updatePlan(db, idParam(req), req.body ?? {}) });
  });
  router.delete("/plans/:id", (req, res) => {
    deletePlan(db, idParam(req));
    res.json({ success: true, data: null });
  });

  router.get("/settings", (req, res) => res.json({ success: true, data: getSettings(db) }));
  router.patch("/settings", (req, res) => res.json({ success: true, data: updateSettings(db, req.body ?? {}) }));

  return router;
}
