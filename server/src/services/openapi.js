import { publicTemplate } from "./templates.js";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];

function paramSchema(spec) {
  const base = { ...(spec.label && { title: spec.label }), ...(spec.description && { description: spec.description }) };
  switch (spec.type) {
    case "string":
      return { ...base, type: "string", maxLength: spec.maxLength, default: spec.default };
    case "number":
      return { ...base, type: "number", default: spec.default, ...(spec.min !== undefined && { minimum: spec.min }), ...(spec.max !== undefined && { maximum: spec.max }) };
    case "color":
      return { ...base, type: "string", format: "color", description: base.description || "CSS color: hex, rgb(), hsl() or a named color", default: spec.default };
    case "boolean":
      return { ...base, type: "boolean", default: spec.default };
    case "enum":
      return { ...base, type: "string", enum: spec.options, default: spec.default };
    case "image":
      return {
        ...base,
        type: "string",
        description: base.description || "http(s) URL or base64 data:image/… URI (PNG, JPEG, GIF, WebP)",
        default: spec.default,
      };
    default:
      return base;
  }
}

const schemaId = (slug) => slug.replace(/[^A-Za-z0-9_]/g, "_");

const errorResponse = (description) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } });

/**
 * OpenAPI 3.1 description of the public API, generated from the active templates so
 * every template's params are documented and validated by clients.
 */
export function buildOpenApi({ templates, baseUrl, pricingEnabled, freeRendersPerMinute }) {
  const items = templates.map(publicTemplate);
  const limits = pricingEnabled
    ? "Send an API key as `Authorization: Bearer hti_…`; requests without one are guest requests with a daily limit and a watermark."
    : `Free: no API key needed. Each IP can render ${freeRendersPerMinute} images per minute (rolling window); identical repeated requests are served from cache (\`X-Cache: HIT\`) and don't count.`;

  const renderOptions = {
    format: { type: "string", enum: ["png", "jpeg", "jpg", "svg"], default: "png" },
    scale: { type: "integer", minimum: 1, maximum: 4, default: 1, description: "Pixel density multiplier" },
    output: { type: "string", enum: ["binary", "url"], default: "binary", description: '"url" stores the image and returns JSON with a link' },
  };

  const headers = {
    "X-Render-Id": { schema: { type: "string" } },
    "X-Cache": { schema: { type: "string", enum: ["HIT", "MISS"] } },
    ...(pricingEnabled
      ? { "X-Quota-Limit": { schema: { type: "integer" } }, "X-Quota-Remaining": { schema: { type: "integer" } } }
      : { "X-RateLimit-Limit": { schema: { type: "integer" } }, "X-RateLimit-Remaining": { schema: { type: "integer" } } }),
  };

  const renderResponses = {
    200: { description: "The image (output=binary)", headers, content: Object.fromEntries(IMAGE_TYPES.map((t) => [t, { schema: { type: "string", format: "binary" } }])) },
    201: { description: "Stored image (output=url)", headers, content: { "application/json": { schema: { $ref: "#/components/schemas/StoredImage" } } } },
    404: errorResponse("Unknown or inactive template"),
    413: errorResponse("Output would be too large"),
    422: errorResponse("Invalid params; `error.details` lists each field"),
    ...(pricingEnabled
      ? {
          401: errorResponse("Invalid or revoked API key"),
          402: errorResponse("Quota exceeded"),
          403: errorResponse("Not allowed by your plan"),
        }
      : { 429: { ...errorResponse("Per-IP rate limit reached"), headers: { "Retry-After": { schema: { type: "integer" }, description: "Seconds to wait" } } } }),
    503: errorResponse("Server busy, retry shortly"),
    504: errorResponse("Rendering took too long"),
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "html-to-img API",
      version: "1.0.0",
      description: `Render images from JSON templates. ${limits}`,
    },
    servers: [{ url: `${baseUrl}/api/v1` }],
    security: pricingEnabled ? [{}, { bearerAuth: [] }] : [],
    paths: {
      "/render": {
        post: {
          operationId: "render",
          summary: "Render an image",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  oneOf: items.map((t) => ({ $ref: `#/components/schemas/Render_${schemaId(t.slug)}` })),
                  discriminator: {
                    propertyName: "template",
                    mapping: Object.fromEntries(items.map((t) => [t.slug, `#/components/schemas/Render_${schemaId(t.slug)}`])),
                  },
                },
              },
            },
          },
          responses: renderResponses,
        },
        get: {
          operationId: "renderGet",
          summary: "Render an image from query parameters (for <img src> and bots)",
          parameters: [
            { name: "template", in: "query", required: true, schema: { type: "string", enum: items.map((t) => t.slug) } },
            ...Object.entries(renderOptions).map(([name, schema]) => ({ name, in: "query", schema })),
            {
              name: "params",
              in: "query",
              description: "Every other query key is a template param, e.g. `&name=Fikri`",
              style: "form",
              explode: true,
              schema: { type: "object", additionalProperties: { type: "string" } },
            },
          ],
          responses: renderResponses,
        },
      },
      "/templates": {
        get: {
          operationId: "listTemplates",
          summary: "List templates with their params",
          responses: { 200: { description: "Templates", content: { "application/json": { schema: { $ref: "#/components/schemas/TemplateList" } } } } },
        },
      },
      "/templates/{slug}": {
        get: {
          operationId: "getTemplate",
          summary: "Get one template",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Template", content: { "application/json": { schema: { type: "object", properties: { success: { const: true }, data: { $ref: "#/components/schemas/Template" } } } } } },
            404: errorResponse("Unknown or inactive template"),
          },
        },
      },
      "/templates/{slug}/thumbnail.png": {
        get: {
          operationId: "templateThumbnail",
          summary: "Template preview with default params",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "PNG", content: { "image/png": { schema: { type: "string", format: "binary" } } } }, 404: errorResponse("Unknown template") },
        },
      },
    },
    components: {
      ...(pricingEnabled && { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "API key (hti_…)" } } }),
      schemas: {
        ...Object.fromEntries(
          items.flatMap((t) => {
            const id = schemaId(t.slug);
            return [
              [`Params_${id}`, { type: "object", title: t.name, additionalProperties: false, properties: Object.fromEntries(Object.entries(t.params).map(([k, spec]) => [k, paramSchema(spec)])) }],
              [
                `Render_${id}`,
                {
                  type: "object",
                  title: `${t.name} (${t.slug})`,
                  description: t.description || undefined,
                  required: ["template"],
                  properties: { template: { const: t.slug }, params: { $ref: `#/components/schemas/Params_${id}` }, ...renderOptions },
                },
              ],
            ];
          }),
        ),
        Template: {
          type: "object",
          properties: {
            slug: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
            isPremium: { type: "boolean" },
            version: { type: "integer" },
            width: { type: "integer" },
            height: { type: ["integer", "null"] },
            params: { type: "object", additionalProperties: { type: "object" } },
          },
        },
        TemplateList: { type: "object", properties: { success: { const: true }, data: { type: "array", items: { $ref: "#/components/schemas/Template" } } } },
        StoredImage: {
          type: "object",
          properties: {
            success: { const: true },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                url: { type: "string", format: "uri" },
                format: { type: "string" },
                width: { type: "integer" },
                height: { type: "integer" },
                bytes: { type: "integer" },
                expiresAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: { const: false },
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: { type: "array", items: { type: "object", properties: { path: { type: "string" }, message: { type: "string" } } } },
              },
            },
          },
        },
      },
    },
  };
}
