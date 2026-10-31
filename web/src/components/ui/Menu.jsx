import { useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { Popover } from "./Popover.jsx";
import { cx } from "./utils.js";

/**
 * Button + dropdown menu. `trigger` receives props to spread on a <button>.
 * items: [{ id, label, icon?, selected?, onSelect }]. Keyboard: ↑/↓, Home/End, Enter, Escape.
 */
export function Menu({ trigger, items, align = "end", "aria-label": ariaLabel }) {
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);
  const [open, setOpen] = useState(false);

  const focusItem = (index) => itemRefs.current[(index + items.length) % items.length]?.focus();
  const openMenu = (index = Math.max(0, items.findIndex((i) => i.selected))) => {
    setOpen(true);
    requestAnimationFrame(() => focusItem(index));
  };
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onItemKeyDown = (event, index) => {
    const targets = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 };
    if (event.key in targets) {
      event.preventDefault();
      focusItem(targets[event.key]);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

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
            openMenu(e.key === "ArrowDown" ? 0 : items.length - 1);
          }
        },
      })}
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={buttonRef} align={align} className="min-w-40">
        <div role="menu" aria-label={ariaLabel}>
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(el) => (itemRefs.current[index] = el)}
              type="button"
              role="menuitemradio"
              aria-checked={Boolean(item.selected)}
              tabIndex={-1}
              onKeyDown={(e) => onItemKeyDown(e, index)}
              onClick={() => {
                item.onSelect();
                close();
              }}
              className={cx(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:hover:bg-zinc-800 dark:focus:bg-zinc-800",
                item.selected && "font-medium text-violet-700 dark:text-violet-300",
              )}
            >
              {item.icon && <Icon name={item.icon} />}
              <span className="flex-1">{item.label}</span>
              {item.selected && <Icon name="check" className="size-4" />}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}
