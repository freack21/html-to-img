export class ApiError extends Error {
  constructor(status, error = {}) {
    super(error.message || `Request failed (${status})`);
    this.status = status;
    this.code = error.code;
    this.details = error.details || [];
  }
}

async function toError(res) {
  const json = await res.json().catch(() => null);
  return new ApiError(res.status, json?.error);
}

/** Calls the JSON API and returns `data`; throws ApiError on failure. */
export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res);
  return (await res.json()).data;
}

/** POSTs JSON and returns the binary response (image) as a Blob. */
export async function apiBlob(path, body) {
  const res = await fetch(`/api/v1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res);
  return { blob: await res.blob(), headers: res.headers };
}

export function formatNumber(n) {
  return n === null || n === undefined ? "∞" : new Intl.NumberFormat("en-US").format(n);
}

export function formatPrice(idr) {
  return idr === 0 ? "Free" : `Rp${new Intl.NumberFormat("id-ID").format(idr)}`;
}

export function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
