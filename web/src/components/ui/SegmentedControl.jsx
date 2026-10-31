import { useRef } from "react";
import { Icon } from "./icons.jsx";
import { cx } from "./utils.js";

/**
 * Compact single choice (radio group) with roving focus.
 * options: [{ value, label, icon? }]; set `iconOnly` to show icons with the label as accessible name.
 */
export function SegmentedControl({ options, value, onChange, iconOnly = false, className, "aria-label": ariaLabel }) {
  const refs = useRef([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={ariaLabel} onKeyDown={onKeyDown} className={cx("inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800/80", className)}>
      {options.map((option, i) => {
        const checked = i === index;
        return (
          <button
            key={option.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={iconOnly ? option.label : undefined}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
              checked
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white",
            )}
          >
            {option.icon && <Icon name={option.icon} className="size-3.5" />}
            {!iconOnly && option.label}
          </button>
        );
      })}
    </div>
  );
}
