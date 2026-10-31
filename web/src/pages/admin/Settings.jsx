import { useEffect, useState } from "react";
import { Alert, Button, Card, Field, Input, NumberInput, PageHeader, Spinner, Toggle } from "../../components/ui.jsx";
import { api } from "../../lib/api.js";
import { fieldErrors } from "../../lib/usePreview.js";

export default function Settings() {
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
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
    setSaved(false);
    try {
      setForm(await api("/admin/settings", { method: "PATCH", body: form }));
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" description="Guest mode and global behaviour." />
      <form onSubmit={save} noValidate className="max-w-2xl space-y-4">
        {saved && <Alert tone="green">Settings saved.</Alert>}
        {error && !error.details.length && <Alert>{error.message}</Alert>}
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Accounts</h2>
          <Toggle checked={form.registrationOpen} onChange={(v) => setForm({ ...form, registrationOpen: v })} label="Allow new sign-ups" />
          <Field label="Watermark text" error={errors.watermarkText}>
            <Input value={form.watermarkText} onChange={(e) => setForm({ ...form, watermarkText: e.target.value })} maxLength={40} />
          </Field>
        </Card>
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Guest mode</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Renders per IP per day" hint="0 disables guest renders" error={errors.guestDailyLimit}>
              <NumberInput {...num("guestDailyLimit")} min={0} />
            </Field>
            <Field label="Max scale" error={errors.guestMaxScale}>
              <NumberInput {...num("guestMaxScale")} min={1} max={4} />
            </Field>
            <Field label="Link retention (hours)" error={errors.guestRetentionHours}>
              <NumberInput {...num("guestRetentionHours")} min={1} />
            </Field>
          </div>
          <Toggle checked={form.guestWatermark} onChange={(v) => setForm({ ...form, guestWatermark: v })} label="Watermark guest images" />
        </Card>
        <Button type="submit" loading={saving}>Save settings</Button>
      </form>
    </div>
  );
}
