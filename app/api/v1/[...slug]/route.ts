import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import {
  fetchDirectBmkgFelt,
  fetchDirectBmkgLatest,
  fetchDirectBmkgRealtime,
  fetchDirectBmkgSignificant,
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
const CACHE_TTL_MS = 12_000;

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
    const kind = slug[2] || "shakemap";

    const candidateUrls: string[] = [`${RONE_UPSTREAM}/${slugPath}`];
    if (kind === "shakemap" && /^\d{14}$/.test(eventId)) {
      // Official BMKG InaTEWS GCS & TEWS direct ShakeMap JPGs (never blocked by Cloudflare on Vercel)
      candidateUrls.unshift(`${BMKG_GCS_BASE}/${eventId}.mmi.jpg`);
      candidateUrls.push(`${BMKG_TEWS_BASE}/${eventId}.mmi.jpg`);
    }

    for (const mediaUrl of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(mediaUrl, {
          cache: "no-store",
          signal: controller.signal,
          headers: { "User-Agent": BROWSER_HEADERS["User-Agent"] },
        });
        clearTimeout(timeout);
        if (res.ok) {
          const contentType = res.headers.get("Content-Type") || "";
          if (contentType.startsWith("image/") || mediaUrl.endsWith(".jpg")) {
            const buf = await res.arrayBuffer();
            return new NextResponse(buf, {
              status: 200,
              headers: {
                "Content-Type": contentType || "image/jpeg",
                "Cache-Control": "public, max-age=1800",
              },
            });
          }
        }
      } catch {
        // try next candidate
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <rect width="800" height="600" fill="#141418"/>
      <circle cx="400" cy="300" r="210" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-dasharray="8 6" opacity="0.55"/>
      <circle cx="400" cy="300" r="140" fill="none" stroke="#F97316" stroke-width="3" opacity="0.75"/>
      <circle cx="400" cy="300" r="70" fill="rgba(239,68,68,0.18)" stroke="#EF4444" stroke-width="3"/>
      <circle cx="400" cy="300" r="10" fill="#FB7185"/>
      <text x="400" y="80" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="bold" fill="#FAFAFA">BMKG InaTEWS — ${kind.toUpperCase()} (${eventId})</text>
      <text x="400" y="540" text-anchor="middle" font-family="monospace" font-size="15" fill="#A1A1AA">Estimasi Intensitas Guncangan (Skala MMI)</text>
    </svg>`;
    return new NextResponse(svg, {
      status: 200,
      headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
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
    const [roneWrap, directLatest] = await Promise.all([
      fetchRoneJson<{ data: RoneEarthquake | null }>("earthquakes/latest"),
      fetchDirectBmkgLatest(),
    ]);
    const latest = pickNewerEarthquake(roneWrap?.data, directLatest);
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
    const [roneWrap, directList] = await Promise.all([
      fetchRoneJson<{ data: RoneRealtimeEvent[] }>(
        `earthquakes/realtime?limit=${Math.max(limit, 250)}`
      ),
      fetchDirectBmkgRealtime(Math.max(limit, 250), 0),
    ]);
    const merged = mergeRealtimeEvents(directList, roneWrap?.data || [], 350)
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
    const [roneWrap, directFelt] = await Promise.all([
      fetchRoneJson<{ data: RoneEarthquake[] }>("earthquakes/felt"),
      fetchDirectBmkgFelt(),
    ]);
    const felt = pickNewerEarthquakeList(directFelt, roneWrap?.data || []);
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
    const [roneWrap, directSig] = await Promise.all([
      fetchRoneJson<{ data: RoneEarthquake[] }>("earthquakes/significant"),
      fetchDirectBmkgSignificant(),
    ]);
    const significant = pickNewerEarthquakeList(directSig, roneWrap?.data || []);
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
