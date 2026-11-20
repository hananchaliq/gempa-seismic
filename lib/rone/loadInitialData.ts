import fs from "node:fs/promises";
import path from "node:path";
import type { InitialRonePayload } from "@/components/rone/GempaRoneApp";
import {
  fetchDirectBmkgFelt,
  fetchDirectBmkgLatest,
  fetchDirectBmkgRealtime,
  fetchDirectBmkgSignificant,
  mergeArchive3mEvents,
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

async function fetchRoneUpstream<T>(upstreamPath: string, timeoutMs = 1500): Promise<T | null> {
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

interface InitialCacheState {
  payload: InitialRonePayload | null;
  cachedAtMs: number;
  inFlight: Promise<InitialRonePayload> | null;
}

const globalForRone = globalThis as unknown as {
  __roneInitialCache?: InitialCacheState;
};

const cacheState: InitialCacheState =
  globalForRone.__roneInitialCache ||
  (globalForRone.__roneInitialCache = {
    payload: null,
    cachedAtMs: 0,
    inFlight: null,
  });

const CACHE_TTL_MS = 20_000;

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
    roneArchive3mWrap,
    fixtureArchive3mWrap,
  ] = await Promise.all([
    fetchRoneUpstream<{ data: InitialRonePayload["latest"] }>("earthquakes/latest", 900),
    fetchDirectBmkgLatest(),
    fetchRoneUpstream<{ data: InitialRonePayload["realtime"] }>(
      "earthquakes/realtime?limit=250",
      900
    ),
    fetchDirectBmkgRealtime(250, 0),
    fetchRoneUpstream<{ data: InitialRonePayload["felt"] }>("earthquakes/felt", 900),
    fetchDirectBmkgFelt(),
    fetchRoneUpstream<{ data: InitialRonePayload["significant"] }>(
      "earthquakes/significant",
      900
    ),
    fetchDirectBmkgSignificant(),
    fetchRoneUpstream<{ data: InitialRonePayload["tsunami"] }>("tsunami", 900),
    fetchRoneUpstream<{ data: InitialRonePayload["archive3m"] }>(
      "earthquakes/archive/3m",
      2400
    ),
    readJsonFixture<{ data: InitialRonePayload["archive3m"] }>("archive-3m.json", {
      data: [],
    }),
  ]);

  // 1. Latest felt quake: pick whichever source has the newest origin_time, or fixture fallback
  let latest = pickNewerEarthquake(roneLatestWrap?.data, directLatest);
  if (!latest) {
    const fallbackLatest = await readJsonFixture<{ data: InitialRonePayload["latest"] }>(
      "latest.json",
      { data: null }
    );
    latest = fallbackLatest.data || null;
  }

  // 2. Realtime detections: merge direct BMKG InaTEWS GCS (gempaQL.json) + Rone API, sorted newest first
  let realtime = mergeRealtimeEvents(
    directRealtime,
    roneRealtimeWrap?.data || [],
    250
  );
  if (!realtime.length) {
    const fallbackRt = await readJsonFixture<{ data: InitialRonePayload["realtime"] }>(
      "realtime.json",
      { data: [] }
    );
    realtime = fallbackRt.data || [];
  }

  // 3. Felt earthquakes: pick fresher list between direct BMKG CAP XML/TEWS and Rone API
  let felt = pickNewerEarthquakeList(directFelt, roneFeltWrap?.data || []);
  if (!felt.length) {
    const fallbackFelt = await readJsonFixture<{ data: InitialRonePayload["felt"] }>(
      "felt.json",
      { data: [] }
    );
    felt = fallbackFelt.data || [];
  }

  // 4. Significant M5+ earthquakes: pick fresher list between direct BMKG CAP XML/TEWS and Rone API
  let significant = pickNewerEarthquakeList(directSig, roneSigWrap?.data || []);
  if (!significant.length) {
    const fallbackSig = await readJsonFixture<{
      data: InitialRonePayload["significant"];
    }>("significant.json", { data: [] });
    significant = fallbackSig.data || [];
  }

  // 5. Tsunami bulletins
  let tsunami = roneTsunamiWrap?.data || [];
  if (!tsunami.length) {
    const fallbackTs = await readJsonFixture<{ data: InitialRonePayload["tsunami"] }>(
      "tsunami.json",
      { data: [] }
    );
    tsunami = fallbackTs.data || [];
  }

  const nowMs = Date.now();
  const baseArchive3m =
    roneArchive3mWrap?.data && roneArchive3mWrap.data.length > 0
      ? roneArchive3mWrap.data
      : fixtureArchive3mWrap.data || [];
  const archive3m = mergeArchive3mEvents(baseArchive3m, realtime, significant, felt, nowMs);

  const payload: InitialRonePayload = {
    latest,
    realtime,
    felt,
    significant,
    tsunami,
    archive3m,
    referenceNowMs: nowMs,
  };

  cacheState.payload = payload;
  cacheState.cachedAtMs = Date.now();
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
    realtime: rtWrap.data || [],
    felt: feltWrap.data || [],
    significant: sigWrap.data || [],
    tsunami: tsWrap.data || [],
    archive3m: archWrap.data || [],
    referenceNowMs: Date.now(),
  };
}

export async function loadInitialRoneData(): Promise<InitialRonePayload> {
  const now = Date.now();
  if (cacheState.payload && now - cacheState.cachedAtMs < CACHE_TTL_MS) {
    return { ...cacheState.payload, referenceNowMs: now };
  }

  if (!cacheState.inFlight) {
    cacheState.inFlight = buildFreshPayload()
      .catch(() => null as unknown as InitialRonePayload)
      .finally(() => {
        cacheState.inFlight = null;
      });
  }

  if (cacheState.payload) {
    return { ...cacheState.payload, referenceNowMs: now };
  }

  const fastTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2200));
  const raced = await Promise.race([cacheState.inFlight, fastTimeout]);
  if (raced) {
    return raced;
  }

  // Fallback only for this single cold request without poisoning cacheState.payload
  return buildInstantFixturePayload();
}
