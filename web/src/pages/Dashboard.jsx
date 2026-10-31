import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Alert, Badge, Button, Card, CopyButton, EmptyState, Field, Icon, Input, PageHeader, PasswordInput, Tabs, UsageBar, useConfirm, useToast } from "../components/ui.jsx";
import { api, formatBytes, formatDate, formatNumber, formatPrice } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { fieldErrors } from "../lib/usePreview.js";

function StatCard({ icon, label, value, hint, children }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <span className="grid size-8 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
          <Icon name={icon} className="size-4" />
        </span>
        {label}
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
      {children}
    </Card>
  );
}

function FreeOverview() {
  const { session } = useAuth();
  const { usage, limits } = session;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="sparkles" label="Access" value="Free" hint="No plan, quota or API key needed" />
        <StatCard icon="zap" label="Rate limit" value={`${usage.limit} / min`} hint="Images per IP in any 60 seconds" />
        <StatCard icon="image" label="Left this minute" value={formatNumber(usage.remaining)}>
          <div className="mt-3">
            <UsageBar used={usage.used} limit={usage.limit} />
          </div>
        </StatCard>
        <StatCard icon="history" label="Link retention" value={`${limits.retentionHours} h`} hint="Hosted image links expire after this" />
      </div>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <p className="text-sm text-zinc-500">Every template is available, without watermarks, from the studio or the API.</p>
        <div className="flex gap-2">
          <Link to="/studio" className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-violet-500">
            <Icon name="layout" /> Open studio
          </Link>
          <Link to="/docs" className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-50 dark:ring-zinc-700 dark:hover:bg-zinc-800">
            API docs
          </Link>
        </div>
      </Card>
    </div>
  );
}

function Overview() {
  const { session, pricing } = useAuth();
  const { plan, usage, limits } = session;
  if (!pricing) return <FreeOverview />;
  const pct = usage.limit ? Math.round((usage.used / usage.limit) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="image" label="Renders this month" value={formatNumber(usage.used)} hint={usage.limit === null ? "Unlimited plan" : `${pct}% of ${formatNumber(usage.limit)}`}>
          <div className="mt-3">
            <UsageBar used={usage.used} limit={usage.limit} />
          </div>
        </StatCard>
        <StatCard icon="zap" label="Remaining" value={formatNumber(usage.remaining)} hint={`Resets ${formatDate(usage.resetsAt)}`} />
        <StatCard icon="maximize" label="Max resolution" value={`${limits.maxScale}×`} hint={limits.premiumTemplates ? "Premium templates included" : "Standard templates"} />
        <StatCard icon="history" label="Link retention" value={`${limits.retentionHours} h`} hint="Hosted image links expire after this" />
      </div>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <Badge tone="violet">{plan.name}</Badge>
          <p className="text-sm text-zinc-500">
            {formatPrice(plan.price)}
            {plan.price > 0 && " / month"} · {plan.description}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/studio" className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-violet-500">
            <Icon name="layout" /> Open studio
          </Link>
          <Link to="/pricing" className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-50 dark:ring-zinc-700 dark:hover:bg-zinc-800">
            Compare plans
          </Link>
        </div>
      </Card>
    </div>
  );
}

