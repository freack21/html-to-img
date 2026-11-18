import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { parseDefinition } from "../engine/index.js";
import { getSettings } from "../services/settings.js";
import { getTemplateBySlug, listTemplates } from "../services/templates.js";

const SITE = "html-to-img";
const DEFAULT_DESCRIPTION = "Generate PNG, JPEG and SVG images from JSON templates with a free API. No headless browser, no sign-up.";

/** Public pages: title and description used for <title>, meta and Open Graph tags. */
export const PAGES = {
  "/": { title: `${SITE} · Images from JSON templates`, description: DEFAULT_DESCRIPTION },
  "/studio": { title: `Studio · ${SITE}`, description: "Pick a template, edit its text, colors and images, and download the result in seconds." },
  "/docs": { title: `API docs · ${SITE}`, description: "Render images with one HTTP request. OpenAPI spec, playground and examples for the html-to-img API." },
  "/pricing": { title: `Pricing · ${SITE}`, description: "Plans for html-to-img." },
  "/login": { title: `Log in · ${SITE}`, description: DEFAULT_DESCRIPTION, noindex: true },
  "/register": { title: `Sign up · ${SITE}`, description: DEFAULT_DESCRIPTION, noindex: true },
};
// Client-side routes that exist but should stay out of search results.
const PRIVATE_PREFIXES = ["/dashboard", "/admin"];

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const originOf = (config, req) => config.publicUrl || `${req.protocol}://${req.get("host")}`;

/** Finds the page for a SPA path; `null` means the app would show its 404 page. */
export function pageFor(pathname) {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (PAGES[clean]) return { path: clean, ...PAGES[clean] };
  if (PRIVATE_PREFIXES.some((p) => clean === p || clean.startsWith(`${p}/`))) {
    return { path: clean, title: SITE, description: DEFAULT_DESCRIPTION, noindex: true };
  }
  return null;
}

/** Puts the page's title, description, canonical URL and Open Graph/Twitter tags into index.html. */
export function injectMeta(html, { origin, page }) {
  const meta = page ?? { path: "/404", title: `Page not found · ${SITE}`, description: DEFAULT_DESCRIPTION, noindex: true };
  const url = `${origin}${meta.path === "/" ? "/" : meta.path}`;
  const tags = [
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    meta.noindex ? `<meta name="robots" content="noindex" />` : `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(origin)}/og.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(origin)}/og.png" />`,
  ].join("\n    ");
  return html
    .replace(/<meta name="description"[^>]*>\s*/i, "")
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(meta.title)}</title>\n    ${tags}`);
}

export function seoRoutes({ db, config, renderer }) {
  const router = Router();
  let ogImage = null;

  router.get("/robots.txt", (req, res) => {
    const origin = originOf(config, req);
    res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(
      ["User-agent: *", "Allow: /", "Disallow: /api/", "Disallow: /dashboard", "Disallow: /admin", "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n"),
    );
  });

  router.get("/sitemap.xml", (req, res) => {
    const origin = originOf(config, req);
    const urls = [
      ...Object.entries(PAGES)
        .filter(([p, page]) => !page.noindex && (p !== "/pricing" || getSettings(db).pricingEnabled))
        .map(([p]) => `${origin}${p}`),
      ...listTemplates(db, { activeOnly: true }).map((t) => `${origin}/studio?t=${encodeURIComponent(t.slug)}`),
    ];
    const body = urls.map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`).join("\n");
    res
      .type("application/xml")
      .set("Cache-Control", "public, max-age=3600")
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  });

  // Social preview image, rendered once with the bundled og-image template.
  router.get("/og.png", async (req, res) => {
    if (!ogImage) {
      const stored = getTemplateBySlug(db, "og-image");
      const definition = stored
        ? stored.definition
        : parseDefinition(JSON.parse(fs.readFileSync(path.join(config.templatesDir, "og-image.json"), "utf8")).definition);
      const { buffer } = await renderer(
        definition,
        {
          title: "Generate images from JSON templates",
          description: "One API call, no headless browser, no sign-up. PNG, JPEG or SVG in milliseconds.",
          siteName: SITE,
          url: new URL(originOf(config, req)).host,
          tag: "Free API",
          logo: "",
          theme: "dark",
        },
        { format: "png" },
      );
      ogImage = buffer;
    }
    res.type("image/png").set("Cache-Control", "public, max-age=86400").send(ogImage);
  });

  return router;
}
