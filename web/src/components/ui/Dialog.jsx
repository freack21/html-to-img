import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons.jsx";
import { Button } from "./primitives.jsx";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal dialog: focus is moved in and trapped, Escape/backdrop closes, focus returns on close. */
export function Dialog({ open, onClose, title, description, children, footer, tone }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    // Focus the first control; in confirm dialogs that is "Cancel", the safe choice.
    panelRef.current?.querySelector(FOCUSABLE)?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      } else if (event.key === "Tab") {
        const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)];
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
      >
        <div className="flex gap-4">
          {tone === "danger" && (
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400">
              <Icon name="alert" className="size-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            )}
            {children && <div className="mt-4">{children}</div>}
          </div>
        </div>
        {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

const ConfirmContext = createContext(null);

/** Provides `useConfirm()`: `if (await confirm({ title, description, confirmLabel, tone })) …` */
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);

  const confirm = useCallback(
    (options) => new Promise((resolve) => setRequest({ ...options, resolve })),
    [],
  );
  const settle = useCallback(
    (answer) => {
      request?.resolve(answer);
      setRequest(null);
    },
    [request],
  );
  const cancel = useCallback(() => settle(false), [settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(request)}
        onClose={cancel}
        title={request?.title}
        description={request?.description}
        tone={request?.tone}
        footer={
          <>
            <Button variant="secondary" onClick={cancel}>
              {request?.cancelLabel ?? "Cancel"}
            </Button>
            <Button variant={request?.tone === "danger" ? "danger" : "primary"} onClick={() => settle(true)}>
              {request?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}

