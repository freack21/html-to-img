import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { Popover } from "./Popover.jsx";
import { cx, FIELD } from "./utils.js";

const normalize = (options) => options.map((o) => (typeof o === "object" ? o : { value: o, label: String(o) }));

/**
 * Accessible single-select listbox (replaces the native <select>).
 * options: array of values or { value, label, description?, disabled? }.
 * Keyboard: ↑/↓, Home/End, Enter/Space, Escape, Tab and type-ahead.
 */
export function Select({ value, onChange, options, placeholder = "Select…", disabled, className, size = "md", id, ...props }) {
  const items = normalize(options);
  const generatedId = useId();
  const listId = `${id ?? generatedId}-list`;
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = items.findIndex((o) => String(o.value) === String(value));
  const [active, setActive] = useState(selectedIndex);
  const typeahead = useRef({ text: "", timer: null });

  const enabledIndex = (from, step) => {
    for (let i = from; i >= 0 && i < items.length; i += step) if (!items[i].disabled) return i;
    return -1;
  };

  const openList = (index = selectedIndex >= 0 ? selectedIndex : enabledIndex(0, 1)) => {
    setActive(index);
    setOpen(true);
  };
  const choose = (index) => {
    const item = items[index];
    if (!item || item.disabled) return;
    onChange(item.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (event) => {
    if (disabled) return;
    const { key } = event;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      const step = key === "ArrowDown" ? 1 : -1;
      const next = enabledIndex(active + step, step);
      if (next !== -1) setActive(next);
    } else if (key === "Home" || key === "End") {
      event.preventDefault();
      setActive(key === "Home" ? enabledIndex(0, 1) : enabledIndex(items.length - 1, -1));
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      choose(active);
    } else if (key === "Tab") {
      setOpen(false);
    } else if (key.length === 1) {
      const state = typeahead.current;
      clearTimeout(state.timer);
      state.text += key.toLowerCase();
      state.timer = setTimeout(() => (state.text = ""), 500);
      const match = items.findIndex((o) => !o.disabled && String(o.label).toLowerCase().startsWith(state.text));
      if (match !== -1) setActive(match);
    }
  };

  const selected = items[selectedIndex];
  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cx(FIELD, "flex items-center justify-between gap-2 text-left", size === "sm" && "py-1.5", className)}
        {...props}
      >
        <span className={cx("truncate", !selected && "text-zinc-400")}>{selected ? selected.label : placeholder}</span>
        <Icon name="chevronDown" className={cx("size-4 shrink-0 text-zinc-400 transition-transform", open && "rotate-180")} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} matchWidth>
        <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto">
          {items.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <li
                key={String(item.value)}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                aria-disabled={item.disabled || undefined}
                onPointerEnter={() => !item.disabled && setActive(index)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(index)}
                className={cx(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm select-none",
                  index === active && !item.disabled && "bg-zinc-100 dark:bg-zinc-800",
                  item.disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="flex-1">
                  <span className={cx("block", isSelected && "font-medium")}>{item.label}</span>
                  {item.description && <span className="block text-xs text-zinc-500">{item.description}</span>}
                </span>
                {isSelected && <Icon name="check" className="size-4 text-violet-600 dark:text-violet-400" />}
              </li>
            );
          })}
        </ul>
      </Popover>
    </>
  );
}
