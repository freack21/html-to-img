import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Badge, Card, CopyButton, PageHeader, cx } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

function Code({ children }) {
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-xl bg-zinc-950 p-4 pr-20 text-xs leading-relaxed text-zinc-100 ring-1 ring-zinc-800">{children}</pre>
      {typeof children === "string" && (
        <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <CopyButton text={children} />
        </div>
      )}
    </div>
  );
}

const SECTIONS = [
  ["auth", "Access & limits"],
  ["render", "Render an image"],
  ["templates", "Templates"],
  ["errors", "Errors"],
];

/** Sticky table of contents that highlights the section in view. */
function Toc() {
  const [active, setActive] = useState(SECTIONS[0][0]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);
  return (
    <nav aria-label="On this page" className="sticky top-24 hidden self-start lg:block">
      <p className="mb-3 text-xs font-semibold tracking-wide text-zinc-400 uppercase">On this page</p>
      <ul className="space-y-1 border-l border-zinc-200 text-sm dark:border-zinc-800">
        {SECTIONS.map(([id, label]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={active === id ? "location" : undefined}
              className={cx(
                "-ml-px block border-l-2 py-1 pl-4 transition-colors",
                active === id
                  ? "border-violet-600 font-medium text-violet-700 dark:border-violet-400 dark:text-violet-300"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200",
              )}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
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
  ["429", "rate_limited", "Rate limit reached; wait the number of seconds in Retry-After."],
];

export default function Docs() {
  const origin = window.location.origin;
  const { pricing, session } = useAuth();
  const perMinute = session?.usage?.period === "minute" ? session.usage.limit : 5;
  const authHeader = pricing ? `\n  -H "Authorization: Bearer $HTI_KEY" \\` : "";
  const [templates, setTemplates] = useState([]);
  useEffect(() => {
    api("/templates").then(setTemplates).catch(() => {});
  }, []);

  return (
    <div className="grid gap-12 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <Toc />
      <div className="max-w-3xl min-w-0 space-y-12">
      <PageHeader title="API documentation" description="Version 1 · base URL /api/v1 · JSON in, image or JSON out." />

      <Section id="auth" title="Access & limits">
        {pricing ? (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Create an API key in your <Link to="/dashboard" className="text-violet-600 underline">dashboard</Link> and send it
              as a bearer token (or an <code>X-API-Key</code> header). Requests without a key are treated as guest requests:
              limited per IP per day and watermarked.
            </p>
            <Code>{`Authorization: Bearer hti_xxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              The API is free and needs <strong>no API key or account</strong>. Images are watermark-free and every template is
              available. To keep it fair, each IP address can render up to <strong>{perMinute} images per minute</strong>{" "}
              (a rolling 60-second window).
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Every render response includes <code>X-RateLimit-Limit</code> and <code>X-RateLimit-Remaining</code>. Over the
              limit you get <code>429 rate_limited</code> with a <code>Retry-After</code> header (seconds). Failed renders and
              studio previews don't count.
            </p>
            <Code>{`HTTP/1.1 429 Too Many Requests
Retry-After: 12

{ "success": false, "error": { "code": "rate_limited",
  "message": "Free limit is ${perMinute} images per minute per IP. Try again in 12s." } }`}</Code>
          </>
        )}
      </Section>

      <Section id="render" title="Render an image">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Badge tone="violet">POST</Badge> <code>/api/v1/render</code> — the template slug goes in the payload.
        </p>
        <Code>{`curl -X POST ${origin}/api/v1/render \\${authHeader}
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
                ["scale", "1–4", pricing ? "Pixel density multiplier, limited by your plan. Default 1." : "Pixel density multiplier. Default 1."],
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
          Every render response carries an <code>X-Render-Id</code> header, plus{" "}
          {pricing ? (
            <>
              <code>X-Quota-Limit</code> and <code>X-Quota-Remaining</code>.
            </>
          ) : (
            <>
              <code>X-RateLimit-Limit</code> and <code>X-RateLimit-Remaining</code>.
            </>
          )}
        </p>
      </Section>

      <Section id="templates" title="Templates">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Badge>GET</Badge> <code>/api/v1/templates</code> lists every template with its params (type, default, limits).{" "}
          <Badge>GET</Badge> <code>/api/v1/templates/:slug</code> returns one.
        </p>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <Link key={t.slug} to={`/studio?t=${t.slug}`} className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">
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
              {ERRORS.filter(([status]) => pricing || !["401", "402", "403"].includes(status)).map(([status, code, desc]) => (
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
    </div>
  );
}
