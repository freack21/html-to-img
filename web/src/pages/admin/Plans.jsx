import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, NumberInput, PageHeader, Toggle, useConfirm } from "../../components/ui.jsx";
import { api, formatNumber, formatPrice } from "../../lib/api.js";
import { fieldErrors } from "../../lib/usePreview.js";

const BLANK = {
  slug: "",
  name: "",
  description: "",
  price: 0,
  monthlyQuota: 100,
  maxScale: 1,
  retentionHours: 24,
  watermark: false,
  apiAccess: true,
  premiumTemplates: false,
  isDefault: false,
  isActive: true,
  sortOrder: 0,
};

function PlanForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const errors = fieldErrors(error);

  const num = (key, nullable = false) => ({
    value: form[key] ?? "",
    onChange: (v) => setForm({ ...form, [key]: v === "" ? (nullable ? null : 0) : v }),
  });
  const text = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });
  const flag = (key, label) => <Toggle checked={form[key]} onChange={(v) => setForm({ ...form, [key]: v })} label={label} />;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const { id, ...body } = form;
    try {
      await api(id ? `/admin/plans/${id}` : "/admin/plans", { method: id ? "PATCH" : "POST", body });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && !error.details.length && <Alert>{error.message}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" error={errors.name}><Input {...text("name")} required /></Field>
          <Field label="Slug" error={errors.slug}><Input {...text("slug")} className="font-mono" required /></Field>
          <Field label="Price (IDR / month)" error={errors.price}><NumberInput {...num("price")} min={0} /></Field>
          <Field label="Monthly quota" hint="Empty = unlimited" error={errors.monthlyQuota}><NumberInput {...num("monthlyQuota", true)} min={0} /></Field>
          <Field label="Max scale" error={errors.maxScale}><NumberInput {...num("maxScale")} min={1} max={4} /></Field>
          <Field label="Link retention (hours)" error={errors.retentionHours}><NumberInput {...num("retentionHours")} min={1} /></Field>
          <Field label="Sort order" error={errors.sortOrder}><NumberInput {...num("sortOrder")} /></Field>
          <Field label="Description" className="sm:col-span-2 lg:col-span-4" error={errors.description}><Input {...text("description")} /></Field>
        </div>
        <div className="flex flex-wrap gap-6">
          {flag("watermark", "Watermark")}
          {flag("apiAccess", "API access")}
          {flag("premiumTemplates", "Premium templates")}
          {flag("isDefault", "Default for new users")}
          {flag("isActive", "Visible on pricing")}
        </div>
        <div className="flex gap-2">
          <Button type="submit" loading={saving}>Save plan</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

export default function Plans() {
  const confirm = useConfirm();
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => api("/admin/plans").then(setPlans).catch(setError), []);
  useEffect(() => {
    load();
  }, [load]);

  const remove = async (plan) => {
    const ok = await confirm({
      title: `Delete plan "${plan.name}"?`,
      description: "Plans that still have users or are the default can't be deleted.",
      confirmLabel: "Delete plan",
      tone: "danger",
    });
    if (!ok) return;
    setError(null);
    await api(`/admin/plans/${plan.id}`, { method: "DELETE" }).catch(setError);
    load();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Plans"
        description="Quotas and limits per plan. Payment integration comes later; assign plans from Users for now."
        actions={!editing && <Button onClick={() => setEditing(BLANK)}>New plan</Button>}
      />
      {error && <Alert>{error.message}</Alert>}
      {editing && (
        <PlanForm
          key={editing.id ?? "new"}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Quota</th>
              <th className="px-4 py-2">Scale</th>
              <th className="px-4 py-2">Retention</th>
              <th className="px-4 py-2">Features</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2">
                  <p className="font-medium">
                    {p.name} {p.isDefault && <Badge tone="violet">default</Badge>} {!p.isActive && <Badge>hidden</Badge>}
                  </p>
                  <p className="font-mono text-xs text-zinc-500">{p.slug}</p>
                </td>
                <td className="px-4 py-2">{formatPrice(p.price)}</td>
                <td className="px-4 py-2 tabular-nums">{formatNumber(p.monthlyQuota)}</td>
                <td className="px-4 py-2">{p.maxScale}x</td>
                <td className="px-4 py-2">{p.retentionHours} h</td>
                <td className="space-x-1 px-4 py-2">
                  {p.watermark && <Badge tone="amber">watermark</Badge>}
                  {p.apiAccess && <Badge>API</Badge>}
                  {p.premiumTemplates && <Badge tone="green">premium</Badge>}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => remove(p)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
