import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, CopyButton, Field, Icon, SegmentedControl, Select, Textarea, cx } from "./ui.jsx";

const FORMATS = ["png", "jpeg", "svg"].map((f) => ({ value: f, label: f.toUpperCase() }));
const SCALES = [1, 2, 3, 4].map((s) => ({ value: s, label: `${s}x` }));
const OUTPUTS = [
  { value: "binary", label: "Image" },
  { value: "url", label: "URL (JSON)" },
];
const SHOWN_HEADERS = ["content-type", "x-cache", "x-ratelimit-limit", "x-ratelimit-remaining", "x-quota-limit", "x-quota-remaining", "retry-after", "x-render-id"];

const defaultsOf = (template) => Object.fromEntries(Object.entries(template?.params || {}).map(([k, spec]) => [k, spec.default]));

function buildRequest({ origin, method, slug, params, format, scale, output, pricing }) {
  const auth = pricing ? ` \\\n  -H "Authorization: Bearer $HTI_KEY"` : "";
  if (method === "GET") {
    const query = new URLSearchParams({ template: slug, format, scale: String(scale), output });
    for (const [key, value] of Object.entries(params)) query.set(key, String(value));
    const url = `${origin}/api/v1/render?${query}`;
    return { url, init: { method: "GET" }, curl: `curl "${url}"${auth} -o out.${format}` };
  }
  const body = { template: slug, format, scale, output, params };
  const json = JSON.stringify(body, null, 2);
  return {
    url: `${origin}/api/v1/render`,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    curl: `curl -X POST ${origin}/api/v1/render${auth} \\\n  -H "Content-Type: application/json" \\\n  -d '${json.replaceAll("'", "'\\''")}' -o out.${format}`,
  };
}

/** Sends real requests to the render endpoint and shows status, headers and the image. */
export function ApiPlayground({ templates, pricing }) {
  const [slug, setSlug] = useState("qc");
  const template = templates.find((t) => t.slug === slug) || templates[0];
  const [paramsText, setParamsText] = useState("{}");
  const [method, setMethod] = useState("POST");
  const [format, setFormat] = useState("png");
  const [scale, setScale] = useState(1);
  const [output, setOutput] = useState("binary");
  const [response, setResponse] = useState(null);
  const [busy, setBusy] = useState(false);
  const objectUrl = useRef(null);

  useEffect(() => {
    if (template) setParamsText(JSON.stringify(defaultsOf(template), null, 2));
  }, [template]);
  useEffect(() => () => objectUrl.current && URL.revokeObjectURL(objectUrl.current), []);

  const parsed = useMemo(() => {
    try {
      const value = JSON.parse(paramsText);
      if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Params must be a JSON object" };
      return { value };
    } catch (err) {
      return { error: err.message };
    }
  }, [paramsText]);

  if (!template) return null;
  const request = buildRequest({
    origin: window.location.origin,
    method,
    slug: template.slug,
    params: parsed.value || {},
    format,
    scale,
    output,
    pricing,
  });

  const send = async () => {
    setBusy(true);
    const started = performance.now();
    try {
      const res = await fetch(request.url, request.init);
      const ms = Math.round(performance.now() - started);
      const headers = SHOWN_HEADERS.flatMap((h) => (res.headers.has(h) ? [[h, res.headers.get(h)]] : []));
      const type = res.headers.get("content-type") || "";
      let body;
      if (type.startsWith("image/")) {
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
        const blob = await res.blob();
        objectUrl.current = URL.createObjectURL(blob);
        body = { image: objectUrl.current, bytes: blob.size };
      } else {
        body = { json: JSON.stringify(await res.json().catch(() => null), null, 2) };
      }
      setResponse({ status: res.status, ok: res.ok, ms, headers, ...body });
    } catch (err) {
      setResponse({ status: 0, ok: false, ms: 0, headers: [], json: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-zinc-200 dark:ring-zinc-800">
      <div className="grid gap-4 bg-white p-4 sm:grid-cols-2 dark:bg-zinc-900">
        <Field label="Template">
          <Select
            aria-label="Template"
            value={template.slug}
            onChange={setSlug}
            options={templates.map((t) => ({ value: t.slug, label: t.name, description: t.slug }))}
          />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Format">
            <Select aria-label="Format" value={format} onChange={setFormat} options={FORMATS} />
          </Field>
          <Field label="Scale">
            <Select aria-label="Scale" value={scale} onChange={setScale} options={SCALES} />
          </Field>
          <Field label="Output">
            <Select aria-label="Output" value={output} onChange={setOutput} options={OUTPUTS} />
          </Field>
        </div>
        <Field label="params (JSON)" error={parsed.error} className="sm:col-span-2">
          <Textarea
            rows={Math.min(12, paramsText.split("\n").length + 1)}
            spellCheck={false}
            value={paramsText}
            onChange={(e) => setParamsText(e.target.value)}
            className="font-mono text-xs"
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <SegmentedControl
            aria-label="HTTP method"
            value={method}
            onChange={setMethod}
            options={[
              { value: "POST", label: "POST" },
              { value: "GET", label: "GET" },
            ]}
          />
          <Button onClick={send} loading={busy} disabled={Boolean(parsed.error)}>
            {!busy && <Icon name="zap" />}
            Send request
          </Button>
        </div>
      </div>

      <div className="relative border-t border-zinc-800 bg-zinc-950">
        <pre className="max-h-56 overflow-auto p-4 pr-20 text-xs leading-relaxed text-zinc-100">{request.curl}</pre>
        <div className="absolute top-2 right-2">
          <CopyButton text={request.curl} />
        </div>
      </div>

      {response && (
        <div className="space-y-3 border-t border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={response.ok ? "green" : "red"}>{response.status || "Network error"}</Badge>
            {response.ms > 0 && <span className="text-xs text-zinc-500">{response.ms} ms</span>}
            {response.bytes !== undefined && <span className="text-xs text-zinc-500">{(response.bytes / 1024).toFixed(1)} KB</span>}
          </div>
          {response.headers.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
              {response.headers.map(([name, value]) => (
                <div key={name} className="contents">
                  <dt className="text-zinc-500">{name}</dt>
                  <dd className={cx("break-all", name === "x-cache" && value === "HIT" && "text-green-600 dark:text-green-400")}>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {response.image ? (
            <div className="checkerboard flex justify-center rounded-xl p-4">
              <img src={response.image} alt="Rendered result" className="max-h-80 max-w-full object-contain" />
            </div>
          ) : (
            <pre className="max-h-72 overflow-auto rounded-xl bg-zinc-950 p-4 text-xs text-zinc-100">{response.json}</pre>
          )}
        </div>
      )}
    </div>
  );
}
