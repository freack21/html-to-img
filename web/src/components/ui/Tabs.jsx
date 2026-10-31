import { useRef } from "react";
import { cx } from "./utils.js";

/**
 * Tab list with roving focus (←/→, Home/End). Render the active panel yourself, e.g.
 * <Tabs tabs={[{ id, label }]} value={tab} onChange={setTab} />.
 */
export function Tabs({ tabs, value, onChange, bordered = true, className, "aria-label": ariaLabel }) {
  const refs = useRef({});
  const move = (event, index) => {
    const keys = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = tabs[(keys[event.key] + tabs.length) % tabs.length];
    onChange(next.id);
    refs.current[next.id]?.focus();
  };
  return (
    <div role="tablist" aria-label={ariaLabel} className={cx("flex gap-1 overflow-x-auto", bordered && "border-b border-zinc-200 dark:border-zinc-800", className)}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => (refs.current[tab.id] = el)}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => move(e, index)}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus-visible:rounded-t-md focus-visible:ring-2 focus-visible:ring-violet-500",
              selected
                ? "border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
