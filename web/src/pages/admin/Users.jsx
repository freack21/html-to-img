import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Input, PageHeader, Select } from "../../components/ui.jsx";
import { api, formatDate } from "../../lib/api.js";
import { useAuth } from "../../lib/auth.jsx";

export default function Users() {
  const { user: me } = useAuth();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(
    () => api(`/admin/users?q=${encodeURIComponent(query)}&page=${page}`).then(setData).catch(setError),
    [query, page],
  );

  useEffect(() => {
    api("/admin/plans").then(setPlans).catch(setError);
  }, []);
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const update = async (id, body) => {
    setError(null);
    await api(`/admin/users/${id}`, { method: "PATCH", body }).catch(setError);
    load();
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <PageHeader title="Users" description="Assign plans, roles and access. Disabling a user signs them out." />
      <div className="mb-4 max-w-sm">
        <Input placeholder="Search by email or name…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
      </div>
      {error && <div className="mb-4"><Alert>{error.message}</Alert></div>}
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Joined</th>
              <th className="px-4 py-2">Last login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {data?.items.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-zinc-500">{u.email}</p>
                </td>
                <td className="px-4 py-2">
                  <Select value={u.planId} onChange={(e) => update(u.id, { planId: Number(e.target.value) })} className="w-36">
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-2">
                  <Select value={u.role} disabled={u.id === me.id} onChange={(e) => update(u.id, { role: e.target.value })} className="w-28">
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </Select>
                </td>
                <td className="px-4 py-2">
                  <Select value={u.status} disabled={u.id === me.id} onChange={(e) => update(u.id, { status: e.target.value })} className="w-28">
                    <option value="active">active</option>
                    <option value="disabled">disabled</option>
                  </Select>
                </td>
                <td className="px-4 py-2 text-zinc-500">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-2 text-zinc-500">{formatDate(u.lastLoginAt)}</td>
              </tr>
            ))}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</Button>
          <span className="text-zinc-500">Page {page} of {pages} · {data.total} users</span>
          <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</Button>
        </div>
      )}
    </div>
  );
}
