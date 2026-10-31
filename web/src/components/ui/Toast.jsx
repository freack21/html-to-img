import { createContext, useCallback, useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons.jsx";
import { cx } from "./utils.js";

const ToastContext = createContext(null);
const TONES = {
  success: { icon: "checkCircle", className: "text-emerald-600 dark:text-emerald-400" },
  error: { icon: "alert", className: "text-red-600 dark:text-red-400" },
  info: { icon: "info", className: "text-violet-600 dark:text-violet-400" },
};

/** Provides `useToast()`: `toast({ title, description?, tone?: "success" | "error" | "info" })`. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    ({ title, description, tone = "success", duration = 4000 }) => {
      const id = ++nextId.current;
      setToasts((list) => [...list.slice(-3), { id, title, description, tone }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
        >
          {toasts.map((t) => {
            const tone = TONES[t.tone] ?? TONES.info;
            return (
              <div
                key={t.id}
                role={t.tone === "error" ? "alert" : "status"}
                className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-white p-3.5 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
              >
                <Icon name={tone.icon} className={cx("mt-0.5 size-5 shrink-0", tone.className)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-sm break-words text-zinc-500 dark:text-zinc-400">{t.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="rounded-md p-0.5 text-zinc-400 hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:text-zinc-200"
                >
                  <Icon name="x" className="size-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside <ToastProvider>");
  return toast;
}
