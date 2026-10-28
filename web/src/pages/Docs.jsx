import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Badge, Card, PageHeader } from "../components/ui.jsx";
import { api } from "../lib/api.js";

function Code({ children }) {
  return <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-100">{children}</pre>;
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const ERRORS = [
  ["401", "invalid_api_key / unauthorized", "Missing, invalid or revoked API key."],
  ["402", "quota_exceeded", "Daily guest limit or monthly plan quota reached."],
  ["403", "premium_template / scale_not_allowed / api_access_denied", "Your plan does not allow this request."],
  ["404", "not_found", "Unknown or inactive template."],
  ["413", "image_too_large", "Output would exceed the maximum pixel count."],
  ["422", "validation_error", "Invalid params; `error.details` lists each field."],
  ["429", "rate_limited", "Too many requests; honour the Retry-After header."],
];

export default function Docs() {
  const origin = window.location.origin;
  const [templates, setTemplates] = useState([]);
  useEffect(() => {
    api("/templates").then(setTemplates).catch(() => {});
  }, []);

  return (
    <div className="max-w-4xl space-y-10">
      <PageHeader title="API documentation" description="Version 1 · base URL /api/v1 · JSON in, image or JSON out." />

      <Section id="auth" title="Authentication">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Create an API key in your <Link to="/dashboard" className="text-violet-600 underline">dashboard</Link> and send it
          as a bearer token (or an <code>X-API-Key</code> header). Requests without a key are treated as guest requests:
          limited per IP per day and watermarked.
        </p>
        <Code>{`Authorization: Bearer hti_xxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
      </Section>

      <Section id="render" title="Render an image">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Badge tone="violet">POST</Badge> <code>/api/v1/render</code> — the template slug goes in the payload.
        </p>
        <Code>{`curl -X POST ${origin}/api/v1/render \\
  -H "Authorization: Bearer $HTI_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template": "qc",
    "format": "png",
    "scale": 1,
    "output": "binary",
    "params": { "name": "Fikri", "msg": "Hello from the API 👋" }
  }' -o qc.png`}</Code>
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-2">Field</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {[
                ["template", "string", "Template slug (required)."],
                ["params", "object", "Template params; omitted ones use their defaults."],
                ["format", '"png" | "jpeg" | "svg"', 'Output format. Default "png" ("jpg" is accepted).'],
                ["scale", "1–4", "Pixel density multiplier, limited by your plan. Default 1."],
                ["output", '"binary" | "url"', '"binary" returns the image; "url" stores it and returns JSON with a link.'],
              ].map(([field, type, desc]) => (
                <tr key={field}>
                  <td className="px-4 py-2 font-mono text-xs">{field}</td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-500">{type}</td>
                  <td className="px-4 py-2">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">With <code>"output": "url"</code> the response is:</p>
        <Code>{`HTTP/1.1 201 Created
{
  "success": true,
  "data": {
    "id": "Ate4lhEZgBZuPUKK",
    "url": "${origin}/files/DYCcBOz4CtsPaKSL.png",
    "format": "png", "width": 420, "height": 143, "bytes": 13686,
    "expiresAt": "2026-01-01T12:00:00.000Z"
  }
}`}</Code>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Badge>GET</Badge> <code>/api/v1/render?template=qc&amp;name=Fikri</code> works too (handy for{" "}
          <code>&lt;img src&gt;</code> and bots): <code>template</code>, <code>format</code>, <code>scale</code> and{" "}
          <code>output</code> are reserved; every other query key is a template param. Image params accept an{" "}
          <code>http(s)</code> URL or a base64 <code>data:image/…</code> URI (PNG, JPEG, GIF, WebP; max 5 MB).
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Every render response carries <code>X-Quota-Limit</code>, <code>X-Quota-Remaining</code> and{" "}
          <code>X-Render-Id</code> headers.
        </p>
      </Section>

      <Section id="templates" title="Templates">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Badge>GET</Badge> <code>/api/v1/templates</code> lists every template with its params (type, default, limits).{" "}
          <Badge>GET</Badge> <code>/api/v1/templates/:slug</code> returns one.
        </p>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <Link key={t.slug} to={`/?t=${t.slug}`} className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">
              {t.slug}
            </Link>
          ))}
        </div>
      </Section>

      <Section id="errors" title="Errors">
        <Code>{`{ "success": false, "error": { "code": "validation_error", "message": "Invalid template params",
  "details": [{ "path": "bgColor", "message": "bgColor must be a CSS color" }] } }`}</Code>
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {ERRORS.map(([status, code, desc]) => (
                <tr key={status}>
                  <td className="px-4 py-2 font-mono text-xs">{status}</td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-500">{code}</td>
                  <td className="px-4 py-2">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>
    </div>
  );
}
