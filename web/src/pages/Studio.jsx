import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import ParamForm, { defaultValues } from "../components/ParamForm.jsx";
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  EmptyState,
  Icon,
  SegmentedControl,
  Select,
  Skeleton,
  Spinner,
  Tabs,
  UsageBar,
  cx,
  useToast,
} from "../components/ui.jsx";
import { api, apiBlob, formatNumber } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { makeThumbnail, timeAgo, useRecentRenders } from "../lib/history.js";
import { fieldErrors, usePreview } from "../lib/usePreview.js";

const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3];
const FORMATS = [
  { value: "png", label: "PNG", description: "Lossless, supports transparency" },
  { value: "jpeg", label: "JPEG", description: "Smaller files, no transparency" },
  { value: "svg", label: "SVG", description: "Vector output" },
];
const BACKGROUNDS = [
  { value: "checker", label: "Transparent", icon: "grid" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
];
const CANVAS_BG = {
  checker: "checkerboard",
  light: "bg-white",
  dark: "bg-zinc-900",
};

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const MOD_KEY = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

function download(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Template browser

function TemplateCard({ template, selected, onSelect, showPremium }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template.slug)}
      aria-pressed={selected}
      className={cx(
        "group relative flex w-40 shrink-0 flex-col rounded-xl p-1.5 text-left ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 lg:w-full",
        selected
          ? "bg-violet-50 ring-2 ring-violet-500 dark:bg-violet-500/10"
          : "bg-white ring-zinc-200 hover:ring-zinc-300 hover:shadow-md hover:shadow-zinc-900/5 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-700",
      )}
    >
      {/* Fixed 4:3 frame; the whole thumbnail stays visible whatever the template's aspect ratio. */}
      <div className="flex aspect-[4/3] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 p-2.5 dark:bg-zinc-800/70">
        <img
          src={`/api/v1/templates/${template.slug}/thumbnail.png?v=${template.version}`}
          alt=""
          loading="lazy"
          className="max-h-full max-w-full rounded-[3px] object-contain shadow-sm ring-1 ring-zinc-900/5 transition duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex min-w-0 items-center gap-1.5 px-1 pt-2 pb-0.5">
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{template.name}</span>
        {showPremium && template.isPremium && <Badge tone="amber">Pro</Badge>}
      </div>
      {selected && (
        <span className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-violet-600 text-white shadow ring-2 ring-white dark:ring-zinc-900">
          <Icon name="check" className="size-3" />
        </span>
      )}
    </button>
  );
}

