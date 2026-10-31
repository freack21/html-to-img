export const cx = (...classes) => classes.filter(Boolean).join(" ");

/** Shared look for text-like controls (inputs, select triggers, number fields). */
export const FIELD =
  "w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-300 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700";

/** Surface used by floating panels (popovers, menus, dialogs). */
export const PANEL =
  "rounded-xl bg-white p-1 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700";

let idCounter = 0;
export const nextId = (prefix) => `${prefix}-${++idCounter}`;
