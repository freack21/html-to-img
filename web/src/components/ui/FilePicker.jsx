import { useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { cx } from "./utils.js";

/**
 * Click-or-drop file chooser. The browser only opens its file dialog through an
 * <input type="file">, so one is kept visually hidden; everything visible is custom.
 */
export function FilePicker({ accept, onFile, label = "Upload", hint, className, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const take = (files) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) take(e.dataTransfer.files);
      }}
      className={className}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cx(
          "flex h-full w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ring-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60",
          dragging
            ? "bg-violet-50 text-violet-700 ring-violet-500 dark:bg-violet-500/10 dark:text-violet-300"
            : "ring-zinc-300 hover:bg-zinc-50 dark:ring-zinc-700 dark:hover:bg-zinc-800",
        )}
      >
        <Icon name="upload" />
        {dragging ? "Drop to upload" : label}
        {hint && <span className="text-xs font-normal text-zinc-500">{hint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