function TemplateBrowser({ templates, selected, onSelect, showPremium }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const categories = useMemo(() => ["all", ...new Set(templates.map((t) => t.category))], [templates]);
  const filtered = templates.filter(
    (t) =>
      (category === "all" || t.category === category) &&
      `${t.name} ${t.category} ${t.slug}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 p-4 pb-3">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            className="w-full rounded-lg border-0 bg-zinc-100 py-2 pr-3 pl-9 text-sm placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-violet-500 focus:outline-none dark:bg-zinc-800/80 dark:focus:bg-zinc-900 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1.5rem),transparent)]" role="group" aria-label="Filter by category">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cx(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                category === c
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700",
              )}
            >
              {c === "all" ? "All" : titleCase(c)}
            </button>
          ))}
        </div>
      </div>
      {/* Desktop: scrolling 2-column grid. Mobile: horizontal strip. */}
      <div className="flex gap-2.5 overflow-x-auto px-4 pt-1 pb-4 lg:grid lg:min-h-0 lg:flex-1 lg:auto-rows-max lg:grid-cols-2 lg:content-start lg:overflow-x-visible lg:overflow-y-auto">
        {filtered.map((t) => (
          <TemplateCard key={t.slug} template={t} selected={t.slug === selected} onSelect={onSelect} showPremium={showPremium} />
        ))}
        {filtered.length === 0 && <p className="col-span-2 py-6 text-center text-sm text-zinc-500">No templates match.</p>}
      </div>
    </div>
  );
}

function RecentRenders({ entries, templates, onRestore, onRemove, onClear }) {
  if (!entries.length) {
    return (
      <div className="px-4 pb-4">
        <EmptyState
          icon="history"
          title="No renders yet"
          description="Images you download or share appear here, so you can reopen them with the same settings."
        />
      </div>
    );
  }
  const names = Object.fromEntries((templates || []).map((t) => [t.slug, t.name]));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pb-2 text-xs text-zinc-500">
        <span>Stored in this browser only</span>
        <button type="button" onClick={onClear} className="rounded px-1 font-medium hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          Clear all
        </button>
      </div>
      <ul className="flex gap-2.5 overflow-x-auto px-4 pt-1 pb-4 lg:grid lg:min-h-0 lg:flex-1 lg:auto-rows-max lg:grid-cols-2 lg:content-start lg:overflow-x-visible lg:overflow-y-auto">
        {entries.map((entry) => {
          const linkAlive = entry.url && new Date(entry.expiresAt) > new Date();
          return (
            <li key={entry.id} className="group relative w-40 shrink-0 lg:w-full">
              <button
                type="button"
                onClick={() => onRestore(entry)}
                className="flex w-full flex-col rounded-xl bg-white p-1.5 text-left ring-1 ring-zinc-200 transition hover:shadow-md hover:shadow-zinc-900/5 hover:ring-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-700"
              >
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800/70">
                  {entry.thumb ? (
                    <img src={entry.thumb} alt="" className="max-h-full max-w-full rounded-[3px] object-contain shadow-sm" />
                  ) : (
                    <Icon name="image" className="size-6 text-zinc-400" />
                  )}
                </div>
                <span className="truncate px-1 pt-2 text-xs font-medium">{names[entry.slug] || entry.slug}</span>
                <span className="px-1 pb-0.5 text-[11px] text-zinc-500">
                  {entry.format.toUpperCase()}
                  {entry.scale > 1 && ` · ${entry.scale}x`} · {timeAgo(entry.at)}
                </span>
              </button>
              <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                {linkAlive && (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open shared link"
                    className="grid size-6 place-items-center rounded-md bg-white/90 text-zinc-700 shadow ring-1 ring-zinc-200 hover:text-violet-600 dark:bg-zinc-900/90 dark:text-zinc-200 dark:ring-zinc-700"
                  >
                    <Icon name="external" className="size-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(entry.id)}
                  aria-label="Remove from recent renders"
                  className="grid size-6 place-items-center rounded-md bg-white/90 text-zinc-700 shadow ring-1 ring-zinc-200 hover:text-red-600 dark:bg-zinc-900/90 dark:text-zinc-200 dark:ring-zinc-700"
                >
                  <Icon name="x" className="size-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canvas

function Canvas({ template, preview, showPremium }) {
  const [zoom, setZoom] = useState("fit");
  const [background, setBackground] = useState("checker");
  const [natural, setNatural] = useState(null);

  useEffect(() => setZoom("fit"), [template?.slug]);

  const current = zoom === "fit" ? null : zoom;
  const stepZoom = (direction) => {
    const base = current ?? 1;
    const next = direction > 0 ? ZOOM_STEPS.find((z) => z > base + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < base - 0.001);
    if (next) setZoom(next);
  };

  const toolButton =
    "grid size-7 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-white";

  return (
    <div className="flex h-full min-h-[300px] flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-semibold">{template?.name}</h1>
          {template && (
            <span className="hidden rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500 sm:inline dark:bg-zinc-800">
              {template.width}×{template.height ?? "auto"}
            </span>
          )}
          {showPremium && template?.isPremium && <Badge tone="amber">Premium</Badge>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <SegmentedControl aria-label="Canvas background" iconOnly options={BACKGROUNDS} value={background} onChange={setBackground} />
          <div className="hidden items-center rounded-lg ring-1 ring-zinc-200 sm:flex dark:ring-zinc-800">
            <button type="button" className={toolButton} aria-label="Zoom out" onClick={() => stepZoom(-1)} disabled={current !== null && current <= ZOOM_STEPS[0]}>
              <Icon name="zoomOut" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(zoom === "fit" ? 1 : "fit")}
              aria-label={zoom === "fit" ? "Show at 100%" : "Fit to screen"}
              className="w-12 rounded-md py-1 text-center text-xs font-medium tabular-nums hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-zinc-800"
            >
              {zoom === "fit" ? "Fit" : `${Math.round(zoom * 100)}%`}
            </button>
            <button type="button" className={toolButton} aria-label="Zoom in" onClick={() => stepZoom(1)} disabled={current !== null && current >= ZOOM_STEPS.at(-1)}>
              <Icon name="zoomIn" />
            </button>
          </div>
        </div>
      </div>

      <div className={cx("relative min-h-0 flex-1 overflow-auto", CANVAS_BG[background])}>
        <div className={cx("flex h-full min-w-full items-center justify-center p-4 sm:p-10", zoom !== "fit" && "h-auto min-h-full w-max")}>
          {preview.url ? (
            <img
              src={preview.url}
              alt={`${template?.name} preview`}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              style={zoom === "fit" || !natural ? undefined : { width: natural.w * zoom, maxWidth: "none" }}
              className={cx(
                "rounded-sm shadow-xl shadow-zinc-900/10 transition-opacity dark:shadow-black/40",
                zoom === "fit" && "max-h-full max-w-full object-contain",
                preview.loading && "opacity-60",
              )}
            />
          ) : (
            preview.loading && <Skeleton className="aspect-video w-full max-w-md" />
          )}
        </div>
        {preview.loading && preview.url && (
          <div className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-zinc-600 shadow-sm ring-1 ring-zinc-200 backdrop-blur dark:bg-zinc-900/90 dark:text-zinc-300 dark:ring-zinc-800">
            <Spinner className="size-3.5" /> Rendering
          </div>
        )}
        {preview.error && !preview.error.details?.length && (
          <div className="absolute inset-x-4 top-4 mx-auto max-w-md">
            <Alert>{preview.error.message}</Alert>
          </div>
        )}
        <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-zinc-900/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
          Preview · watermarked
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspector

function ApiPanel({ slug, values, format, scale, pricing }) {
  const origin = window.location.origin;
  // Uploaded images are too large for a URL; leave them out of the snippet.
  const params = Object.fromEntries(Object.entries(values).filter(([, v]) => !String(v).startsWith("data:")));
  const body = JSON.stringify({ template: slug, format, scale, params }, null, 2);
  const auth = pricing ? `\n  -H "Authorization: Bearer YOUR_API_KEY" \\` : "";
  const curl = `curl -X POST ${origin}/api/v1/render \\${auth}
  -H "Content-Type: application/json" \\
  -d '${body.replaceAll("'", "'\\''")}' \\
  -o image.${format === "jpeg" ? "jpg" : format}`;
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">
        Render this exact image from your code.{" "}
        {pricing ? "Create a key in your dashboard." : "No API key needed — the free API allows a few images per minute per IP."}
      </p>
      <pre className="overflow-x-auto rounded-xl bg-zinc-950 p-3.5 text-[11px] leading-relaxed text-zinc-100 ring-1 ring-zinc-800">{curl}</pre>
      <div className="flex gap-2">
        <CopyButton text={curl} label="Copy cURL" />
        <Link to="/docs" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-500/10">
          API docs <Icon name="chevronRight" className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function UsageMeter({ usage, user }) {
  if (!usage) return null;
  if (usage.period === "minute") {
    return (
      <div className="space-y-1.5 text-xs text-zinc-500">
        <div className="flex justify-between">
          <span>Free · {usage.limit} images per minute</span>
          <span className="tabular-nums">{formatNumber(usage.remaining)} left</span>
        </div>
        <UsageBar used={usage.used} limit={usage.limit} />
      </div>
    );
  }
  return (
    <div className="space-y-1.5 text-xs text-zinc-500">
      <div className="flex justify-between">
        <span>{user ? "Renders this month" : "Free renders today"}</span>
        <span className="tabular-nums">
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
          to remove it.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function Studio() {
  const { session, user, refresh, pricing } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [templates, setTemplates] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [values, setValues] = useState({});
  const [format, setFormat] = useState("png");
  const [scale, setScale] = useState(1);
  const [panel, setPanel] = useState("customize");
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [sidebar, setSidebar] = useState("templates");
  const recent = useRecentRenders();
  const addRecent = recent.add;
  // A recent render waiting for its template to load before its settings are applied.
  const pendingRestore = useRef(null);

  useEffect(() => {
    api("/templates").then(setTemplates).catch(setLoadError);
  }, []);

  const slug = searchParams.get("t") || templates?.[0]?.slug;
  const template = useMemo(() => templates?.find((t) => t.slug === slug), [templates, slug]);

  const applyEntry = useCallback((tpl, entry) => {
    // Keep only params the template still has; new ones fall back to their defaults.
    const saved = Object.fromEntries(Object.entries(entry.params).filter(([k]) => Object.hasOwn(tpl.params, k)));
    setValues({ ...defaultValues(tpl.params), ...saved });
    setFormat(entry.format);
    setScale(entry.scale);
  }, []);

  useEffect(() => {
    if (!template) return;
    const entry = pendingRestore.current;
    pendingRestore.current = null;
    if (entry?.slug === template.slug) applyEntry(template, entry);
    else setValues(defaultValues(template.params));
    setResult(null);
    setActionError(null);
  }, [template, applyEntry]);

  const restore = (entry) => {
    const target = templates?.find((t) => t.slug === entry.slug);
    if (!target) {
      toast({ title: "Template no longer available", tone: "error" });
      return;
    }
    if (target === template) applyEntry(target, entry);
    else {
      pendingRestore.current = entry;
      setSearchParams({ t: entry.slug });
    }
    setPanel("customize");
    if (entry.droppedUploads) toast({ title: "Settings restored", description: "Uploaded images aren't kept; upload them again." });
    else toast({ title: "Settings restored" });
  };

  const previewBody = template && Object.keys(values).length ? { template: template.slug, params: values } : null;
  const preview = usePreview(previewBody);
  const errors = fieldErrors(actionError ?? preview.error);

  const limits = session?.limits;
  const usage = session?.usage;
  const locked = template?.isPremium && !limits?.premiumTemplates;
  // The per-minute free limit refills by itself, so only monthly/daily quotas disable rendering.
  const outOfQuota = pricing && usage && usage.limit !== null && usage.remaining <= 0;
  const disabled = Boolean(busy) || outOfQuota || locked;

  const run = useCallback(
    async (output) => {
      if (!template) return;
      setBusy(output);
      setActionError(null);
      const body = { template: template.slug, params: values, format, scale };
      try {
        if (output === "binary") {
          const { blob } = await apiBlob("/render", body);
          const name = `${template.slug}.${format === "jpeg" ? "jpg" : format}`;
          download(blob, name);
          toast({ title: "Image downloaded", description: name });
          addRecent({ slug: template.slug, params: values, format, scale, thumb: await makeThumbnail(blob) });
        } else {
          const created = await api("/render", { method: "POST", body: { ...body, output: "url" } });
          setResult(created);
          toast({ title: "Shareable link ready", description: `Valid until ${new Date(created.expiresAt).toLocaleString()}` });
          addRecent({
            slug: template.slug,
            params: values,
            format,
            scale,
            url: created.url,
            expiresAt: created.expiresAt,
            thumb: await makeThumbnail(created.url),
          });
        }
      } catch (err) {
        setActionError(err);
        if (err.details?.length) {
          setPanel("customize");
          toast({ title: "Check the highlighted fields", tone: "error" });
        } else {
          toast({ title: err.status === 429 ? "Slow down a little" : "Render failed", description: err.message, tone: "error" });
        }
      } finally {
        setBusy(null);
        refresh();
      }
    },
    [template, values, format, scale, toast, refresh, addRecent],
  );

  // Cmd/Ctrl + Enter downloads.
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !disabled) {
        e.preventDefault();
        run("binary");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [run, disabled]);

  if (loadError) {
    return (
      <EmptyState icon="alert" title="Could not load templates" description={loadError.message} action={<Button onClick={() => window.location.reload()}>Try again</Button>} />
    );
  }

  return (
    <div className="pb-32 lg:grid lg:h-full lg:grid-cols-[19rem_minmax(0,1fr)_22rem] lg:overflow-hidden lg:pb-0">
      {/* Templates */}
      <aside aria-label="Templates" className="border-b border-zinc-200 bg-white lg:min-h-0 lg:border-r lg:border-b-0 dark:border-zinc-800 dark:bg-zinc-950">
        {templates ? (
          <div className="flex h-full flex-col">
            <div className="px-4 pt-4">
              <SegmentedControl
                aria-label="Sidebar"
                value={sidebar}
                onChange={setSidebar}
                className="flex w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:py-1.5"
                options={[
                  { value: "templates", label: `Templates · ${templates.length}`, icon: "layout" },
                  { value: "recent", label: `Recent · ${recent.entries.length}`, icon: "history" },
                ]}
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col pt-1">
              {sidebar === "templates" ? (
                <TemplateBrowser templates={templates} selected={slug} onSelect={(s) => setSearchParams({ t: s })} showPremium={pricing} />
              ) : (
                <RecentRenders
                  entries={recent.entries}
                  templates={templates}
                  onRestore={restore}
                  onRemove={recent.remove}
                  onClear={recent.clear}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-9 w-full" />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Canvas */}
      <section aria-label="Preview" className="h-[46vh] min-w-0 bg-zinc-50 lg:h-auto lg:min-h-0 dark:bg-zinc-900/40">
        <Canvas template={template} preview={preview} showPremium={pricing} />
      </section>

      {/* Inspector */}
      <aside
        aria-label="Inspector"
        className="flex min-w-0 flex-col border-t border-zinc-200 bg-white lg:min-h-0 lg:border-t-0 lg:border-l dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 pt-2 dark:border-zinc-800">
          <Tabs
            bordered={false}
            aria-label="Inspector"
            tabs={[
              { id: "customize", label: "Customize" },
              { id: "api", label: "API" },
            ]}
            value={panel}
            onChange={setPanel}
          />
          {panel === "customize" && template && (
            <button
              type="button"
              onClick={() => {
                setValues(defaultValues(template.params));
                setActionError(null);
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <Icon name="reset" className="size-3.5" /> Reset
            </button>
          )}
        </div>

        <div role="tabpanel" className="p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {!template ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : panel === "customize" ? (
            <ParamForm params={template.params} values={values} onChange={setValues} errors={errors} />
          ) : (
            <ApiPanel slug={template.slug} values={values} format={format} scale={scale} pricing={pricing} />
          )}
        </div>

        {/* Actions: fixed to the bottom of the screen on mobile, pinned to the panel on desktop. */}
        <div className="fixed inset-x-0 bottom-0 z-20 space-y-2 border-t border-zinc-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.15)] backdrop-blur lg:static lg:space-y-3 lg:p-4 lg:shadow-none dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="grid grid-cols-2 gap-2">
            <Select aria-label="Format" value={format} onChange={setFormat} options={FORMATS} size="sm" />
            <Select
              aria-label="Scale"
              size="sm"
              value={scale}
              onChange={setScale}
              options={[1, 2, 3, 4].map((s) => {
                const isLocked = s > (limits?.maxScale ?? 1);
                return { value: s, label: `${s}x scale`, description: isLocked ? "Upgrade to unlock" : undefined, disabled: isLocked };
              })}
            />
          </div>

          {locked ? (
            <Alert tone="amber">
              Premium template.{" "}
              <Link to={user ? "/pricing" : "/register"} className="font-medium underline">
                {user ? "Upgrade your plan" : "Create an account"}
              </Link>{" "}
              to render it.
            </Alert>
          ) : (
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button onClick={() => run("binary")} loading={busy === "binary"} disabled={disabled}>
                {busy !== "binary" && <Icon name="download" />}
                Download
                <kbd className="ml-1 hidden rounded bg-white/20 px-1 font-sans text-[10px] font-medium lg:inline">{MOD_KEY}↵</kbd>
              </Button>
              <Button variant="secondary" onClick={() => run("url")} loading={busy === "url"} disabled={disabled} aria-label="Create shareable link">
                {busy !== "url" && <Icon name="link" />}
                Link
              </Button>
            </div>
          )}

        </div>

        <div className="space-y-3 px-4 pb-4 empty:hidden lg:order-last">
          {result && (
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-2 pl-3 text-xs ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <a href={result.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-violet-600 hover:underline dark:text-violet-400">
                {result.url.replace(/^https?:\/\//, "")}
              </a>
              <CopyButton text={result.url} />
            </div>
          )}
          {outOfQuota && <Alert tone="amber">You've used all your renders for this period.</Alert>}
          <UsageMeter usage={usage} user={user} />
        </div>
      </aside>
    </div>
  );
}
