import { Router } from "express";
import { z } from "zod";
import { randomId } from "../auth/crypto.js";
import { parseDefinition } from "../engine/index.js";
import { clientKey } from "../lib/client.js";
import { HttpError } from "../lib/errors.js";
import { rateLimit } from "../lib/rate-limit.js";
import { policyFor, recordRender, usageFor } from "../services/renders.js";
import { getSettings } from "../services/settings.js";
import { getTemplateBySlug } from "../services/templates.js";
import { parse } from "../services/users.js";

export const SVG_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'";
const RESERVED_QUERY_KEYS = new Set(["template", "format", "scale", "output"]);
const EXTENSIONS = { png: "png", jpeg: "jpg", svg: "svg" };

const renderSchema = z.object({
  template: z.string().trim().min(1).max(40),
  params: z.record(z.string(), z.unknown()).default({}),
  format: z
    .enum(["png", "jpeg", "jpg", "svg"])
    .default("png")
    .transform((f) => (f === "jpg" ? "jpeg" : f)),
  scale: z.coerce.number().int().min(1).max(4).default(1),
  output: z.enum(["binary", "url"]).default("binary"),
});

const previewSchema = z.object({
  template: z.string().trim().min(1).max(40).optional(),
  definition: z.unknown().optional(),
  params: z.record(z.string(), z.unknown()).default({}),
});

/** GET form: `?template=qc&format=png&name=Fikri` — every non-reserved key is a template param. */
function fromQuery(query) {
  const input = { params: {} };
  for (const [key, raw] of Object.entries(query)) {
    const value = Array.isArray(raw) ? raw.at(-1) : raw;
    if (RESERVED_QUERY_KEYS.has(key)) input[key] = value;
    else input.params[key] = value;
  }
  return input;
}

function assertApiAccess(principal) {
  if (principal?.via === "api_key" && !principal.plan.apiAccess) {
    throw new HttpError(403, "Your plan does not include API access", { code: "api_access_denied" });
  }
}

function setQuotaHeaders(res, usage, consumed = 0) {
  if (usage.limit === null) return;
  res.set("X-Quota-Limit", String(usage.limit));
  res.set("X-Quota-Remaining", String(Math.max(0, usage.remaining - consumed)));
}

function sendImage(res, result, fileName) {
  res.type(result.contentType);
  res.set("Content-Disposition", `inline; filename="${fileName}"`);
  res.set("X-Content-Type-Options", "nosniff");
  if (result.format === "svg") res.set("Content-Security-Policy", SVG_CSP);
  res.send(result.buffer);
}

export function renderRoutes({ db, config, renderer, storage }) {
  const router = Router();
  const thumbnails = new Map();

  const loadActiveTemplate = (slug) => {
    const template = getTemplateBySlug(db, slug);
    if (!template || !template.isActive) throw new HttpError(404, `Template "${slug}" not found`);
    return template;
  };

  const handleRender = async (req, res) => {
    const data = parse(renderSchema, req.method === "GET" ? fromQuery(req.query) : req.body);
    const template = loadActiveTemplate(data.template);
    let { principal } = req;
    // A GET render triggered by another site (link, <img>) must not spend the
    // logged-in user's quota: treat it as a guest request instead.
    if (req.method === "GET" && principal?.via === "session" && ["cross-site", "same-site"].includes(req.get("sec-fetch-site"))) {
      principal = null;
    }
    const settings = getSettings(db);
    const policy = policyFor(principal, settings);

    assertApiAccess(principal);
    if (template.isPremium && !policy.premiumTemplates) {
      throw new HttpError(403, "This template requires a premium plan", { code: "premium_template" });
    }
    if (data.scale > policy.maxScale) {
      throw new HttpError(403, `Maximum scale for your plan is ${policy.maxScale}`, { code: "scale_not_allowed" });
    }

    const client = clientKey(req.ip);
    const usage = usageFor(db, principal, client, settings);
    setQuotaHeaders(res, usage);
    if (usage.limit !== null && usage.used >= usage.limit) {
      const message = principal
        ? "Monthly render quota exceeded; upgrade your plan or wait for the next period"
        : "Daily guest limit reached; create a free account to keep rendering";
      throw new HttpError(402, message, { code: "quota_exceeded" });
    }

    const started = performance.now();
    const result = await renderer(template.definition, data.params, {
      format: data.format,
      scale: data.scale,
      watermark: policy.watermark,
    });
    const id = randomId();
    const ext = EXTENSIONS[result.format];
    let fileName = null;
    let expiresAt = null;
    if (data.output === "url") {
      fileName = await storage.save(result.buffer, ext);
      expiresAt = new Date(Date.now() + policy.retentionHours * 3600 * 1000).toISOString();
    }
    recordRender(db, {
      id,
      userId: principal?.user.id,
      apiKeyId: principal?.apiKeyId,
      ip: client,
      templateSlug: template.slug,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.buffer.length,
      durationMs: Math.round(performance.now() - started),
      source: principal?.via === "api_key" ? "api" : "web",
      fileName,
      expiresAt,
    });
    setQuotaHeaders(res, usage, 1);
    res.set("X-Render-Id", id);

    if (data.output === "url") {
      const base = config.publicUrl || `${req.protocol}://${req.get("host")}`;
      return res.status(201).json({
        success: true,
        data: {
          id,
          url: `${base}/files/${fileName}`,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.buffer.length,
          expiresAt,
        },
      });
    }
    res.set("Cache-Control", "no-store");
    sendImage(res, result, `${template.slug}-${id}.${ext}`);
  };

  router.get("/render", handleRender);
  router.post("/render", handleRender);

  // Live preview for the studio and the admin template editor. Not counted against quota,
  // so previews of published templates are always watermarked.
  router.post("/preview", rateLimit({ windowMs: 60_000, max: 90, message: "Too many preview requests" }), async (req, res) => {
    const data = parse(previewSchema, req.body);
    assertApiAccess(req.principal);
    let definition;
    let watermark = "PREVIEW";
    if (data.definition !== undefined) {
      if (req.principal?.via !== "session" || req.principal.user.role !== "admin") {
        throw new HttpError(403, "Only admins can preview draft definitions");
      }
      definition = parseDefinition(data.definition);
      watermark = null;
    } else if (data.template) {
      definition = loadActiveTemplate(data.template).definition;
    } else {
      throw new HttpError(400, "Provide a template slug or a definition");
    }
    const result = await renderer(definition, data.params, { format: "png", watermark });
    res.set("Cache-Control", "no-store");
    sendImage(res, result, "preview.png");
  });

  router.get("/templates/:slug/thumbnail.png", async (req, res) => {
    const template = loadActiveTemplate(req.params.slug);
    let cached = thumbnails.get(template.slug);
    if (cached?.version !== template.version) {
      const { buffer } = await renderer(template.definition, {}, { format: "png" });
      cached = { version: template.version, buffer };
      thumbnails.set(template.slug, cached);
    }
    res.set("Cache-Control", "public, max-age=300");
    res.type("image/png").send(cached.buffer);
  });

  return router;
}
