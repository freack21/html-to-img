import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import ParamForm, { defaultValues } from "../components/ParamForm.jsx";
import { Alert, Badge, Button, Card, CopyButton, Field, Input, Select, Spinner, UsageBar, cx } from "../components/ui.jsx";
import { api, apiBlob, formatNumber } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { fieldErrors, usePreview } from "../lib/usePreview.js";

function TemplatePicker({ templates, selected, onSelect }) {
  const [query, setQuery] = useState("");
  const filtered = templates.filter((t) =>
    `${t.name} ${t.category} ${t.slug}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div className="space-y-3">
      <Input placeholder="Search templates…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:max-h-[70vh] lg:grid-cols-1 lg:overflow-x-visible lg:overflow-y-auto lg:px-0 lg:pr-1 lg:pb-0">
        {filtered.map((t) => (
          <button
            key={t.slug}
            onClick={() => onSelect(t.slug)}
            className={cx(
              "flex w-40 shrink-0 flex-col gap-2 rounded-xl p-2 text-left ring-1 transition lg:w-auto",
              t.slug === selected
                ? "bg-violet-50 ring-violet-500 dark:bg-violet-500/10"
                : "bg-white ring-zinc-200 hover:ring-zinc-400 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-600",
            )}
          >
            <div className="checkerboard grid h-24 place-items-center overflow-hidden rounded-lg">
              <img
                src={`/api/v1/templates/${t.slug}/thumbnail.png?v=${t.version}`}
                alt=""
                loading="lazy"
                className="max-h-24 max-w-full object-contain"
              />
            </div>
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="truncate text-sm font-medium">{t.name}</span>
              {t.isPremium && <Badge tone="amber">Pro</Badge>}
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-sm text-zinc-500">No templates match.</p>}
      </div>
    </div>
  );
}

function download(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ApiSnippet({ slug, values, format, scale }) {
  const origin = window.location.origin;
  // Uploaded images are too large for a URL; leave them out of the snippet.
  const params = Object.fromEntries(Object.entries(values).filter(([, v]) => !String(v).startsWith("data:")));
  const body = JSON.stringify({ template: slug, format, scale, params }, null, 2);
  const curl = `curl -X POST ${origin}/api/v1/render \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${body.replaceAll("'", "'\\''")}' \\
  -o image.${format === "jpeg" ? "jpg" : format}`;
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-400">Use this from the API</summary>
      <div className="mt-2 space-y-2">
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">{curl}</pre>
        <CopyButton text={curl} label="Copy cURL" />
      </div>
    </details>
  );
}

export default function Studio() {
  const { session, user, refresh } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [templates, setTemplates] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [values, setValues] = useState({});
  const [format, setFormat] = useState("png");
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    api("/templates").then(setTemplates).catch(setLoadError);
  }, []);

  const slug = searchParams.get("t") || templates?.[0]?.slug;
  const template = useMemo(() => templates?.find((t) => t.slug === slug), [templates, slug]);

  useEffect(() => {
    if (!template) return;
    setValues(defaultValues(template.params));
    setResult(null);
    setActionError(null);
  }, [template]);

  const previewBody = template && Object.keys(values).length ? { template: template.slug, params: values } : null;
  const preview = usePreview(previewBody);
  const errors = fieldErrors(actionError ?? preview.error);

  const limits = session?.limits;
  const usage = session?.usage;
  const locked = template?.isPremium && !limits?.premiumTemplates;
  const outOfQuota = usage && usage.limit !== null && usage.remaining <= 0;

  const run = async (output) => {
    setBusy(output);
    setActionError(null);
    setResult(null);
    const body = { template: template.slug, params: values, format, scale };
    try {
      if (output === "binary") {
        const { blob } = await apiBlob("/render", body);
        download(blob, `${template.slug}.${format === "jpeg" ? "jpg" : format}`);
      } else {
        setResult(await api("/render", { method: "POST", body: { ...body, output: "url" } }));
      }
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
      refresh();
    }
  };

  if (loadError) return <Alert>Could not load templates: {loadError.message}</Alert>;
  if (!templates) {
    return (
      <div className="grid place-items-center py-24 text-zinc-400">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Turn templates into images, instantly.</h1>
        <p className="mt-2 text-zinc-500">
          Pick a template, fill in the fields, download a PNG/JPEG/SVG — or call the same thing from the API.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)_340px]">
        <aside className="min-w-0">
          <TemplatePicker templates={templates} selected={slug} onSelect={(s) => setSearchParams({ t: s })} />
        </aside>

        <section className="min-w-0 space-y-3">
          <Card className="checkerboard relative grid min-h-[420px] place-items-center overflow-hidden p-6">
            {preview.url && (
              <img
                src={preview.url}
                alt={`${template?.name} preview`}
                className={cx("max-h-[70vh] max-w-full object-contain transition-opacity", preview.loading && "opacity-60")}
              />
            )}
            {preview.loading && !preview.url && <Spinner className="size-6 text-zinc-400" />}
            {preview.loading && preview.url && (
              <Spinner className="absolute top-3 right-3 size-5 text-zinc-500" />
            )}
          </Card>
          {preview.error && !preview.error.details?.length && <Alert>{preview.error.message}</Alert>}
          <p className="text-xs text-zinc-500">
            Preview is watermarked. {template?.width}×{template?.height ?? "auto"} px · {template?.description}
          </p>
        </section>

        <aside className="min-w-0 space-y-4">
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">{template?.name}</h2>
              {template?.isPremium && <Badge tone="amber">Premium</Badge>}
            </div>
            {template && <ParamForm params={template.params} values={values} onChange={setValues} errors={errors} />}
          </Card>

          <Card className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Format">
                <Select value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="svg">SVG</option>
                </Select>
              </Field>
              <Field label="Scale">
                <Select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
                  {[1, 2, 3, 4].map((s) => (
                    <option key={s} value={s} disabled={s > (limits?.maxScale ?? 1)}>
                      {s}x{s > (limits?.maxScale ?? 1) ? " (upgrade)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {locked ? (
              <Alert tone="amber">
                This is a premium template.{" "}
                <Link to={user ? "/pricing" : "/register"} className="font-medium underline">
                  {user ? "Upgrade your plan" : "Create an account"}
                </Link>{" "}
                to render it.
              </Alert>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => run("binary")} loading={busy === "binary"} disabled={!!busy || outOfQuota}>
                  Download
                </Button>
                <Button variant="secondary" onClick={() => run("url")} loading={busy === "url"} disabled={!!busy || outOfQuota}>
                  Get link
                </Button>
              </div>
            )}

            {actionError && !actionError.details?.length && <Alert>{actionError.message}</Alert>}
            {result && (
              <div className="space-y-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800/50">
                <a href={result.url} target="_blank" rel="noreferrer" className="block truncate text-violet-600 hover:underline dark:text-violet-400">
                  {result.url}
                </a>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Expires {new Date(result.expiresAt).toLocaleString()}</span>
                  <CopyButton text={result.url} />
                </div>
              </div>
            )}

            {usage && (
              <div className="space-y-1.5 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
                <div className="flex justify-between">
                  <span>{user ? "Renders this month" : "Free renders today"}</span>
                  <span>
                    {formatNumber(usage.used)} / {formatNumber(usage.limit)}
                  </span>
                </div>
                <UsageBar used={usage.used} limit={usage.limit} />
                {!user && (
                  <p>
                    Guest images are watermarked.{" "}
                    <Link to="/register" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
                      Sign up free
                    </Link>{" "}
                    for more renders without a watermark.
                  </p>
                )}
              </div>
            )}
          </Card>

          {template && <ApiSnippet slug={template.slug} values={values} format={format} scale={scale} />}
        </aside>
      </div>
    </div>
  );
}
