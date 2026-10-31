import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useModal } from "./Dialog.jsx";
import { Icon } from "./icons.jsx";

/** Side panel (mobile navigation, filters). Same focus/escape behaviour as Dialog. */
export function Sheet({ open, onClose, title, children }) {
  const panelRef = useRef(null);
  const titleId = useId();
  useModal(panelRef, open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="animate-fade-in absolute inset-0 bg-zinc-950/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-slide-in-right absolute inset-y-0 right-0 flex w-full max-w-xs flex-col bg-white shadow-2xl ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
      >
        <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
          <h2 id={titleId} className="text-sm font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-zinc-800"
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
