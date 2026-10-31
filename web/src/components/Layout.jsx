import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { formatNumber } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { ThemeMenu } from "./ThemeMenu.jsx";
import { Badge, Icon, Menu, Sheet, cx } from "./ui.jsx";

const NAV = [
  { to: "/studio", label: "Studio", icon: "layout" },
  { to: "/pricing", label: "Pricing", icon: "card" },
  { to: "/docs", label: "API Docs", icon: "book" },
];

export function Logo({ compact = false }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
      <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm shadow-violet-500/30">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden="true">
          <path d="M6 23l6-7 4 4 4-4 6 7z" fill="currentColor" />
          <circle cx="21" cy="10" r="2.5" fill="currentColor" />
        </svg>
      </span>
      {!compact && <span>html-to-img</span>}
    </Link>
  );
}

const navLinkClass = ({ isActive }) =>
  cx(
    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
    isActive
      ? "bg-zinc-900/5 text-zinc-900 dark:bg-white/10 dark:text-white"
      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white",
  );

function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}

function Avatar({ name, className }) {
  return (
    <span className={cx("grid place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 font-semibold text-white", className)}>
      {initials(name)}
    </span>
  );
}

/** Remaining renders, linking to the dashboard. Hidden for unlimited plans. */
function QuotaPill({ usage }) {
  if (!usage || usage.limit === null) return null;
  const pct = usage.limit ? Math.min(100, (usage.used / usage.limit) * 100) : 100;
  const low = usage.remaining <= Math.max(1, usage.limit * 0.1);
  return (
    <Link
      to="/dashboard"
      className="hidden items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 md:flex dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-900"
    >
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <span className={cx("absolute inset-y-0 left-0 rounded-full", low ? "bg-red-500" : "bg-violet-500")} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums">{formatNumber(usage.remaining)} left</span>
    </Link>
  );
}

function UserMenu({ user, plan, isAdmin, onLogout }) {
  const navigate = useNavigate();
  return (
    <Menu
      aria-label="Account menu"
      header={
        <div className="flex items-center gap-3">
          <Avatar name={user.name} className="size-9 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
          </div>
          {plan && <Badge tone="violet">{plan.name}</Badge>}
        </div>
      }
      className="w-64"
      items={[
        { id: "dashboard", label: "Dashboard", icon: "chart", onSelect: () => navigate("/dashboard") },
        { id: "studio", label: "Open Studio", icon: "layout", onSelect: () => navigate("/studio") },
        ...(isAdmin ? [{ id: "admin", label: "Admin panel", icon: "shield", onSelect: () => navigate("/admin") }] : []),
        { id: "sep", separator: true },
        { id: "logout", label: "Log out", icon: "logout", tone: "danger", onSelect: onLogout },
      ]}
      trigger={(props) => (
        <button {...props} className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950">
          <Avatar name={user.name} className="size-8 text-xs" />
        </button>
      )}
    />
  );
}

function MobileNav({ open, onClose, user, isAdmin, onLogout }) {
  const linkClass = ({ isActive }) =>
    cx(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
      isActive ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" : "hover:bg-zinc-100 dark:hover:bg-zinc-800",
    );
  const links = [
    ...NAV,
    ...(user ? [{ to: "/dashboard", label: "Dashboard", icon: "chart" }] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Admin panel", icon: "shield" }] : []),
  ];
  return (
    <Sheet open={open} onClose={onClose} title="Menu">
      <nav className="space-y-1">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={linkClass} onClick={onClose}>
            <Icon name={l.icon} className="size-[18px]" />
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        {user ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <Icon name="logout" className="size-[18px]" /> Log out
          </button>
        ) : (
          <div className="grid gap-2">
            <Link to="/register" onClick={onClose} className="rounded-lg bg-violet-600 px-3 py-2.5 text-center text-sm font-medium text-white hover:bg-violet-500">
              Get started free
            </Link>
            <Link to="/login" onClick={onClose} className="rounded-lg px-3 py-2.5 text-center text-sm font-medium ring-1 ring-zinc-300 dark:ring-zinc-700">
              Log in
            </Link>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Footer() {
  const { user } = useAuth();
  const columns = [
    { title: "Product", links: [["Studio", "/studio"], ["Pricing", "/pricing"], ["API docs", "/docs"]] },
    { title: "Account", links: user ? [["Dashboard", "/dashboard"]] : [["Log in", "/login"], ["Sign up", "/register"]] },
  ];
  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-[2fr_1fr_1fr] sm:px-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-zinc-500">Turn templates into images with a simple API — no headless browser required.</p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">{col.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {col.links.map(([label, to]) => (
                <li key={to}>
                  <Link to={to} className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-4 py-4 text-xs text-zinc-500 sm:px-6">
          <span>
            © {new Date().getFullYear()} html-to-img · made by{" "}
            <a href="https://github.com/freack21" className="hover:text-zinc-900 dark:hover:text-white">
              freack21
            </a>
          </span>
          <span>
            Emoji by{" "}
            <a href="https://github.com/jdecked/twemoji" className="underline hover:text-zinc-900 dark:hover:text-white">
              Twemoji
            </a>{" "}
            (CC-BY 4.0)
          </span>
        </div>
      </div>
    </footer>
  );
}

/**
 * App shell. `fullBleed` pages (the studio) get the full viewport width and height
 * below the header and no footer.
 */
export default function Layout({ fullBleed = false }) {
  const { user, session, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className={cx("flex flex-col", fullBleed ? "h-dvh" : "min-h-dvh")}>
      <a href="#main" className="sr-only z-50 rounded-lg bg-violet-600 px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 shrink-0 border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/80">
        <div className={cx("mx-auto flex h-16 items-center gap-3 px-4 sm:px-6", !fullBleed && "max-w-7xl")}>
          <Logo />
          <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user && <QuotaPill usage={session?.usage} />}
            <ThemeMenu />
            {user ? (
              <div className="hidden md:block">
                <UserMenu user={user} plan={session?.plan} isAdmin={isAdmin} onLogout={onLogout} />
              </div>
            ) : (
              <div className="hidden items-center gap-1 md:flex">
                <NavLink to="/login" className={navLinkClass}>
                  Log in
                </NavLink>
                <Link
                  to="/register"
                  state={{ from: location.pathname }}
                  className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Get started
                </Link>
              </div>
            )}
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="grid size-9 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 md:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Icon name="menu" className="size-5" />
            </button>
          </div>
        </div>
      </header>
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} user={user} isAdmin={isAdmin} onLogout={onLogout} />
      <main id="main" className={cx("flex-1", fullBleed ? "min-h-0" : "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10")}>
        <Outlet />
      </main>
      {!fullBleed && <Footer />}
    </div>
  );
}
