import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx, PANEL } from "./utils.js";

const GAP = 4;
const MARGIN = 8;

/**
 * Floating panel anchored to an element. Rendered in a portal with fixed positioning so it
 * is never clipped by scrolling/overflow containers; flips above the anchor when there is
 * no room below. Closes on outside pointer-down and Escape.
 */
export function Popover({ open, onClose, anchorRef, children, matchWidth = false, align = "start", className, ...props }) {
  const panelRef = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return undefined;
    }
    const update = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      if (matchWidth) panel.style.minWidth = `${anchor.width}px`;
      const { offsetWidth: width, offsetHeight: height } = panel;
      const below = window.innerHeight - anchor.bottom;
      const top = below < height + GAP + MARGIN && anchor.top > height + GAP + MARGIN ? anchor.top - height - GAP : anchor.bottom + GAP;
      const preferred = align === "end" ? anchor.right - width : anchor.left;
      const left = Math.max(MARGIN, Math.min(preferred, window.innerWidth - width - MARGIN));
      setPosition({ top, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, matchWidth, align]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!panelRef.current?.contains(event.target) && !anchorRef.current?.contains(event.target)) onClose();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        anchorRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div
      ref={panelRef}
      className={cx("animate-pop-in fixed z-50", PANEL, !position && "invisible", className)}
      style={position ?? { top: 0, left: 0 }}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}
