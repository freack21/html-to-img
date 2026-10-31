import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Alert, Badge, Button, Card, PageHeader, Toggle, useConfirm } from "../../components/ui.jsx";
import { api, formatDate } from "../../lib/api.js";

export default function Templates() {
  const confirm = useConfirm();
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(() => api("/admin/templates").then(setTemplates).catch(setError), []);
  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id, body) => {
    setError(null);
    await api(`/admin/templates/${id}`, { method: "PATCH", body }).catch(setError);
    load();
  };

  const remove = async (t) => {
    const ok = await confirm({
      title: `Delete template "${t.name}"?`,
      description: `API calls using "${t.slug}" will start failing. This cannot be undone.`,
      confirmLabel: "Delete template",
      tone: "danger",
    });
    if (!ok) return;
    await api(`/admin/templates/${t.id}`, { method: "DELETE" }).catch(setError);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Templates"
        description="JSON-defined templates. Changes are live immediately."
        actions={
          <Link to="/admin/templates/new" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
            New template
          </Link>
        }
      />
      {error && <div className="mb-4"><Alert>{error.message}</Alert></div>}
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-2">Template</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Version</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2">Premium</th>
              <th className="px-4 py-2">Updated</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {templates.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2">
                  <Link to={`/admin/templates/${t.id}`} className="font-medium hover:underline">
                    {t.name}
                  </Link>
                  <p className="font-mono text-xs text-zinc-500">{t.slug}</p>
                </td>
                <td className="px-4 py-2">
                  <Badge>{t.category}</Badge>
                </td>
                <td className="px-4 py-2 tabular-nums">v{t.version}</td>
                <td className="px-4 py-2">
                  <Toggle checked={t.isActive} onChange={(v) => patch(t.id, { isActive: v })} />
                </td>
                <td className="px-4 py-2">
                  <Toggle checked={t.isPremium} onChange={(v) => patch(t.id, { isPremium: v })} />
                </td>
                <td className="px-4 py-2 text-zinc-500">{formatDate(t.updatedAt)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <Link to={`/admin/templates/${t.id}`} className="mr-3 text-violet-600 hover:underline dark:text-violet-400">
                    Edit
                  </Link>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => remove(t)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
