import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Alert, Badge, Button, Card, CopyButton, Field, Input, PageHeader, UsageBar } from "../components/ui.jsx";
import { api, formatBytes, formatDate, formatNumber, formatPrice } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { fieldErrors } from "../lib/usePreview.js";

function Overview() {
  const { session } = useAuth();
  const { plan, usage, limits } = session;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-5 md:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Usage this month</h2>
          <span className="text-xs text-zinc-500">Resets {formatDate(usage.resetsAt)}</span>
        </div>
        <p className="mt-3 text-3xl font-semibold">
          {formatNumber(usage.used)}
          <span className="text-base font-normal text-zinc-500"> / {formatNumber(usage.limit)} renders</span>
        </p>
        <div className="mt-3">
          <UsageBar used={usage.used} limit={usage.limit} />
        </div>
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Plan</h2>
          <Badge tone="violet">{plan.name}</Badge>
        </div>
        <p className="mt-3 text-2xl font-semibold">{formatPrice(plan.price)}</p>
        <ul className="mt-2 space-y-1 text-sm text-zinc-500">
          <li>Up to {limits.maxScale}x scale</li>
          <li>Links kept {limits.retentionHours} h</li>
          <li>{limits.premiumTemplates ? "Premium templates included" : "Standard templates"}</li>
        </ul>
        <Link to="/pricing" className="mt-3 inline-block text-sm font-medium text-violet-600 hover:underline dark:text-violet-400">
          Compare plans →
        </Link>
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
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No renders yet. <Link to="/" className="text-violet-600 underline">Open the studio</Link>.
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
    if (!confirm("Revoke this key? Apps using it will stop working immediately.")) return;
    await api(`/me/api-keys/${id}`, { method: "DELETE" }).catch(setError);
    load();
  };

  return (
    <div className="space-y-4">
      {!session.plan.apiAccess && <Alert tone="amber">Your plan does not include API access.</Alert>}
      <Card className="p-5">
        <form onSubmit={create} className="flex flex-wrap items-end gap-3">
          <Field label="New key name" className="min-w-48 flex-1">
            <Input placeholder="e.g. whatsapp-bot" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
          </Field>
          <Button type="submit">Create key</Button>
        </form>
        {error && <div className="mt-3"><Alert>{error.message}</Alert></div>}
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
        {keys.length === 0 && <p className="px-5 py-6 text-center text-sm text-zinc-500">No API keys yet.</p>}
      </Card>
    </div>
  );
}

function Account() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user.name);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const submit = (action, success) => async (event) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await action();
      setMessage(success);
      refresh();
    } catch (err) {
      setError(err);
    }
  };
  const errors = fieldErrors(error);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3 md:col-span-2">
        {message && <Alert tone="green">{message}</Alert>}
        {error && !error.details.length && <Alert>{error.message}</Alert>}
      </div>
      <Card className="p-5">
        <form onSubmit={submit(() => api("/me", { method: "PATCH", body: { name } }), "Profile updated.")} className="space-y-4">
          <h2 className="font-semibold">Profile</h2>
          <Field label="Email">
            <Input value={user.email} disabled />
          </Field>
          <Field label="Name" error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
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
          className="space-y-4"
        >
          <h2 className="font-semibold">Password</h2>
          <Field label="Current password" error={errors.currentPassword}>
            <Input type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} required />
          </Field>
          <Field label="New password" hint="At least 8 characters." error={errors.newPassword}>
            <Input type="password" autoComplete="new-password" minLength={8} value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} required />
          </Field>
          <Button type="submit">Change password</Button>
        </form>
      </Card>
    </div>
  );
}

const TABS = { overview: Overview, history: History, keys: ApiKeys, account: Account };
const LABELS = { overview: "Overview", history: "History", keys: "API keys", account: "Account" };

export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const Tab = TABS[tab];
  return (
    <div>
      <PageHeader title={`Hi, ${user.name}`} description="Your usage, render history, API keys and account." />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {Object.keys(TABS).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${
              tab === key ? "border-violet-600 text-violet-600 dark:text-violet-400" : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            {LABELS[key]}
          </button>
        ))}
      </div>
      <Tab />
    </div>
  );
}
