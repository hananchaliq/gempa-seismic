/**
 * Fetch JSON from our own /api/v1. Concurrent identical requests share one
 * promise; every outcome is broadcast so the header "live" indicator can
 * reflect data freshness.
 */

const inflight = new Map();
const recent = new Map(); // path -> { at, data }: short-lived cache for repeated lookups
const FRESH_MS = 30000;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function announce(ok) {
  document.dispatchEvent(new CustomEvent("gempa:data", { detail: { ok, at: new Date() } }));
}

export function getJSON(path, { timeout = 15000, fresh = FRESH_MS } = {}) {
  const hit = recent.get(path);
  if (hit && Date.now() - hit.at < fresh) return Promise.resolve(hit.data);
  if (inflight.has(path)) return inflight.get(path);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const promise = fetch(path, { headers: { Accept: "application/json" }, signal: controller.signal })
    .then(async (response) => {
      if (!response.ok) {
        let detail = "Gagal memuat data.";
        try {
          const body = await response.json();
          if (typeof body.detail === "string") detail = body.detail;
        } catch {}
        throw new ApiError(detail, response.status);
      }
      return response.json();
    })
    .then(
      (data) => {
        announce(true);
        recent.set(path, { at: Date.now(), data });
        return data;
      },
      (error) => {
        if (!(error instanceof ApiError) || error.status >= 500) announce(false);
        if (error.name === "AbortError") throw new ApiError("Permintaan terlalu lama.", 0);
        if (error instanceof ApiError) throw error;
        throw new ApiError("Tidak dapat terhubung. Periksa koneksi internet.", 0);
      },
    )
    .finally(() => {
      clearTimeout(timer);
      inflight.delete(path);
    });

  inflight.set(path, promise);
  return promise;
}

/** Re-run `task` every `ms` while the tab is visible, and immediately when it becomes visible. */
export function every(ms, task) {
  let timer;
  let lastRun = Date.now();
  const run = async () => {
    clearTimeout(timer);
    if (document.visibilityState === "visible") {
      lastRun = Date.now();
      try {
        await task();
      } catch {}
    }
    timer = setTimeout(run, ms);
  };
  // Refresh on return only if the data is actually stale.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lastRun >= ms) run();
  });
  timer = setTimeout(run, ms);
}
