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

async function fetchRoneUpstream<T>(
  upstreamPath: string,
  timeoutMs = 1100
): Promise<T | null> {
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

interface ServerSnapshotCache {
  payload: InitialRonePayload;
  updatedAt: number;
  isLive: boolean;
}

let snapshotCache: ServerSnapshotCache | null = null;
let backgroundRefreshPromise: Promise<void> | null = null;
const SNAPSHOT_TTL_MS = 15_000;

async function fetchLiveSnapshot(
  baseFallback: InitialRonePayload
): Promise<{ payload: InitialRonePayload; isLive: boolean }> {
  const [
    directLatest,
    directRealtime,
    directFelt,
    directSig,
    roneTsunamiWrap,
  ] = await Promise.all([
    fetchDirectBmkgLatest(),
    fetchDirectBmkgRealtime(250, 0),
    fetchDirectBmkgFelt(),
    fetchDirectBmkgSignificant(),
    fetchRoneUpstream<{ data: InitialRonePayload["tsunami"] }>("tsunami", 950),
  ]);

  const latest = pickNewerEarthquake(directLatest, baseFallback.latest);

  const mergedRealtime = mergeRealtimeEvents(
    directRealtime,
    baseFallback.realtime,
    250
  );
  const realtime = mergedRealtime.length ? mergedRealtime : baseFallback.realtime;

  const pickedFelt = pickNewerEarthquakeList(directFelt, baseFallback.felt);
  const felt = pickedFelt.length ? pickedFelt : baseFallback.felt;

  const pickedSig = pickNewerEarthquakeList(directSig, baseFallback.significant);
  const significant = pickedSig.length ? pickedSig : baseFallback.significant;

  const tsunami =
    roneTsunamiWrap?.data && roneTsunamiWrap.data.length
      ? roneTsunamiWrap.data
      : baseFallback.tsunami;

  const isLive = Boolean(
    directLatest || directRealtime.length > 0 || directFelt.length > 0
  );

  return {
    payload: {
      latest,
      realtime,
      felt,
      significant,
      tsunami,
      archive3m: baseFallback.archive3m,
      referenceNowMs: Date.now(),
    },
    isLive,
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
      if (fresh.isLive || !snapshotCache) {
        snapshotCache = {
          payload: fresh.payload,
          updatedAt: Date.now(),
          isLive: fresh.isLive,
        };
      }
    })
    .catch(() => {})
    .finally(() => {
      backgroundRefreshPromise = null;
    });
}

export async function loadInitialRoneData(): Promise<InitialRonePayload> {
  const now = Date.now();
  if (snapshotCache && snapshotCache.isLive) {
    if (now - snapshotCache.updatedAt > SNAPSHOT_TTL_MS) {
      triggerBackgroundRefresh(snapshotCache.payload);
    }
    return {
      ...snapshotCache.payload,
      referenceNowMs: now,
    };
  }

  const localBase = await loadFastLocalBase();

  // Wait up to 2400ms for direct BMKG InaTEWS live feeds (~400-750ms typical) so initial page load always shows real-time data
  const raceResult = await Promise.race([
    fetchLiveSnapshot(localBase).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 2400)),
  ]);

  if (raceResult) {
    snapshotCache = {
      payload: raceResult.payload,
      updatedAt: Date.now(),
      isLive: raceResult.isLive,
    };
    return raceResult.payload;
  }

  triggerBackgroundRefresh(localBase);
  return localBase;
}

