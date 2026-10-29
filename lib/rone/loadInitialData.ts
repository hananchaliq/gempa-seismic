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

async function readJsonFixture<T>(filename: string, fallback: T): Promise<T> {
  try {
    const filePath = path.join(process.cwd(), "public", "fixtures", "live-cache", filename);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function fetchRoneUpstream<T>(upstreamPath: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
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

interface ServerSnapshotCache {
  payload: InitialRonePayload;
  updatedAt: number;
}

let snapshotCache: ServerSnapshotCache | null = null;
let backgroundRefreshPromise: Promise<void> | null = null;
const SNAPSHOT_TTL_MS = 20_000;

async function fetchLiveSnapshot(
  baseFallback: InitialRonePayload
): Promise<InitialRonePayload> {
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
  ] = await Promise.all([
    fetchRoneUpstream<{ data: InitialRonePayload["latest"] }>("earthquakes/latest"),
    fetchDirectBmkgLatest(),
    fetchRoneUpstream<{ data: InitialRonePayload["realtime"] }>(
      "earthquakes/realtime?limit=250"
    ),
    fetchDirectBmkgRealtime(250, 0),
    fetchRoneUpstream<{ data: InitialRonePayload["felt"] }>("earthquakes/felt"),
    fetchDirectBmkgFelt(),
    fetchRoneUpstream<{ data: InitialRonePayload["significant"] }>(
      "earthquakes/significant"
    ),
    fetchDirectBmkgSignificant(),
    fetchRoneUpstream<{ data: InitialRonePayload["tsunami"] }>("tsunami"),
  ]);

  const latest =
    pickNewerEarthquake(roneLatestWrap?.data, directLatest) || baseFallback.latest;

  const mergedRealtime = mergeRealtimeEvents(
    directRealtime,
    roneRealtimeWrap?.data || [],
    250
  );
  const realtime = mergedRealtime.length ? mergedRealtime : baseFallback.realtime;

  const pickedFelt = pickNewerEarthquakeList(directFelt, roneFeltWrap?.data || []);
  const felt = pickedFelt.length ? pickedFelt : baseFallback.felt;

  const pickedSig = pickNewerEarthquakeList(directSig, roneSigWrap?.data || []);
  const significant = pickedSig.length ? pickedSig : baseFallback.significant;

  const tsunami =
    roneTsunamiWrap?.data && roneTsunamiWrap.data.length
      ? roneTsunamiWrap.data
      : baseFallback.tsunami;

  return {
    latest,
    realtime,
    felt,
    significant,
    tsunami,
    archive3m: baseFallback.archive3m,
    referenceNowMs: Date.now(),
  };
}

async function loadFastLocalBase(): Promise<InitialRonePayload> {
  const [latestWrap, rtWrap, feltWrap, sigWrap, tsWrap, archive3mWrap] =
    await Promise.all([
      readJsonFixture<{ data: InitialRonePayload["latest"] }>("latest.json", {
        data: null,
      }),
      readJsonFixture<{ data: InitialRonePayload["realtime"] }>("realtime.json", {
        data: [],
      }),
      readJsonFixture<{ data: InitialRonePayload["felt"] }>("felt.json", {
        data: [],
      }),
      readJsonFixture<{ data: InitialRonePayload["significant"] }>(
        "significant.json",
        { data: [] }
      ),
      readJsonFixture<{ data: InitialRonePayload["tsunami"] }>("tsunami.json", {
        data: [],
      }),
      readJsonFixture<{ data: InitialRonePayload["archive3m"] }>(
        "archive-3m.json",
        { data: [] }
      ),
    ]);

  return {
    latest: latestWrap.data || null,
    realtime: (rtWrap.data || []).slice(0, 250),
    felt: feltWrap.data || [],
    significant: sigWrap.data || [],
    tsunami: tsWrap.data || [],
    archive3m: archive3mWrap.data || [],
    referenceNowMs: Date.now(),
  };
}

function triggerBackgroundRefresh(base: InitialRonePayload) {
  if (backgroundRefreshPromise) return;
  backgroundRefreshPromise = fetchLiveSnapshot(base)
    .then((fresh) => {
      snapshotCache = {
        payload: fresh,
        updatedAt: Date.now(),
      };
    })
    .catch(() => {})
    .finally(() => {
      backgroundRefreshPromise = null;
    });
}

export async function loadInitialRoneData(): Promise<InitialRonePayload> {
  const now = Date.now();
  if (snapshotCache) {
    if (now - snapshotCache.updatedAt > SNAPSHOT_TTL_MS) {
      triggerBackgroundRefresh(snapshotCache.payload);
    }
    return {
      ...snapshotCache.payload,
      referenceNowMs: now,
    };
  }

  const localBase = await loadFastLocalBase();

  // Race live fetch against a tight 380ms budget so SSR TTFB stays instant for PageSpeed Insights
  const raceResult = await Promise.race([
    fetchLiveSnapshot(localBase).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 380)),
  ]);

  if (raceResult) {
    snapshotCache = {
      payload: raceResult,
      updatedAt: Date.now(),
    };
    return raceResult;
  }

  snapshotCache = {
    payload: localBase,
    updatedAt: Date.now() - SNAPSHOT_TTL_MS,
  };
  triggerBackgroundRefresh(localBase);
  return localBase;
}

