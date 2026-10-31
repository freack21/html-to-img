import { useRef, useState } from "react";
import { Popover } from "./Popover.jsx";
import { cx, FIELD } from "./utils.js";

const PRESETS = [
  "#000000", "#ffffff", "#111827", "#6b7280", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#22c55e", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899",
];

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

function hsvToRgb([h, s, v]) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return [f(5), f(3), f(1)];
}

function rgbToHsv([r, g, b]) {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [(h * 60 + 360) % 360, max ? d / max : 0, max];
}

let ctx;
/** Parses any CSS color with the browser's own parser; returns [r, g, b] or null. */
function parseColor(css) {
  ctx ||= document.createElement("canvas").getContext("2d");
  const sentinel = "#010203";
  ctx.fillStyle = sentinel;
  ctx.fillStyle = String(css ?? "");
  const out = ctx.fillStyle;
  if (out === sentinel && String(css).trim().toLowerCase() !== sentinel) return null;
  if (out.startsWith("#")) return [1, 3, 5].map((i) => parseInt(out.slice(i, i + 2), 16));
  const m = out.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map(Number) : null;
}

/** Calls onMove(x, y) in 0..1 while the pointer is dragged over `element`. */
function startDrag(event, onMove) {
  const el = event.currentTarget;
  el.setPointerCapture(event.pointerId);
  const move = (e) => {
    const r = el.getBoundingClientRect();
    onMove(clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height));
  };
  move(event);
  el.onpointermove = move;
  el.onpointerup = () => {
    el.onpointermove = null;
    el.onpointerup = null;
  };
}

function Thumb({ x, y, color }) {
  return (
    <span
      className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white shadow-[0_0_0_1px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.4)]"
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, background: color }}
    />
  );
}

/** Color field: swatch that opens a picker (saturation/value area, hue slider, presets) + free text. */
export function ColorPicker({ value, onChange, presets = PRESETS, disabled, ...props }) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState([0, 0, 0]);

  const openPicker = () => {
    const rgb = parseColor(value);
    if (rgb) setHsv((prev) => {
      const next = rgbToHsv(rgb);
      // Keep the previous hue for greys, where hue is undefined.
      return next[1] === 0 ? [prev[0], next[1], next[2]] : next;
    });
    setOpen(true);
  };
  const apply = (next) => {
    setHsv(next);
    onChange(toHex(hsvToRgb(next)));
  };
  const nudge = (event, update) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const deltas = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (!deltas[event.key]) return;
    event.preventDefault();
    update(deltas[event.key]);
  };

  const [h, s, v] = hsv;
  const hueColor = `hsl(${h} 100% 50%)`;
  return (
    <div className="flex gap-2">
      <button
        ref={anchorRef}
        type="button"
        aria-label="Pick a color"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className="checkerboard relative size-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:ring-zinc-700"
      >
        <span className="absolute inset-0" style={{ background: parseColor(value) ? value : "transparent" }} />
      </button>
      <input
        className={cx(FIELD, "font-mono")}
        value={value}
        disabled={disabled}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} className="w-60 space-y-3 p-3" role="dialog" aria-label="Color picker">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Saturation and brightness"
          aria-valuetext={`saturation ${Math.round(s * 100)}%, brightness ${Math.round(v * 100)}%`}
          onPointerDown={(e) => startDrag(e, (x, y) => apply([h, x, 1 - y]))}
          onKeyDown={(e) => nudge(e, ([dx, dy]) => apply([h, clamp01(s + dx), clamp01(v + dy)]))}
          className="relative h-36 cursor-crosshair touch-none rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
        >
          <Thumb x={s} y={1 - v} color={toHex(hsvToRgb(hsv))} />
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Hue"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(h)}
          onPointerDown={(e) => startDrag(e, (x) => apply([x * 359.9, s, v]))}
          onKeyDown={(e) => nudge(e, ([dx, dy]) => apply([(h + (dx || dy) * 360 + 360) % 360, s, v]))}
          className="relative h-3 cursor-pointer touch-none rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
        >
          <Thumb x={h / 360} y={0.5} color={hueColor} />
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={preset}
              onClick={() => {
                onChange(preset);
                setHsv(rgbToHsv(parseColor(preset)));
              }}
              className={cx(
                "aspect-square rounded-md ring-1 ring-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:ring-white/15",
                String(value).toLowerCase() === preset && "ring-2 ring-violet-500 dark:ring-violet-400",
              )}
              style={{ background: preset }}
            />
          ))}
        </div>
      </Popover>
    </div>
  );
}
