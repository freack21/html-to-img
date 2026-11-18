import { useCallback, useState } from "react";

// Recent renders live only in this browser. Uploaded images (data URIs) are not kept,
// since a few of them would fill localStorage.
const KEY = "hti:recent-renders";
const MAX_ENTRIES = 12;
const THUMB_SIDE = 240;

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list) {
  // Drop the oldest entries until it fits (storage can be full or unavailable).
  for (let n = list.length; n >= 0; n--) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, n)));
      return list.slice(0, n);
    } catch {
      // try with fewer entries
    }
  }
  return [];
}

/** Small JPEG data URI of an image (blob or URL), or null if it can't be drawn. */
export async function makeThumbnail(source) {
  const src = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    await img.decode();
    const ratio = Math.min(1, THUMB_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.75);
  } catch {
    return null;
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(src);
  }
}

const withoutUploads = (params) =>
  Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === "string" && v.startsWith("data:") ? "" : v]));

export function useRecentRenders() {
  const [entries, setEntries] = useState(read);

  const add = useCallback((entry) => {
    const item = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      ...entry,
      params: withoutUploads(entry.params),
      droppedUploads: Object.values(entry.params).some((v) => typeof v === "string" && v.startsWith("data:")),
    };
    setEntries(write([item, ...read()].slice(0, MAX_ENTRIES)));
  }, []);

  const remove = useCallback((id) => setEntries(write(read().filter((e) => e.id !== id))), []);
  const clear = useCallback(() => setEntries(write([])), []);

  return { entries, add, remove, clear };
}

export function timeAgo(iso) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (seconds < 60) return rtf.format(-seconds, "second");
  if (seconds < 3600) return rtf.format(-Math.round(seconds / 60), "minute");
  if (seconds < 86400) return rtf.format(-Math.round(seconds / 3600), "hour");
  return rtf.format(-Math.round(seconds / 86400), "day");
}
