import fs from "node:fs";
import path from "node:path";
import express from "express";
import { authenticate } from "./auth/middleware.js";
import { HttpError } from "./lib/errors.js";
import { accountRoutes } from "./routes/account.js";
import { adminRoutes } from "./routes/admin.js";
import { renderRoutes, SVG_CSP } from "./routes/render.js";

function securityHeaders(req, res, next) {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("X-Frame-Options", "DENY");
  next();
}

function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    let error = err;
    if (err.type === "entity.too.large") error = new HttpError(413, "Request body is too large");
    else if (err.type === "entity.parse.failed") error = new HttpError(400, "Malformed JSON body");
    else if (!(err instanceof HttpError)) {
      logger.error(`[${req.method} ${req.originalUrl}]`, err);
      error = new HttpError(500, "Internal server error");
    }
    res.status(error.status).json({
      success: false,
      error: { code: error.code, message: error.message, ...(error.details && { details: error.details }) },
    });
  };
}

/**
 * @param {{ db, config, renderer, storage, logger? }} ctx
 */
export function createApp(ctx) {
  const { db, config, storage, logger = console } = ctx;
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.use(securityHeaders);

  const api = express.Router();
  api.use(express.json({ limit: "16mb" }));
  api.use(authenticate(db));
  api.use(renderRoutes(ctx));
  api.use(accountRoutes(ctx));
  api.use("/admin", adminRoutes(ctx));
  api.use((req, res, next) => next(new HttpError(404, "Route not found")));
  app.use("/api/v1", api);

  app.use(
    "/files",
    express.static(storage.dir, {
      index: false,
      dotfiles: "deny",
      maxAge: "1h",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".svg")) res.set("Content-Security-Policy", SVG_CSP);
      },
    }),
    (req, res, next) => next(new HttpError(404, "File not found or expired")),
  );

  // Serve the built React app with client-side routing fallback.
  const indexHtml = path.join(config.webDistDir, "index.html");
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.webDistDir, { index: false, maxAge: "1d" }));
    app.get("/{*splat}", (req, res) => res.set("Cache-Control", "no-cache").sendFile(indexHtml));
  }

  app.use((req, res, next) => next(new HttpError(404, "Route not found")));
  app.use(errorHandler(logger));
  return app;
}
