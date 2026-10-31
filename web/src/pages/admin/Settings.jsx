import { useEffect, useState } from "react";
import { Alert, Button, Card, Field, Input, NumberInput, PageHeader, Spinner, Toggle, useToast } from "../../components/ui.jsx";
import { api } from "../../lib/api.js";
import { useAuth } from "../../lib/auth.jsx";
import { fieldErrors } from "../../lib/usePreview.js";

export default function Settings() {
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const toast = useToast();
  const { refresh } = useAuth();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/admin/settings").then(setForm).catch(setError);
  }, []);

  if (!form) return error ? <Alert>{error.message}</Alert> : <Spinner />;
  const errors = fieldErrors(error);
  const num = (key) => ({ value: form[key], onChange: (v) => setForm({ ...form, [key]: v === "" ? 0 : v }) });

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      setForm(await api("/admin/settings", { method: "PATCH", body: form }));
      toast({ title: "Settings saved." });
      refresh(); // pricing on/off changes navigation and studio behaviour
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" description="Access, pricing and global behaviour." />
      <form onSubmit={save} noValidate className="max-w-2xl space-y-4">
        {error && !error.details.length && <Alert>{error.message}</Alert>}
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold">Access &amp; pricing</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {form.pricingEnabled
                ? "Plans, quotas, premium templates and guest watermarks apply."
                : "Free mode: anyone can render without an account or API key, limited per IP per minute. Pricing pages are hidden."}
            </p>
          </div>
          <Toggle checked={form.pricingEnabled} onChange={(v) => setForm({ ...form, pricingEnabled: v })} label="Enable plans & pricing" />
          <div className="grid gap-4 sm:grid-cols-2">
            {!form.pricingEnabled && (
              <Field label="Free renders per IP per minute" hint="Rolling 60-second window" error={errors.freeRendersPerMinute}>
                <NumberInput {...num("freeRendersPerMinute")} min={1} max={600} />
              </Field>
            )}
            <Field label="Link retention for guests (hours)" hint="Also used for everyone in free mode" error={errors.guestRetentionHours}>
              <NumberInput {...num("guestRetentionHours")} min={1} />
            </Field>
          </div>
        </Card>
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Accounts</h2>
          <Toggle checked={form.registrationOpen} onChange={(v) => setForm({ ...form, registrationOpen: v })} label="Allow new sign-ups" />
          <Field label="Watermark text" error={errors.watermarkText}>
            <Input value={form.watermarkText} onChange={(e) => setForm({ ...form, watermarkText: e.target.value })} maxLength={40} />
          </Field>
        </Card>
        {form.pricingEnabled && (
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Guest mode</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Renders per IP per day" hint="0 disables guest renders" error={errors.guestDailyLimit}>
              <NumberInput {...num("guestDailyLimit")} min={0} />
            </Field>
            <Field label="Max scale" error={errors.guestMaxScale}>
              <NumberInput {...num("guestMaxScale")} min={1} max={4} />
            </Field>
          </div>
          <Toggle checked={form.guestWatermark} onChange={(v) => setForm({ ...form, guestWatermark: v })} label="Watermark guest images" />
        </Card>
        )}
        <Button type="submit" loading={saving}>Save settings</Button>
      </form>
    </div>
  );
}
