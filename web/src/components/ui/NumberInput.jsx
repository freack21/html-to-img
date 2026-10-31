import { useEffect, useState } from "react";
import { Icon } from "./icons.jsx";
import { cx, FIELD } from "./utils.js";

const clamp = (n, min, max) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

/**
 * Numeric field with stepper buttons and ↑/↓ keys (replaces <input type="number">).
 * onChange receives a number, or "" when the field is cleared.
 */
export function NumberInput({ value, onChange, min, max, step = 1, className, disabled, ...props }) {
  const [draft, setDraft] = useState(value === "" || value == null ? "" : String(value));

  useEffect(() => {
    // Sync external changes without clobbering partial input such as "-" or "1.".
    if (value === "" || value == null) setDraft((d) => (d === "" ? d : ""));
    else if (Number(draft) !== Number(value)) setDraft(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (text) => {
    setDraft(text);
    if (text.trim() === "") onChange("");
    else if (/^-?\d*\.?\d+$/.test(text.trim())) onChange(Number(text));
  };
  const bump = (direction) => {
    const base = draft === "" || Number.isNaN(Number(draft)) ? (min ?? 0) : Number(draft);
    const next = clamp(Math.round((base + direction * step) * 1e6) / 1e6, min, max);
    setDraft(String(next));
    onChange(next);
  };

  return (
    <div className={cx("relative", className)}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        role="spinbutton"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={draft === "" ? undefined : Number(draft)}
        value={draft}
        disabled={disabled}
        onChange={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            bump(e.key === "ArrowUp" ? 1 : -1);
          }
        }}
        className={cx(FIELD, "pr-9 tabular-nums")}
        {...props}
      />
      <div className="absolute inset-y-1 right-1 flex flex-col">
        {[
          [1, "chevronUp", "Increase"],
          [-1, "chevronDown", "Decrease"],
        ].map(([direction, icon, label]) => (
          <button
            key={icon}
            type="button"
            tabIndex={-1}
            aria-label={label}
            disabled={disabled}
            onClick={() => bump(direction)}
            className="flex flex-1 items-center rounded px-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Icon name={icon} className="size-3" strokeWidth={2.5} />
          </button>
        ))}
      </div>
    </div>
  );
}
