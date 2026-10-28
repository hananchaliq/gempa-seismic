import fs from "node:fs/promises";
import path from "node:path";
import type { InitialRonePayload } from "@/components/rone/GempaRoneApp";

const RONE_UPSTREAM = "https://gempa.rone.dev/api/v1";

async function readJsonFixture<T>(filename: string, fallback: T): Promise<T> {
  try {
    const filePath = path.join(process.cwd(), "public", "fixtures", "live-cache", filename);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function fetchLiveOrFixture<T>(
  upstreamPath: string,
  fixtureFilename: string,
  fallback: T
): Promise<T> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3200);
    const res = await fetch(`${RONE_UPSTREAM}/${upstreamPath}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as T;
      return data;
    }
  } catch {
    // Fallback to local cache when upstream times out
  }
  return readJsonFixture<T>(fixtureFilename, fallback);
}

export async function loadInitialRoneData(): Promise<InitialRonePayload> {
  const [latestWrap, realtimeWrap, feltWrap, sigWrap, tsunamiWrap, archive3mWrap] =
    await Promise.all([
      fetchLiveOrFixture<{ data: InitialRonePayload["latest"] }>(
        "earthquakes/latest",
        "latest.json",
        { data: null }
      ),
      fetchLiveOrFixture<{ data: InitialRonePayload["realtime"] }>(
        "earthquakes/realtime?limit=250",
        "realtime.json",
        { data: [] }
      ),
      fetchLiveOrFixture<{ data: InitialRonePayload["felt"] }>(
        "earthquakes/felt",
        "felt.json",
        { data: [] }
      ),
      fetchLiveOrFixture<{ data: InitialRonePayload["significant"] }>(
        "earthquakes/significant",
        "significant.json",
        { data: [] }
      ),
      fetchLiveOrFixture<{ data: InitialRonePayload["tsunami"] }>(
        "tsunami",
        "tsunami.json",
        { data: [] }
      ),
      readJsonFixture<{ data: InitialRonePayload["archive3m"] }>("archive-3m.json", {
        data: [],
      }),
    ]);

  return {
    latest: latestWrap.data || null,
    realtime: realtimeWrap.data || [],
    felt: feltWrap.data || [],
    significant: sigWrap.data || [],
    tsunami: tsunamiWrap.data || [],
    archive3m: archive3mWrap.data || [],
    referenceNowMs: Date.now(),
  };
}
