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

export async function loadInitialRoneData(): Promise<InitialRonePayload> {
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

  return {
    latest,
    realtime,
    felt,
    significant,
    tsunami,
    archive3m: archive3mWrap.data || [],
    referenceNowMs: Date.now(),
  };
}
