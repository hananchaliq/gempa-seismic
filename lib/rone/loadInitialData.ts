import fs from "node:fs/promises";
import path from "node:path";
import type { InitialRonePayload } from "@/components/rone/GempaRoneApp";
import {
  bridgeOfficialQuakesIntoRealtime,
  fetchDirectBmkgFelt,
  fetchDirectBmkgLatest,
  fetchDirectBmkgRealtime,
  fetchDirectBmkgSignificant,
  mergeEarthquakeLists,
  mergeRealtimeEvents,
  pickNewerEarthquake,
  pickNewerEarthquakeList,
} from "./bmkgLiveDirect";

const RONE_UPSTREAM = "https://gempa.rone.dev/api/v1";

const BROWSER_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Cache-Control": "no-cache",
};

async function readJsonFixture<T>(filename: string, fallback: T): Promise<T> {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "fixtures",
      "live-cache",
      filename
    );
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function fetchRoneUpstream<T>(
  upstreamPath: string,
  timeoutMs = 1500
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
const SNAPSHOT_TTL_MS = 5_000;

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
    fetchRoneUpstream<{ data: InitialRonePayload["tsunami"] }>("tsunami", 1200),
  ]);

  let pickedFelt = pickNewerEarthquakeList(directFelt, baseFallback.felt);
  let pickedSig = pickNewerEarthquakeList(directSig, baseFallback.significant);

  // Pick the freshest official earthquake across latest, felt[0], and significant[0]
  let latest = pickNewerEarthquake(directLatest, baseFallback.latest);
  if (pickedFelt[0]) {
    latest = pickNewerEarthquake(latest, pickedFelt[0]);
  }
  if (pickedSig[0]) {
    latest = pickNewerEarthquake(latest, pickedSig[0]);
  }

  // Ensure a brand-new latest felt/M5+ quake is also reflected at the top of felt / significant lists
  if (latest?.felt) {
    pickedFelt = mergeEarthquakeLists([latest], pickedFelt, 45);
  }
  if (latest && latest.magnitude >= 5.0) {
    pickedSig = mergeEarthquakeLists([latest], pickedSig, 45);
  }

  const felt = pickedFelt.length ? pickedFelt : baseFallback.felt;
  const significant = pickedSig.length ? pickedSig : baseFallback.significant;

  const mergedRealtime = mergeRealtimeEvents(
    directRealtime,
    baseFallback.realtime,
    250
  );
  const bridgedRealtime = bridgeOfficialQuakesIntoRealtime(
    mergedRealtime.length ? mergedRealtime : baseFallback.realtime,
    [latest, felt[0], significant[0]],
    250
  );
  const realtime = bridgedRealtime.length ? bridgedRealtime : baseFallback.realtime;

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

export async function loadInitialRoneData(): Promise<InitialRonePayload> {
  const now = Date.now();
  if (
    snapshotCache &&
    snapshotCache.isLive &&
    now - snapshotCache.updatedAt <= SNAPSHOT_TTL_MS
  ) {
    return {
      ...snapshotCache.payload,
      referenceNowMs: now,
    };
  }

  const base = snapshotCache?.payload || (await loadFastLocalBase());

  // Always await live BMKG feeds (up to 2500ms) when cache is older than 5s so serverless never serves stale snapshots
  const raceResult = await Promise.race([
    fetchLiveSnapshot(base).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
  ]);

  if (raceResult) {
    snapshotCache = {
      payload: raceResult.payload,
      updatedAt: Date.now(),
      isLive: raceResult.isLive,
    };
    return raceResult.payload;
  }

  return {
    ...base,
    referenceNowMs: now,
  };
}
