import { useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { Popover } from "./Popover.jsx";
import { cx } from "./utils.js";

/**
 * Button + dropdown menu. `trigger` receives props to spread on a <button>.
 * items: [{ id, label, icon?, onSelect, selected?, tone?: "danger" } | { id, separator: true }].
 * Items with `selected` defined are radio items (✓ marks the current one).
 * Keyboard: ↑/↓, Home/End, Enter, Escape.
 */
export function Menu({ trigger, items, header, align = "end", className, "aria-label": ariaLabel }) {
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);
  const [open, setOpen] = useState(false);
  const actions = items.filter((i) => !i.separator);

  const focusItem = (index) => itemRefs.current[(index + actions.length) % actions.length]?.focus();
  const openMenu = (index = Math.max(0, actions.findIndex((i) => i.selected))) => {
    setOpen(true);
    requestAnimationFrame(() => focusItem(index));
  };
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onItemKeyDown = (event, index) => {
    const targets = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: actions.length - 1 };
    if (event.key in targets) {
      event.preventDefault();
      focusItem(targets[event.key]);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  let actionIndex = -1;
  return (
    <>
      {trigger({
        ref: buttonRef,
        type: "button",
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-label": ariaLabel,
        onClick: () => (open ? setOpen(false) : openMenu()),
        onKeyDown: (e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openMenu(e.key === "ArrowDown" ? 0 : actions.length - 1);
          }
        },
      })}
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={buttonRef} align={align} className={cx("min-w-44", className)}>
        {header && <div className="border-b border-zinc-200 px-2.5 pt-1.5 pb-2.5 dark:border-zinc-800">{header}</div>}
        <div role="menu" aria-label={ariaLabel} className={cx(header && "pt-1")}>
          {items.map((item) => {
            if (item.separator) return <div key={item.id} role="separator" className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />;
            const index = ++actionIndex;
            const radio = item.selected !== undefined;
            return (
              <button
                key={item.id}
                ref={(el) => (itemRefs.current[index] = el)}
                type="button"
                role={radio ? "menuitemradio" : "menuitem"}
                aria-checked={radio ? Boolean(item.selected) : undefined}
                tabIndex={-1}
                onKeyDown={(e) => onItemKeyDown(e, index)}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
                className={cx(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:hover:bg-zinc-800 dark:focus:bg-zinc-800",
                  item.selected && "font-medium text-violet-700 dark:text-violet-300",
                  item.tone === "danger" && "text-red-600 dark:text-red-400",
                )}
              >
                {item.icon && <Icon name={item.icon} className="size-4 opacity-80" />}
                <span className="flex-1">{item.label}</span>
                {item.selected && <Icon name="check" className="size-4" />}
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
