import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import ParamForm, { defaultValues } from "../../components/ParamForm.jsx";
import { Alert, Button, Card, Field, Input, PageHeader, Spinner, Textarea, Toggle, cx } from "../../components/ui.jsx";
import { api } from "../../lib/api.js";
import { usePreview } from "../../lib/usePreview.js";

const STARTER = {
  width: 600,
  params: {
    title: { type: "string", label: "Title", default: "Hello world", maxLength: 80 },
    accent: { type: "color", label: "Accent", default: "#7c3aed" },
  },
  root: {
    type: "box",
    style: { flexDirection: "column", padding: 40, backgroundColor: "{{accent}}", borderRadius: 24, fontFamily: "Inter" },
    children: [{ type: "text", text: "{{title}}", style: { fontSize: 48, fontWeight: 800, color: "#ffffff" } }],
  },
};

const EMPTY_META = { slug: "", name: "", description: "", category: "general", isActive: true, isPremium: false };

function Reference({ fonts }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-zinc-600 dark:text-zinc-400">Definition reference</summary>
      <div className="mt-2 space-y-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        <p>
          <strong>Nodes:</strong> <code>{`{ type: "box", style, children }`}</code>, <code>{`{ type: "text", text }`}</code>,{" "}
          <code>{`{ type: "image", src }`}</code>. Boxes are flex containers (Satori supports flexbox, not grid). Every node
          takes an optional <code>if</code>: <code>"param"</code>, <code>"!param"</code>, <code>"param == value"</code>,{" "}
          <code>"param != value"</code>.
        </p>
        <p>
          <strong>Values:</strong> <code>{"{{param}}"}</code> placeholders anywhere in text or style strings (a lone{" "}
          <code>{'"{{size}}"'}</code> keeps its number type), or{" "}
          <code>{`{ "$switch": "theme", "cases": { "dark": "#000" }, "default": "#fff" }`}</code>.
        </p>
        <p>
          <strong>Param types:</strong> string (maxLength, multiline), number (min, max), color, boolean, enum (options),
          image (URL or uploaded data URI).
        </p>
        <p>
          <strong>Styles:</strong> camelCase CSS. <code>url()</code> is not allowed — use an image node. Fonts:{" "}
          {fonts.join(", ")}. Emoji render as Twemoji.
        </p>
      </div>
    </details>
  );
}

export default function TemplateEditor() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const [meta, setMeta] = useState(EMPTY_META);
  const [source, setSource] = useState(isNew ? JSON.stringify(STARTER, null, 2) : "");
  const [values, setValues] = useState({});
  const [fonts, setFonts] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api("/admin/fonts").then(setFonts).catch(() => {});
    if (isNew) return;
    api(`/admin/templates/${id}`)
      .then((t) => {
        const { definition, slug, name, description, category, isActive, isPremium } = t;
        setMeta({ slug, name, description, category, isActive, isPremium });
        setSource(JSON.stringify(definition, null, 2));
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const parsed = useMemo(() => {
    try {
      return { definition: JSON.parse(source) };
    } catch (err) {
      return { error: err.message };
    }
  }, [source]);

  // Keep test values in sync with the param list while preserving edits.
  const paramsKey = JSON.stringify(parsed.definition?.params ?? {});
  useEffect(() => {
    const params = JSON.parse(paramsKey);
    setValues((current) => ({ ...defaultValues(params), ...Object.fromEntries(Object.entries(current).filter(([k]) => k in params)) }));
  }, [paramsKey]);

  const preview = usePreview(parsed.definition ? { definition: parsed.definition, params: values } : null, 500);

  const bindMeta = (key) => ({ value: meta[key], onChange: (e) => setMeta({ ...meta, [key]: e.target.value }) });

  const onKeyDown = (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const { selectionStart: start, selectionEnd: end, value } = event.target;
    const next = `${value.slice(0, start)}  ${value.slice(end)}`;
    setSource(next);
    requestAnimationFrame(() => event.target.setSelectionRange(start + 2, start + 2));
  };

  const save = async () => {
    if (!parsed.definition) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body = { ...meta, definition: parsed.definition };
      if (isNew) {
        const created = await api("/admin/templates", { method: "POST", body });
        navigate(`/admin/templates/${created.id}`, { replace: true });
      } else {
        await api(`/admin/templates/${id}`, { method: "PATCH", body });
      }
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  const params = parsed.definition?.params && typeof parsed.definition.params === "object" ? parsed.definition.params : {};

  return (
    <div className="space-y-4">
      <PageHeader
        title={isNew ? "New template" : meta.name || "Edit template"}
        description={<Link to="/admin/templates" className="hover:underline">← All templates</Link>}
        actions={
          <Button onClick={save} loading={saving} disabled={!parsed.definition}>
            {isNew ? "Create template" : "Save changes"}
          </Button>
        }
      />
      {saved && <Alert tone="green">Saved. The template is live.</Alert>}
      {error && (
        <Alert>
          {error.message}
          {error.details?.length > 0 && (
            <ul className="mt-1 list-disc pl-5 font-mono text-xs">
              {error.details.map((d, i) => (
                <li key={i}>
                  {d.path && <strong>{d.path}: </strong>}
                  {d.message}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name">
          <Input {...bindMeta("name")} />
        </Field>
        <Field label="Slug" hint="Used as the API template name.">
          <Input {...bindMeta("slug")} className="font-mono" />
        </Field>
        <Field label="Category">
          <Input {...bindMeta("category")} />
        </Field>
        <div className="flex items-end gap-6 pb-2">
          <Toggle checked={meta.isActive} onChange={(v) => setMeta({ ...meta, isActive: v })} label="Active" />
          <Toggle checked={meta.isPremium} onChange={(v) => setMeta({ ...meta, isPremium: v })} label="Premium" />
        </div>
        <Field label="Description" className="sm:col-span-2 lg:col-span-4">
          <Input {...bindMeta("description")} />
        </Field>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Definition (JSON)</h2>
            <Button variant="ghost" size="sm" disabled={!parsed.definition} onClick={() => setSource(JSON.stringify(parsed.definition, null, 2))}>
              Format
            </Button>
          </div>
          <Textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            className={cx("h-[560px] font-mono text-xs leading-relaxed", parsed.error && "ring-red-500")}
          />
          {parsed.error && <p className="text-xs text-red-600">JSON error: {parsed.error}</p>}
          <Reference fonts={fonts} />
        </div>

        <div className="space-y-4">
          <Card className="checkerboard relative grid min-h-[300px] place-items-center overflow-hidden p-4">
            {preview.url && <img src={preview.url} alt="Preview" className={cx("max-h-[480px] max-w-full object-contain", preview.loading && "opacity-60")} />}
            {preview.loading && <Spinner className="absolute top-3 right-3 size-5 text-zinc-500" />}
          </Card>
          {preview.error && (
            <Alert>
              {preview.error.message}
              {preview.error.details?.length > 0 && (
                <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                  {preview.error.details.slice(0, 8).map((d, i) => (
                    <li key={i}>
                      {d.path && <strong>{d.path}: </strong>}
                      {d.message}
                    </li>
                  ))}
                </ul>
              )}
            </Alert>
          )}
          {Object.keys(params).length > 0 && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold">Test params</h2>
              <ParamForm params={params} values={values} onChange={setValues} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
