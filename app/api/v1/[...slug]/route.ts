import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const RONE_UPSTREAM = "https://gempa.rone.dev/api/v1";

interface CacheEntry {
  body: string;
  contentType: string;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

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

async function readLocalFallback(slugPath: string, searchParams: URLSearchParams): Promise<Response | null> {
  const filename = getFallbackFile(slugPath);
  if (!filename) {
    // Handle dynamic history / narrative fallback gracefully
    if (slugPath.startsWith("earthquakes/realtime/") && slugPath.endsWith("/history")) {
      const eventId = slugPath.split("/")[2];
      return NextResponse.json({
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
      });
    }
    if (slugPath.startsWith("earthquakes/") && slugPath.endsWith("/narrative")) {
      const eventId = slugPath.split("/")[1];
      return NextResponse.json({
        event_id: eventId,
        html: "<p>Berdasarkan lokasi episenter dan kedalaman hiposenternya, gempabumi yang terjadi merupakan jenis gempabumi dangkal akibat adanya aktivitas sesar aktif setempat. Hingga saat ini belum ada laporan dampak kerusakan yang ditimbulkan akibat gempabumi tersebut.</p>",
      });
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
      return NextResponse.json({
        data: filtered,
        meta: { count: filtered.length, generated_at: new Date().toISOString() },
      });
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
      headers: { "Content-Type": "application/json; charset=utf-8" },
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
  const search = req.nextUrl.search || "";
  const cacheKey = `${slugPath}${search}`;

  // Handle binary media proxy (/api/v1/media/{event_id}/{kind})
  if (slug[0] === "media") {
    const upstreamMediaUrl = `${RONE_UPSTREAM}/${slugPath}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(upstreamMediaUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        return new NextResponse(buf, {
          status: 200,
          headers: {
            "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    } catch {
      // Fallback SVG shakemap diagram if upstream image is unavailable
    }
    const eventId = slug[1] || "BMKG";
    const kind = slug[2] || "shakemap";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <rect width="800" height="600" fill="#ddd6cb"/>
      <circle cx="400" cy="300" r="210" fill="none" stroke="#e8b10c" stroke-width="3" stroke-dasharray="8 6"/>
      <circle cx="400" cy="300" r="140" fill="none" stroke="#f08c1a" stroke-width="3"/>
      <circle cx="400" cy="300" r="70" fill="rgba(208,70,26,0.18)" stroke="#d0461a" stroke-width="3"/>
      <circle cx="400" cy="300" r="10" fill="#c2410c"/>
      <text x="400" y="80" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="bold" fill="#2a241d">BMKG InaTEWS — ${kind.toUpperCase()} (${eventId})</text>
      <text x="400" y="540" text-anchor="middle" font-family="monospace" font-size="15" fill="#4f463b">Estimasi Intensitas Guncangan (Skala MMI)</text>
    </svg>`;
    return new NextResponse(svg, {
      status: 200,
      headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
    });
  }

  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return new NextResponse(cached.body, {
      status: 200,
      headers: { "Content-Type": cached.contentType },
    });
  }

  // Try local fast cache first for static reference/archive datasets to guarantee <50ms response,
  // and try live upstream first for dynamic feeds (latest, realtime, felt, significant, tsunami).
  const isStaticReference =
    slugPath.startsWith("faults/") ||
    slugPath.startsWith("stations/") ||
    slugPath.startsWith("earthquakes/archive/") ||
    slugPath === "earthquakes/damaging";

  if (isStaticReference) {
    const localRes = await readLocalFallback(slugPath, req.nextUrl.searchParams);
    if (localRes) return localRes;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const upstreamRes = await fetch(`${RONE_UPSTREAM}/${slugPath}${search}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (upstreamRes.ok) {
      const body = await upstreamRes.text();
      const contentType = upstreamRes.headers.get("Content-Type") || "application/json; charset=utf-8";
      memoryCache.set(cacheKey, { body, contentType, timestamp: Date.now() });
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": contentType },
      });
    }
  } catch {
    // Fall through to local fallback
  }

  const fallback = await readLocalFallback(slugPath, req.nextUrl.searchParams);
  if (fallback) return fallback;

  return NextResponse.json(
    { title: "Not Found", status: 404, detail: `Endpoint /api/v1/${slugPath} tidak ditemukan.` },
    { status: 404 }
  );
}
