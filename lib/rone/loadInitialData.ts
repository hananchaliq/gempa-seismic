import fs from "node:fs/promises";
import path from "node:path";
import type { InitialRonePayload } from "@/components/rone/GempaRoneApp";
import {
  fetchDirectBmkgFelt,
  fetchDirectBmkgLatest,
  fetchDirectBmkgRealtime,
  fetchDirectBmkgSignificant,
  mergeRealtimeEvents,
  pickNewerEarthquake,
  pickNewerEarthquakeList,
} from "./bmkgLiveDirect";

const RONE_UPSTREAM = "https://gempa.rone.dev/api/v1";

const BROWSER_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

const fixtureMemoryCache = new Map<string, unknown>();

async function readJsonFixture<T>(filename: string, fallback: T): Promise<T> {
  if (fixtureMemoryCache.has(filename)) {
    return fixtureMemoryCache.get(filename) as T;
  }
  try {
    const filePath = path.join(process.cwd(), "public", "fixtures", "live-cache", filename);
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as T;
    fixtureMemoryCache.set(filename, parsed);
    return parsed;
  } catch {
    return fallback;
  }
}

async function fetchRoneUpstream<T>(upstreamPath: string, timeoutMs = 1200): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${RONE_UPSTREAM}/${upstreamPath}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: BROWSER_HEADERS,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let cachedInitialPayload: InitialRonePayload | null = null;
let cachedAtMs = 0;
let refreshInFlight: Promise<InitialRonePayload> | null = null;
const CACHE_TTL_MS = 25_000;

async function buildFreshPayload(): Promise<InitialRonePayload> {
  const [
    roneLatestWrap,
    directLatest,
    roneRealtimeWrap,
    directRealtime,
    roneFeltWrap,
    directFelt,
    roneSigWrap,
    directSig,
    roneTsunamiWrap,
    archive3mWrap,
  ] = await Promise.all([
    fetchRoneUpstream<{ data: InitialRonePayload["latest"] }>("earthquakes/latest", 1200),
    fetchDirectBmkgLatest(),
    fetchRoneUpstream<{ data: InitialRonePayload["realtime"] }>(
      "earthquakes/realtime?limit=80",
      1200
    ),
    fetchDirectBmkgRealtime(80, 0),
    fetchRoneUpstream<{ data: InitialRonePayload["felt"] }>("earthquakes/felt", 1200),
    fetchDirectBmkgFelt(),
    fetchRoneUpstream<{ data: InitialRonePayload["significant"] }>(
      "earthquakes/significant",
      1200
    ),
    fetchDirectBmkgSignificant(),
    fetchRoneUpstream<{ data: InitialRonePayload["tsunami"] }>("tsunami", 1200),
    readJsonFixture<{ data: InitialRonePayload["archive3m"] }>("archive-3m.json", {
      data: [],
    }),
  ]);

  let latest = pickNewerEarthquake(roneLatestWrap?.data, directLatest);
  if (!latest) {
    const fallbackLatest = await readJsonFixture<{ data: InitialRonePayload["latest"] }>(
      "latest.json",
      { data: null }
    );
    latest = fallbackLatest.data || null;
  }

  let realtime = mergeRealtimeEvents(
    directRealtime,
    roneRealtimeWrap?.data || [],
    60
  );
  if (!realtime.length) {
    const fallbackRt = await readJsonFixture<{ data: InitialRonePayload["realtime"] }>(
      "realtime.json",
      { data: [] }
    );
    realtime = (fallbackRt.data || []).slice(0, 60);
  }

  let felt = pickNewerEarthquakeList(directFelt, roneFeltWrap?.data || []);
  if (!felt.length) {
    const fallbackFelt = await readJsonFixture<{ data: InitialRonePayload["felt"] }>(
      "felt.json",
      { data: [] }
    );
    felt = (fallbackFelt.data || []).slice(0, 20);
  }

  let significant = pickNewerEarthquakeList(directSig, roneSigWrap?.data || []);
  if (!significant.length) {
    const fallbackSig = await readJsonFixture<{
      data: InitialRonePayload["significant"];
    }>("significant.json", { data: [] });
    significant = (fallbackSig.data || []).slice(0, 20);
  }

  let tsunami = roneTsunamiWrap?.data || [];
  if (!tsunami.length) {
    const fallbackTs = await readJsonFixture<{ data: InitialRonePayload["tsunami"] }>(
      "tsunami.json",
      { data: [] }
    );
    tsunami = (fallbackTs.data || []).slice(0, 12);
  }

  const payload: InitialRonePayload = {
    latest,
    realtime,
    felt: felt.slice(0, 20),
    significant: significant.slice(0, 20),
    tsunami: tsunami.slice(0, 12),
    archive3m: (archive3mWrap.data || []).slice(0, 120),
    referenceNowMs: Date.now(),
  };

  cachedInitialPayload = payload;
  cachedAtMs = Date.now();
  return payload;
}

async function buildInstantFixturePayload(): Promise<InitialRonePayload> {
  const [latestWrap, rtWrap, feltWrap, sigWrap, tsWrap, archWrap] = await Promise.all([
    readJsonFixture<{ data: InitialRonePayload["latest"] }>("latest.json", { data: null }),
    readJsonFixture<{ data: InitialRonePayload["realtime"] }>("realtime.json", { data: [] }),
    readJsonFixture<{ data: InitialRonePayload["felt"] }>("felt.json", { data: [] }),
    readJsonFixture<{ data: InitialRonePayload["significant"] }>("significant.json", {
      data: [],
    }),
    readJsonFixture<{ data: InitialRonePayload["tsunami"] }>("tsunami.json", { data: [] }),
    readJsonFixture<{ data: InitialRonePayload["archive3m"] }>("archive-3m.json", {
      data: [],
    }),
  ]);

  return {
    latest: latestWrap.data || null,
    realtime: (rtWrap.data || []).slice(0, 60),
    felt: (feltWrap.data || []).slice(0, 20),
    significant: (sigWrap.data || []).slice(0, 20),
    tsunami: (tsWrap.data || []).slice(0, 12),
    archive3m: (archWrap.data || []).slice(0, 120),
    referenceNowMs: Date.now(),
  };
}

export async function loadInitialRoneData(): Promise<InitialRonePayload> {
  const now = Date.now();
  if (cachedInitialPayload && now - cachedAtMs < CACHE_TTL_MS) {
    return { ...cachedInitialPayload, referenceNowMs: now };
  }

  if (!refreshInFlight) {
    refreshInFlight = buildFreshPayload().finally(() => {
      refreshInFlight = null;
    });
  }

  if (cachedInitialPayload) {
    return { ...cachedInitialPayload, referenceNowMs: now };
  }

  // On cold start, wait at most 450ms for live upstream so SSR TTFB is always blazingly fast (< 500ms)
  const fastTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 450));
  const raced = await Promise.race([refreshInFlight, fastTimeout]);
  if (raced) {
    return raced;
  }

  const instant = await buildInstantFixturePayload();
  cachedInitialPayload = instant;
  cachedAtMs = now - CACHE_TTL_MS + 5000;
  return instant;
}
