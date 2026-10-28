import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "../lib/auth.jsx";
import { cx } from "./ui.jsx";

const navClass = ({ isActive }) =>
  cx(
    "rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
    isActive
      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white",
  );

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight whitespace-nowrap">
      <span className="grid size-7 place-items-center rounded-lg bg-violet-600 text-white">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden="true">
          <path d="M6 23l6-7 4 4 4-4 6 7z" fill="currentColor" />
          <circle cx="21" cy="10" r="2.5" fill="currentColor" />
        </svg>
      </span>
      <span className="hidden min-[400px]:inline">html-to-img</span>
    </Link>
  );
}

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4">
          <Logo />
          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            <NavLink to="/" end className={navClass}>
              Studio
            </NavLink>
            <NavLink to="/pricing" className={navClass}>
              Pricing
            </NavLink>
            <NavLink to="/docs" className={navClass}>
              API Docs
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            {user ? (
              <>
                {isAdmin && (
                  <NavLink to="/admin" className={navClass}>
                    Admin
                  </NavLink>
                )}
                <NavLink to="/dashboard" className={navClass}>
                  Dashboard
                </NavLink>
                <button onClick={onLogout} className={navClass({ isActive: false })}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>
                  Log in
                </NavLink>
                <Link to="/register" className="rounded-lg bg-violet-600 px-3 py-1.5 whitespace-nowrap text-sm font-medium text-white hover:bg-violet-500">
                  Sign up free
                </Link>
              </>
            )}
          </div>
        </div>
        <nav className="flex gap-1 px-4 pb-2 sm:hidden">
          <NavLink to="/" end className={navClass}>
            Studio
          </NavLink>
          <NavLink to="/pricing" className={navClass}>
            Pricing
          </NavLink>
          <NavLink to="/docs" className={navClass}>
            API Docs
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
        html-to-img · made by{" "}
        <a href="https://github.com/freack21" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
          freack21
        </a>
      </footer>
    </div>
  );
}
