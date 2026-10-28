import { NavLink, Outlet } from "react-router";
import { cx } from "../../components/ui.jsx";

const LINKS = [
  ["/admin", "Overview", true],
  ["/admin/templates", "Templates"],
  ["/admin/users", "Users"],
  ["/admin/plans", "Plans"],
  ["/admin/settings", "Settings"],
];

export default function AdminLayout() {
  return (
    <div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
      <nav className="flex gap-1 overflow-x-auto md:flex-col">
        <p className="hidden px-3 pb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase md:block">Admin</p>
        {LINKS.map(([to, label, end]) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                "rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                isActive
                  ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