function History() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/me/renders?page=${page}&pageSize=15`).then(setData).catch(setError);
  }, [page]);

  if (error) return <Alert>{error.message}</Alert>;
  if (!data) return null;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-2">Template</th>
              <th className="px-4 py-2">Output</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {data.items.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium">{r.template}</td>
                <td className="px-4 py-2 text-zinc-500">
                  {r.format.toUpperCase()} · {r.width}×{r.height} · {formatBytes(r.bytes)}
                </td>
                <td className="px-4 py-2">
                  <Badge tone={r.source === "api" ? "violet" : "zinc"}>{r.source}</Badge>
                </td>
                <td className="px-4 py-2 text-zinc-500">{formatDate(r.createdAt)}</td>
                <td className="px-4 py-2">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-violet-600 hover:underline dark:text-violet-400">
                      Open
                    </a>
                  ) : (
                    <span className="text-zinc-400">{r.expiresAt ? "Expired" : "Downloaded"}</span>
                  )}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    icon="image"
                    title="No renders yet"
                    description="Images you download or share from the studio or the API will show up here."
                    action={
                      <Link to="/studio" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
                        Open the studio
                      </Link>
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Previous
          </Button>
          <span className="text-zinc-500">
            Page {page} of {pages}
          </span>
          <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next →
          </Button>
        </div>
      )}
    </Card>
  );
}

function ApiKeys() {
  const confirm = useConfirm();
  const { session } = useAuth();
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState("");
  const [created, setCreated] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => api("/me/api-keys").then(setKeys).catch(setError), []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      setCreated(await api("/me/api-keys", { method: "POST", body: { name } }));
      setName("");
      load();
    } catch (err) {
      setError(err);
    }
  };

  const revoke = async (id) => {
    const ok = await confirm({
      title: "Revoke this API key?",
      description: "Apps using it will stop working immediately.",
      confirmLabel: "Revoke key",
      tone: "danger",
    });
    if (!ok) return;
    await api(`/me/api-keys/${id}`, { method: "DELETE" }).catch(setError);
    load();
  };

  return (
    <div className="space-y-4">
      {!session.plan.apiAccess && <Alert tone="amber">Your plan does not include API access.</Alert>}
      <Card className="p-5">
        <form onSubmit={create} noValidate className="flex flex-wrap items-end gap-3">
          <Field label="New key name" className="min-w-48 flex-1" error={fieldErrors(error).name}>
            <Input placeholder="e.g. whatsapp-bot" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
          <Button type="submit">Create key</Button>
        </form>
        {error && !error.details?.length && <div className="mt-3"><Alert>{error.message}</Alert></div>}
        {created && (
          <div className="mt-4 space-y-2">
            <Alert tone="green">Copy your key now — it will not be shown again.</Alert>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-zinc-100 px-3 py-2 font-mono text-xs dark:bg-zinc-800">{created.key}</code>
              <CopyButton text={created.key} />
            </div>
          </div>
        )}
      </Card>
      <Card className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {keys.map((k) => (
          <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <div>
              <p className="font-medium">
                {k.name} {k.revokedAt && <Badge tone="red">revoked</Badge>}
              </p>
              <p className="font-mono text-xs text-zinc-500">{k.prefix}…</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span>Last used {formatDate(k.lastUsedAt)}</span>
              {!k.revokedAt && (
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => revoke(k.id)}>
                  Revoke
                </Button>
              )}
            </div>
          </div>
        ))}
        {keys.length === 0 && <EmptyState icon="key" title="No API keys yet" description="Create a key above to call the render API from your app or bot." />}
      </Card>
    </div>
  );
}

function Account() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [error, setError] = useState(null);

  const submit = (action, success) => async (event) => {
    event.preventDefault();
    setError(null);
    try {
      await action();
      toast({ title: success });
      refresh();
    } catch (err) {
      setError(err);
    }
  };
  const errors = fieldErrors(error);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3 md:col-span-2">
        {error && !error.details.length && <Alert>{error.message}</Alert>}
      </div>
      <Card className="p-5">
        <form onSubmit={submit(() => api("/me", { method: "PATCH", body: { name } }), "Profile updated.")} noValidate className="space-y-4">
          <h2 className="font-semibold">Profile</h2>
          <Field label="Email">
            <Input value={user.email} disabled />
          </Field>
          <Field label="Name" error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit">Save</Button>
        </form>
      </Card>
      <Card className="p-5">
        <form
          onSubmit={submit(async () => {
            await api("/me/password", { method: "POST", body: passwords });
            setPasswords({ currentPassword: "", newPassword: "" });
          }, "Password changed.")}
          noValidate
          className="space-y-4"
        >
          <h2 className="font-semibold">Password</h2>
          <Field label="Current password" error={errors.currentPassword}>
            <PasswordInput autoComplete="current-password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} />
          </Field>
          <Field label="New password" hint="At least 8 characters." error={errors.newPassword}>
            <PasswordInput autoComplete="new-password" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} />
          </Field>
          <Button type="submit">Change password</Button>
        </form>
      </Card>
    </div>
  );
}

const TABS = [
  { id: "overview", label: "Overview", Component: Overview },
  { id: "history", label: "History", Component: History },
  { id: "keys", label: "API keys", Component: ApiKeys },
  { id: "account", label: "Account", Component: Account },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const { Component } = TABS.find((t) => t.id === tab);
  return (
    <div>
      <PageHeader title={`Hi, ${user.name}`} description="Your usage, render history, API keys and account." />
      <Tabs aria-label="Dashboard sections" tabs={TABS} value={tab} onChange={setTab} className="mb-6" />
      <div role="tabpanel">
        <Component />
      </div>
    </div>
  );
}
