import { useEffect, useState } from "react";
import { Icon } from "./icons.jsx";
import { cx, FIELD } from "./utils.js";

const BUTTON_VARIANTS = {
  primary: "bg-violet-600 text-white hover:bg-violet-500 disabled:bg-violet-600/50",
  secondary:
    "bg-white text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800",
  ghost: "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
  danger: "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-600/50",
};

export function Button({ variant = "primary", size = "md", className, loading, children, ...props }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed dark:focus-visible:ring-offset-zinc-950",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
        BUTTON_VARIANTS[variant],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function Input({ className, ...props }) {
  return <input className={cx(FIELD, className)} {...props} />;
}

export function Textarea({ className, ...props }) {
  return <textarea className={cx(FIELD, className)} {...props} />;
}

/** Password field with a show/hide toggle. */
export function PasswordInput({ className, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input type={visible ? "text" : "password"} className={cx(FIELD, "pr-10", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 hover:text-zinc-700 focus:outline-none focus-visible:text-violet-600 dark:hover:text-zinc-200"
      >
        <Icon name={visible ? "eyeOff" : "eye"} />
      </button>
    </div>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx("block", className)}>
      {label && <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>}
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>
      )}
    </label>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900",
          checked ? "bg-violet-600" : "bg-zinc-300 dark:bg-zinc-700",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </button>
      {label}
    </label>
  );
}

export function Card({ className, children }) {
  return (
    <div className={cx("rounded-xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800", className)}>
      {children}
    </div>
  );
}

const BADGE_TONES = {
  zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

export function Badge({ tone = "zinc", children }) {
  return <span className={cx("inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium", BADGE_TONES[tone])}>{children}</span>;
}

export function Alert({ tone = "red", children }) {
  const tones = {
    red: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20",
    amber: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
  };
  return <div className={cx("rounded-lg px-3 py-2 text-sm ring-1", tones[tone])}>{children}</div>;
}

export function Spinner({ className = "size-5" }) {
  return (
    <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function UsageBar({ used, limit }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div
        className={cx("h-full rounded-full", pct >= 90 ? "bg-red-500" : "bg-violet-600")}
        style={{ width: `${limit === null ? 0 : pct}%` }}
      />
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };
  return (
    <Button type="button" variant="secondary" size="sm" onClick={copy} aria-live="polite">
      {copied ? (
        <>
          <Icon name="check" className="size-3.5" /> Copied
        </>
      ) : (
        label
      )}
    </Button>
  );
}

/** Loading placeholder with the size of the content it stands in for. */
export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cx("animate-pulse rounded-lg bg-zinc-200/80 dark:bg-zinc-800", className)} />;
}

/** Friendly placeholder for empty lists and first-run states. */
export function EmptyState({ icon = "sparkles", title, description, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
        <Icon name={icon} className="size-6" />
      </div>
      <p className="mt-4 font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
