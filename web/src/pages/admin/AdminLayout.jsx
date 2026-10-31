import { NavLink, Outlet } from "react-router";
import { Icon, cx } from "../../components/ui.jsx";

const LINKS = [
  ["/admin", "Overview", "chart", true],
  ["/admin/templates", "Templates", "layout"],
  ["/admin/users", "Users", "users"],
  ["/admin/plans", "Plans", "card"],
  ["/admin/settings", "Settings", "settings"],
];

export default function AdminLayout() {
  return (
    <div className="grid gap-8 md:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label="Admin" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:sticky md:top-24 md:mx-0 md:flex-col md:self-start md:px-0">
        <p className="hidden px-3 pb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase md:block">Admin</p>
        {LINKS.map(([to, label, icon, end]) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap",
                isActive
                  ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
              )
            }
          >
            <Icon name={icon} className="size-4 shrink-0 opacity-80" />
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
