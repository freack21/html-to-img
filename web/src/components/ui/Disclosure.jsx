import { useId, useState } from "react";
import { Icon } from "./icons.jsx";
import { cx } from "./utils.js";

/** Expandable section (replaces <details>/<summary>). */
export function Disclosure({ title, children, defaultOpen = false, className, buttonClassName }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "inline-flex items-center gap-1.5 rounded text-sm font-medium text-zinc-600 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-zinc-400 dark:hover:text-zinc-100",
          buttonClassName,
        )}
      >
        <Icon name="chevronDown" className={cx("size-4 transition-transform", !open && "-rotate-90")} />
        {title}
      </button>
      <div id={panelId} hidden={!open} className="mt-2">
        {open && children}
      </div>
    </div>
  );
}
