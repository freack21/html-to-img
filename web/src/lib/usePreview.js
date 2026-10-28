import { useEffect, useRef, useState } from "react";
import { apiBlob } from "./api.js";

/**
 * Debounced live preview. `body` is the /preview request; pass null to skip.
 * Returns an object URL for the latest successful render.
 */
export function usePreview(body, delay = 400) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const key = body ? JSON.stringify(body) : null;

  useEffect(() => {
    if (!key) return undefined;
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { blob } = await apiBlob("/preview", JSON.parse(key));
        if (id !== requestId.current) return;
        setUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return URL.createObjectURL(blob);
        });
        setError(null);
      } catch (err) {
        if (id === requestId.current) setError(err);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [key, delay]);

  return { url, error, loading };
}

/** Maps API validation details (`path: "name"`) to `{ name: message }`. */
export function fieldErrors(error) {
  return Object.fromEntries((error?.details || []).map((d) => [d.path, d.message]));
}
