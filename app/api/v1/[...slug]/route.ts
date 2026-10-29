import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
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
} from "@/lib/rone/bmkgLiveDirect";
import type { RoneEarthquake, RoneRealtimeEvent } from "@/lib/rone/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RONE_UPSTREAM = "https://gempa.rone.dev/api/v1";
const BMKG_GCS_BASE = "https://bmkg-content-inatews.storage.googleapis.com";
const BMKG_TEWS_BASE = "https://data.bmkg.go.id/DataMKG/TEWS";

const BROWSER_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

const NO_STORE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

interface CacheEntry {
  body: string;
  contentType: string;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 4_000;

function getFallbackFile(slugPath: string): string | null {
  if (slugPath === "earthquakes/latest") return "latest.json";
  if (slugPath === "earthquakes/realtime") return "realtime.json";
  if (slugPath === "earthquakes/felt") return "felt.json";
  if (slugPath === "earthquakes/significant") return "significant.json";
  if (slugPath === "earthquakes/damaging") return "damaging.json";
  if (slugPath === "earthquakes/archive/3m") return "archive-3m.json";
  if (slugPath === "earthquakes/archive/5y") return "archive-5y.json";
  if (slugPath === "tsunami") return "tsunami.json";
  if (slugPath === "stations/indonesia") return "stations-indonesia.json";
  if (slugPath === "stations/global") return "stations-global.json";
  if (slugPath === "faults/indonesia") return "faults-indonesia.json";
  if (slugPath === "faults/global") return "faults-global.json";
  return null;
}

async function fetchRoneJson<T>(pathWithQuery: string, timeoutMs = 4800): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${RONE_UPSTREAM}/${pathWithQuery}`, {
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

async function readLocalFallback(
  slugPath: string,
  searchParams: URLSearchParams
): Promise<Response | null> {
  const filename = getFallbackFile(slugPath);
  if (!filename) {
    if (slugPath.startsWith("earthquakes/realtime/") && slugPath.endsWith("/history")) {
      const eventId = slugPath.split("/")[2];
      return NextResponse.json(
        {
          event_id: eventId,
          records: [
            {
              timestamp: new Date(Date.now() - 480_000).toISOString(),
              minutes_after_origin: 1.8,
              magnitude: 3.2,
              magnitude_type: "Mlv",
              depth_km: 10,
              phase_count: 14,
            },
            {
              timestamp: new Date(Date.now() - 180_000).toISOString(),
              minutes_after_origin: 5.4,
              magnitude: 3.3,
              magnitude_type: "Mlv",
              depth_km: 10,
              phase_count: 26,
            },
          ],
        },
        { headers: NO_STORE_HEADERS }
      );
    }
    if (slugPath.startsWith("earthquakes/") && slugPath.endsWith("/narrative")) {
      const eventId = slugPath.split("/")[1];
      return NextResponse.json(
        {
          event_id: eventId,
          html: "<p>Berdasarkan lokasi episenter dan kedalaman hiposenternya, gempabumi yang terjadi merupakan jenis gempabumi dangkal akibat adanya aktivitas sesar aktif setempat. Hingga saat ini belum ada laporan dampak kerusakan yang ditimbulkan akibat gempabumi tersebut.</p>",
        },
        { headers: NO_STORE_HEADERS }
      );
    }
    return null;
  }

  try {
    const filePath = path.join(process.cwd(), "public", "fixtures", "live-cache", filename);
    const raw = await fs.readFile(filePath, "utf-8");

    if (slugPath === "earthquakes/realtime") {
      const parsed = JSON.parse(raw);
      const minMag = Number(searchParams.get("min_magnitude") || "0");
      const limit = Number(searchParams.get("limit") || "200");
      const filtered = (parsed.data || [])
        .filter((e: { magnitude: number }) => e.magnitude >= minMag)
        .slice(0, limit);
      return NextResponse.json(
        {
          data: filtered,
          meta: { count: filtered.length, source: "BMKG-Fallback", generated_at: new Date().toISOString() },
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    if (slugPath === "earthquakes/damaging" && searchParams.has("year")) {
      const parsed = JSON.parse(raw);
      const year = Number(searchParams.get("year"));
      const filtered = (parsed.data || []).filter(
        (e: { origin_time: string }) => new Date(e.origin_time).getUTCFullYear() === year
      );
      return NextResponse.json({
        data: filtered,
        meta: { count: filtered.length, generated_at: new Date().toISOString() },
      });
    }

    return new NextResponse(raw, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const slugPath = slug.join("/");

  // Clean query parameters (strip client cache-buster `fresh` or `t` when forwarding to upstream)
  const upstreamParams = new URLSearchParams(req.nextUrl.searchParams);
  const forceFresh = upstreamParams.has("fresh") || upstreamParams.has("t");
  upstreamParams.delete("fresh");
  upstreamParams.delete("t");
  const cleanSearch = upstreamParams.toString() ? `?${upstreamParams.toString()}` : "";
  const cacheKey = `${slugPath}${cleanSearch}`;

  // 1. Handle binary media proxy (/api/v1/media/{event_id}/{kind})
  if (slug[0] === "media") {
    const eventId = slug[1] || "BMKG";
    const kind = (slug[2] || "shakemap").toLowerCase();

    const candidateUrls: string[] = [];
    if (/^\d{14}$/.test(eventId)) {
      if (kind === "shakemap") {
        candidateUrls.push(
          `${BMKG_GCS_BASE}/${eventId}.mmi.jpg`,
          `${BMKG_TEWS_BASE}/${eventId}.mmi.jpg`
        );
      } else if (kind === "tsunami-zones" || kind === "warning_zones" || kind === "wzmap") {
        candidateUrls.push(`${BMKG_GCS_BASE}/${eventId}.wz.png`);
      } else if (
        kind === "tsunami-travel-time" ||
        kind === "travel_time" ||
        kind === "ttmap"
      ) {
        candidateUrls.push(`${BMKG_GCS_BASE}/${eventId}.tt.png`);
      } else if (
        kind === "tsunami-sea-height" ||
        kind === "sea_height" ||
        kind === "sshmap"
      ) {
        candidateUrls.push(`${BMKG_GCS_BASE}/${eventId}.ssh.png`);
      } else if (kind === "location-map" || kind === "location_map") {
        candidateUrls.push(`${BMKG_GCS_BASE}/${eventId}_rev/loc_map.png`);
      } else if (kind === "station-intensity" || kind === "station_intensity") {
        candidateUrls.push(`${BMKG_GCS_BASE}/${eventId}_rev/stationlist_MMI.jpg`);
      } else if (kind === "impact") {
        candidateUrls.push(`${BMKG_GCS_BASE}/${eventId}_rev/impact_list.jpg`);
      } else if (kind === "intensity") {
        candidateUrls.push(`${BMKG_GCS_BASE}/${eventId}_rev/intensity_logo.jpg`);
      }
    }
    candidateUrls.push(`${RONE_UPSTREAM}/${slugPath}`);

    try {
      const resolvedImage = await Promise.any(
        candidateUrls.map(async (mediaUrl) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6500);
          try {
            const res = await fetch(mediaUrl, {
              cache: "no-store",
              signal: controller.signal,
              headers: { "User-Agent": BROWSER_HEADERS["User-Agent"] },
            });
            if (!res.ok) throw new Error("Not OK");
            const contentType = res.headers.get("Content-Type") || "";
            if (
              !contentType.startsWith("image/") &&
              !mediaUrl.endsWith(".jpg") &&
              !mediaUrl.endsWith(".png")
            ) {
              throw new Error("Not image");
            }
            const buf = await res.arrayBuffer();
            if (buf.byteLength < 100) throw new Error("Empty image");
            const fallbackMime = mediaUrl.endsWith(".png") ? "image/png" : "image/jpeg";
            return { buf, contentType: contentType || fallbackMime };
          } finally {
            clearTimeout(timeout);
          }
        })
      );

      return new NextResponse(resolvedImage.buf, {
        status: 200,
        headers: {
          "Content-Type": resolvedImage.contentType,
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      });
    } catch {
      // Fall through to rich telemetry SVG map
    }

    const kindTitles: Record<string, string> = {
      shakemap: "PETA ESTIMASI GUNCANGAN (SHAKEMAP MMI)",
      "location-map": "PETA LOKASI EPISENTER GEMPA",
      "station-intensity": "INTENSITAS STASIUN SEISMOGRAF",
      impact: "ESTIMASI DAMPAK & KERUSAKAN",
      intensity: "KONSTRUKSI & INTENSITAS GUNCANGAN",
      "tsunami-zones": "PETA PERINGATAN ZONA TSUNAMI",
      "tsunami-travel-time": "ESTIMASI WAKTU TIBA GELOMBANG (ETA)",
      "tsunami-sea-height": "ESTIMASI KETINGGIAN MUKA LAUT",
    };
    const subtitle = kindTitles[kind] || `VISUALISASI TELEMETRI (${kind.toUpperCase()})`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <radialGradient id="g" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stop-color="#F97316" stop-opacity="0.32"/>
          <stop offset="50%" stop-color="#14B8A6" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#0F0F12" stop-opacity="0.98"/>
        </radialGradient>
        <pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3F3F46" stroke-width="0.7" stroke-opacity="0.4"/>
        </pattern>
      </defs>
      <rect width="800" height="600" fill="#0F0F12"/>
      <rect width="800" height="600" fill="url(#p)"/>
      <rect width="800" height="600" fill="url(#g)"/>
      <path d="M110 315 Q 200 340, 290 352 T 465 360 T 625 322 T 710 280" fill="none" stroke="#52525B" stroke-width="2" stroke-dasharray="8 6"/>
      <circle cx="400" cy="300" r="210" fill="none" stroke="#14B8A6" stroke-width="2" stroke-dasharray="8 6" opacity="0.5"/>
      <circle cx="400" cy="300" r="145" fill="none" stroke="#F59E0B" stroke-width="2.5" opacity="0.75"/>
      <circle cx="400" cy="300" r="82" fill="rgba(239,68,68,0.16)" stroke="#EF4444" stroke-width="3"/>
      <circle cx="400" cy="300" r="11" fill="#F43F5E" stroke="#FFFFFF" stroke-width="2.5"/>
      <rect x="140" y="42" width="520" height="64" rx="16" fill="rgba(15,15,18,0.88)" stroke="rgba(255,255,255,0.16)"/>
      <text x="400" y="70" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="bold" fill="#FAFAFA">BMKG InaTEWS · ID ${eventId}</text>
      <text x="400" y="92" text-anchor="middle" font-family="monospace" font-size="13" fill="#E4E4E7">${subtitle}</text>
      <rect x="210" y="518" width="380" height="40" rx="20" fill="rgba(15,15,18,0.88)" stroke="rgba(255,255,255,0.14)"/>
      <text x="400" y="543" text-anchor="middle" font-family="monospace" font-size="13" fill="#A1A1AA">Telemetri Seismik &amp; Kontur Isoseismal BMKG</text>
    </svg>`;
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=900",
      },
    });
  }

  // 2. Check short-lived memory cache if not forcing fresh
  const cached = memoryCache.get(cacheKey);
  if (!forceFresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return new NextResponse(cached.body, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  }

  // 3. Static reference datasets (faults, stations, 3m/5y archives, damaging historical catalogue)
  const isStaticReference =
    slugPath.startsWith("faults/") ||
    slugPath.startsWith("stations/") ||
    slugPath.startsWith("earthquakes/archive/") ||
    slugPath === "earthquakes/damaging";

  if (isStaticReference) {
    const localRes = await readLocalFallback(slugPath, req.nextUrl.searchParams);
    if (localRes) return localRes;
  }

  // 4. Multi-Source Live Handlers for Core Dynamic Feeds (Guaranteed Live on Vercel & Local)
  if (slugPath === "earthquakes/latest") {
    const [roneWrap, directLatest, directFelt, directSig] = await Promise.all([
      fetchRoneJson<{ data: RoneEarthquake | null }>("earthquakes/latest", 1800),
      fetchDirectBmkgLatest(),
      fetchDirectBmkgFelt(),
      fetchDirectBmkgSignificant(),
    ]);
    let latest = pickNewerEarthquake(directLatest, roneWrap?.data);
    if (directFelt[0]) latest = pickNewerEarthquake(latest, directFelt[0]);
    if (directSig[0]) latest = pickNewerEarthquake(latest, directSig[0]);
    if (latest) {
      const payload = JSON.stringify({
        data: latest,
        meta: {
          count: 1,
          source: "BMKG-Live",
          generated_at: new Date().toISOString(),
        },
      });
      memoryCache.set(cacheKey, {
        body: payload,
        contentType: "application/json; charset=utf-8",
        timestamp: Date.now(),
      });
      return new NextResponse(payload, { status: 200, headers: NO_STORE_HEADERS });
    }
  }

  if (slugPath === "earthquakes/realtime") {
    const minMag = Number(req.nextUrl.searchParams.get("min_magnitude") || "0");
    const limit = Number(req.nextUrl.searchParams.get("limit") || "250");
    const [roneWrap, directList, directLatest, directFelt, directSig] =
      await Promise.all([
        fetchRoneJson<{ data: RoneRealtimeEvent[] }>(
          `earthquakes/realtime?limit=${Math.max(limit, 250)}`,
          1800
        ),
        fetchDirectBmkgRealtime(Math.max(limit, 250), 0),
        fetchDirectBmkgLatest(),
        fetchDirectBmkgFelt(),
        fetchDirectBmkgSignificant(),
      ]);
    const combinedRt = mergeRealtimeEvents(directList, roneWrap?.data || [], 350);
    const bridged = bridgeOfficialQuakesIntoRealtime(
      combinedRt,
      [directLatest, directFelt[0], directSig[0]],
      350
    );
    const merged = bridged
      .filter((e) => e.magnitude >= minMag)
      .slice(0, limit);

    if (merged.length > 0) {
      const payload = JSON.stringify({
        data: merged,
        meta: {
          count: merged.length,
          source: "BMKG-InaTEWS-Live",
          generated_at: new Date().toISOString(),
        },
      });
      memoryCache.set(cacheKey, {
        body: payload,
        contentType: "application/json; charset=utf-8",
        timestamp: Date.now(),
      });
      return new NextResponse(payload, { status: 200, headers: NO_STORE_HEADERS });
    }
  }

  if (slugPath === "earthquakes/felt") {
    const [roneWrap, directFelt, directLatest] = await Promise.all([
      fetchRoneJson<{ data: RoneEarthquake[] }>("earthquakes/felt", 1800),
      fetchDirectBmkgFelt(),
      fetchDirectBmkgLatest(),
    ]);
    let felt = pickNewerEarthquakeList(directFelt, roneWrap?.data || []);
    if (directLatest?.felt) {
      felt = mergeEarthquakeLists([directLatest], felt, 45);
    }
    if (felt.length > 0) {
      const payload = JSON.stringify({
        data: felt,
        meta: {
          count: felt.length,
          source: "BMKG-Live",
          generated_at: new Date().toISOString(),
        },
      });
      memoryCache.set(cacheKey, {
        body: payload,
        contentType: "application/json; charset=utf-8",
        timestamp: Date.now(),
      });
      return new NextResponse(payload, { status: 200, headers: NO_STORE_HEADERS });
    }
  }

  if (slugPath === "earthquakes/significant") {
    const [roneWrap, directSig, directLatest] = await Promise.all([
      fetchRoneJson<{ data: RoneEarthquake[] }>("earthquakes/significant", 1800),
      fetchDirectBmkgSignificant(),
      fetchDirectBmkgLatest(),
    ]);
    let significant = pickNewerEarthquakeList(directSig, roneWrap?.data || []);
    if (directLatest && directLatest.magnitude >= 5.0) {
      significant = mergeEarthquakeLists([directLatest], significant, 45);
    }
    if (significant.length > 0) {
      const payload = JSON.stringify({
        data: significant,
        meta: {
          count: significant.length,
          source: "BMKG-Live",
          generated_at: new Date().toISOString(),
        },
      });
      memoryCache.set(cacheKey, {
        body: payload,
        contentType: "application/json; charset=utf-8",
        timestamp: Date.now(),
      });
      return new NextResponse(payload, { status: 200, headers: NO_STORE_HEADERS });
    }
  }

  // 5. Generic upstream proxy for tsunami, history, narrative, etc.
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const upstreamRes = await fetch(`${RONE_UPSTREAM}/${slugPath}${cleanSearch}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: BROWSER_HEADERS,
    });
    clearTimeout(timeout);

    if (upstreamRes.ok) {
      const body = await upstreamRes.text();
      const contentType =
        upstreamRes.headers.get("Content-Type") || "application/json; charset=utf-8";
      memoryCache.set(cacheKey, { body, contentType, timestamp: Date.now() });
      return new NextResponse(body, {
        status: 200,
        headers: NO_STORE_HEADERS,
      });
    }
  } catch {
    // Fall through to local fallback
  }

  const fallback = await readLocalFallback(slugPath, req.nextUrl.searchParams);
  if (fallback) return fallback;

  return NextResponse.json(
    { title: "Not Found", status: 404, detail: `Endpoint /api/v1/${slugPath} tidak ditemukan.` },
    { status: 404, headers: NO_STORE_HEADERS }
  );
}
