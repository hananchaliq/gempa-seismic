import type { RoneEarthquake, RoneRealtimeEvent } from "./format";

const BMKG_GCS_BASE = "https://bmkg-content-inatews.storage.googleapis.com";
const BMKG_TEWS_BASE = "https://data.bmkg.go.id/DataMKG/TEWS";

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: "application/json, text/xml, application/xml, */*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

async function fetchTextWithTimeout(
  url: string,
  timeoutMs = 5500,
  includeCustomUA = typeof window === "undefined"
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = includeCustomUA
      ? DEFAULT_HEADERS
      : { Accept: "application/json, text/xml, */*" };
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildMediaLinks(eventId: string) {
  return {
    shakemap: `/api/v1/media/${eventId}/shakemap`,
    location_map: `/api/v1/media/${eventId}/location-map`,
    station_intensity: `/api/v1/media/${eventId}/station-intensity`,
    impact: `/api/v1/media/${eventId}/impact`,
    intensity: `/api/v1/media/${eventId}/intensity`,
  };
}

function parseEventIdToIsoWib(
  eventId?: string,
  fallbackDate?: string,
  fallbackTime?: string
): string {
  // BMKG eventid format: YYYYMMDDHHmmss in WIB (+07:00), e.g. "20261028152346"
  if (eventId && /^\d{14}$/.test(eventId.trim())) {
    const s = eventId.trim();
    const yyyy = s.slice(0, 4);
    const mm = s.slice(4, 6);
    const dd = s.slice(6, 8);
    const hh = s.slice(8, 10);
    const mi = s.slice(10, 12);
    const ss = s.slice(12, 14);
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+07:00`;
  }
  // Fallback for DD-MM-YY + HH:MM:SS WIB
  if (fallbackDate && fallbackTime) {
    const parts = fallbackDate.trim().split("-");
    const timeClean = fallbackTime.replace(/[^\d:]/g, "").trim();
    if (parts.length === 3 && timeClean) {
      const dd = parts[0].padStart(2, "0");
      const mm = parts[1].padStart(2, "0");
      const yy = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${yy}-${mm}-${dd}T${timeClean}+07:00`;
    }
  }
  return new Date().toISOString();
}

function parseCoordPair(
  pointCoords?: string,
  latStr?: string,
  lonStr?: string
): { latitude: number; longitude: number } | null {
  // Note: In BMKG CAP XML / datagempa.json, point.coordinates is "LON,LAT" (e.g. "104.62,-5.45")
  // whereas in data.bmkg.go.id JSON, Coordinates is "LAT,LON" (e.g. "-5.45,104.62").
  if (latStr && lonStr) {
    const latNum = parseFloat(latStr.replace(/[^\d.]/g, ""));
    const lonNum = parseFloat(lonStr.replace(/[^\d.]/g, ""));
    if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
      const latSign = /LS|S/i.test(latStr) ? -1 : 1;
      const lonSign = /BB|W/i.test(lonStr) ? -1 : 1;
      return {
        latitude: Number((latNum * latSign).toFixed(2)),
        longitude: Number((lonNum * lonSign).toFixed(2)),
      };
    }
  }
  if (pointCoords) {
    const [a, b] = pointCoords.split(",").map((v) => parseFloat(v.trim()));
    if (Number.isFinite(a) && Number.isFinite(b)) {
      // Indonesia longitudes are ~90..145, latitudes are ~-12..10
      if (Math.abs(a) > 60 && Math.abs(b) <= 60) {
        return { latitude: Number(b.toFixed(2)), longitude: Number(a.toFixed(2)) };
      }
      return { latitude: Number(a.toFixed(2)), longitude: Number(b.toFixed(2)) };
    }
  }
  return null;
}

function extractXmlTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

/**
 * 1. Fetch Live Real-Time Seismograph Detections directly from BMKG InaTEWS GCS (gempaQL.json)
 */
export async function fetchDirectBmkgRealtime(
  limit = 300,
  minMag = 0
): Promise<RoneRealtimeEvent[]> {
  const raw = await fetchTextWithTimeout(
    `${BMKG_GCS_BASE}/gempaQL.json?t=${Math.floor(Date.now() / 15000)}`
  );
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as {
      features?: Array<{
        geometry?: { coordinates?: [string | number, string | number, number?] };
        properties?: {
          id?: string;
          time?: string;
          mag?: string | number;
          depth?: string | number;
          place?: string;
          status?: string;
          fase?: string | number;
        };
      }>;
    };

    if (!Array.isArray(parsed.features)) return [];

    const events: RoneRealtimeEvent[] = [];
    for (const feat of parsed.features) {
      const p = feat.properties;
      const coords = feat.geometry?.coordinates;
      if (!p?.id || !p?.time || !coords || coords.length < 2) continue;

      const mag = Number(parseFloat(String(p.mag)).toFixed(1));
      const depth = Number(parseFloat(String(p.depth)).toFixed(1));
      const lon = Number(parseFloat(String(coords[0])).toFixed(2));
      const lat = Number(parseFloat(String(coords[1])).toFixed(2));
      if (!Number.isFinite(mag) || !Number.isFinite(depth) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        continue;
      }
      if (mag < minMag) continue;

      // p.time is UTC "YYYY-MM-DD HH:MM:SS.ffffff"
      const timeStr = String(p.time).trim();
      const isoUtc = timeStr.includes("T")
        ? timeStr
        : `${timeStr.replace(" ", "T")}${timeStr.endsWith("Z") ? "" : "Z"}`;

      const faseNum = p.fase !== undefined ? parseInt(String(p.fase), 10) : undefined;

      events.push({
        event_id: String(p.id).trim(),
        origin_time: isoUtc,
        magnitude: mag,
        depth_km: depth,
        latitude: lat,
        longitude: lon,
        region: String(p.place || "Wilayah Indonesia").trim(),
        status:
          p.status === "M" || p.status === "confirmed" ? "confirmed" : "automatic",
        phase_count: Number.isFinite(faseNum) ? faseNum : undefined,
        has_focal_mechanism: false,
      });
    }

    events.sort(
      (a, b) => new Date(b.origin_time).getTime() - new Date(a.origin_time).getTime()
    );

    return events.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * 2. Fetch Latest Felt Earthquake directly from BMKG InaTEWS GCS (datagempa.json) & BMKG TEWS (autogempa.json)
 */
export async function fetchDirectBmkgLatest(): Promise<RoneEarthquake | null> {
  const bucket = Math.floor(Date.now() / 15000);
  const [gcsRaw, tewsRaw] = await Promise.all([
    fetchTextWithTimeout(`${BMKG_GCS_BASE}/datagempa.json?t=${bucket}`),
    fetchTextWithTimeout(`${BMKG_TEWS_BASE}/autogempa.json?t=${bucket}`),
  ]);

  const candidates: RoneEarthquake[] = [];

  if (gcsRaw) {
    try {
      const j = JSON.parse(gcsRaw) as {
        info?: {
          eventid?: string;
          date?: string;
          time?: string;
          point?: { coordinates?: string };
          latitude?: string;
          longitude?: string;
          magnitude?: string | number;
          depth?: string;
          area?: string;
          potential?: string;
          felt?: string;
          instruction?: string;
          shakemap?: string;
        };
      };
      const info = j.info;
      if (info) {
        const eventId = (
          info.eventid ||
          (info.shakemap ? info.shakemap.replace(/\..*$/, "") : "")
        ).trim();
        const coords = parseCoordPair(
          info.point?.coordinates,
          info.latitude,
          info.longitude
        );
        const mag = parseFloat(String(info.magnitude || "0"));
        const depth = parseFloat(String(info.depth || "10").replace(/[^\d.]/g, ""));
        if (eventId && coords && Number.isFinite(mag)) {
          const potential = info.potential || null;
          const tsunamiPotential =
            Boolean(potential) &&
            !/tidak berpotensi tsunami/i.test(potential!) &&
            /berpotensi tsunami/i.test(potential!);
          candidates.push({
            event_id: eventId,
            origin_time: parseEventIdToIsoWib(eventId, info.date, info.time),
            magnitude: mag,
            depth_km: Number.isFinite(depth) ? depth : 10,
            latitude: coords.latitude,
            longitude: coords.longitude,
            region: info.area || "Wilayah Indonesia",
            tsunami_potential: tsunamiPotential,
            potential,
            felt: info.felt || null,
            instruction: info.instruction || null,
            has_narrative: false,
            media: buildMediaLinks(eventId),
          });
        }
      }
    } catch {
      // ignore
    }
  }

  if (tewsRaw) {
    try {
      const j = JSON.parse(tewsRaw) as {
        Infogempa?: {
          gempa?: {
            DateTime?: string;
            Coordinates?: string;
            Lintang?: string;
            Bujur?: string;
            Magnitude?: string;
            Kedalaman?: string;
            Wilayah?: string;
            Potensi?: string;
            Dirasakan?: string;
            Shakemap?: string;
          };
        };
      };
      const g = j.Infogempa?.gempa;
      if (g) {
        const eventId = g.Shakemap
          ? g.Shakemap.replace(/\..*$/, "").trim()
          : (g.DateTime || "").replace(/\D/g, "").slice(0, 14);
        const coords = parseCoordPair(g.Coordinates, g.Lintang, g.Bujur);
        const mag = parseFloat(String(g.Magnitude || "0"));
        const depth = parseFloat(String(g.Kedalaman || "10").replace(/[^\d.]/g, ""));
        if (eventId && coords && Number.isFinite(mag)) {
          const potential = g.Potensi || null;
          const tsunamiPotential =
            Boolean(potential) &&
            !/tidak berpotensi tsunami/i.test(potential!) &&
            /berpotensi tsunami/i.test(potential!);
          candidates.push({
            event_id: eventId,
            origin_time: g.DateTime || parseEventIdToIsoWib(eventId),
            magnitude: mag,
            depth_km: Number.isFinite(depth) ? depth : 10,
            latitude: coords.latitude,
            longitude: coords.longitude,
            region: g.Wilayah || "Wilayah Indonesia",
            tsunami_potential: tsunamiPotential,
            potential,
            felt: g.Dirasakan || null,
            instruction: "Hati-hati terhadap gempabumi susulan yang mungkin terjadi",
            has_narrative: false,
            media: buildMediaLinks(eventId),
          });
        }
      }
    } catch {
      // ignore
    }
  }

  if (!candidates.length) return null;
  candidates.sort(
    (a, b) => new Date(b.origin_time).getTime() - new Date(a.origin_time).getTime()
  );
  return candidates[0];
}

function parseCapXmlInfoBlocks(xml: string): RoneEarthquake[] {
  const blocks = xml.match(/<info>[\s\S]*?<\/info>/gi) || [];
  const results: RoneEarthquake[] = [];

  for (const block of blocks) {
    const eventIdRaw =
      extractXmlTag(block, "eventid") ||
      extractXmlTag(block, "shakemap").replace(/\..*$/, "");
    const dateStr = extractXmlTag(block, "date");
    const timeStr = extractXmlTag(block, "time");
    const coordsStr = extractXmlTag(block, "coordinates");
    const latStr = extractXmlTag(block, "latitude");
    const lonStr = extractXmlTag(block, "longitude");
    const magStr = extractXmlTag(block, "magnitude");
    const depthStr = extractXmlTag(block, "depth");
    const areaStr = extractXmlTag(block, "area");
    const potentialStr = extractXmlTag(block, "potential");
    const feltStr = extractXmlTag(block, "felt");
    const instructionStr = extractXmlTag(block, "instruction");

    const coords = parseCoordPair(coordsStr, latStr, lonStr);
    const mag = parseFloat(magStr);
    const depth = parseFloat(depthStr.replace(/[^\d.]/g, ""));
    if (!coords || !Number.isFinite(mag)) continue;

    const originIso = parseEventIdToIsoWib(eventIdRaw, dateStr, timeStr);
    const eventId =
      eventIdRaw || originIso.replace(/\D/g, "").slice(0, 14) || `bmkg-${results.length}`;
    const tsunamiPotential =
      Boolean(potentialStr) &&
      !/tidak berpotensi tsunami/i.test(potentialStr) &&
      /berpotensi tsunami/i.test(potentialStr);

    results.push({
      event_id: eventId,
      origin_time: originIso,
      magnitude: mag,
      depth_km: Number.isFinite(depth) ? depth : 10,
      latitude: coords.latitude,
      longitude: coords.longitude,
      region: areaStr || "Wilayah Indonesia",
      tsunami_potential: tsunamiPotential,
      potential: potentialStr || null,
      felt: feltStr || null,
      instruction: instructionStr || null,
      has_narrative: false,
      media: buildMediaLinks(eventId),
    });
  }

  results.sort(
    (a, b) => new Date(b.origin_time).getTime() - new Date(a.origin_time).getTime()
  );
  return results;
}

/**
 * 3. Fetch Felt Earthquakes directly from BMKG InaTEWS GCS (last30feltevent.xml) & BMKG TEWS (gempadirasakan.json)
 */
export async function fetchDirectBmkgFelt(): Promise<RoneEarthquake[]> {
  const bucket = Math.floor(Date.now() / 30000);
  const [xmlRaw, jsonRaw] = await Promise.all([
    fetchTextWithTimeout(`${BMKG_GCS_BASE}/last30feltevent.xml?t=${bucket}`),
    fetchTextWithTimeout(`${BMKG_TEWS_BASE}/gempadirasakan.json?t=${bucket}`),
  ]);

  const map = new Map<string, RoneEarthquake>();

  if (xmlRaw) {
    for (const ev of parseCapXmlInfoBlocks(xmlRaw)) {
      map.set(ev.event_id, ev);
    }
  }

  if (jsonRaw && map.size === 0) {
    try {
      const j = JSON.parse(jsonRaw) as {
        Infogempa?: {
          gempa?: Array<{
            DateTime?: string;
            Coordinates?: string;
            Lintang?: string;
            Bujur?: string;
            Magnitude?: string;
            Kedalaman?: string;
            Wilayah?: string;
            Dirasakan?: string;
          }>;
        };
      };
      for (const g of j.Infogempa?.gempa || []) {
        const coords = parseCoordPair(g.Coordinates, g.Lintang, g.Bujur);
        const mag = parseFloat(String(g.Magnitude || "0"));
        const depth = parseFloat(String(g.Kedalaman || "10").replace(/[^\d.]/g, ""));
        if (!coords || !Number.isFinite(mag) || !g.DateTime) continue;
        // Convert UTC DateTime to WIB YYYYMMDDHHmmss ID
        const wibDate = new Date(new Date(g.DateTime).getTime() + 7 * 3600_000);
        const eventId = wibDate
          .toISOString()
          .replace(/\D/g, "")
          .slice(0, 14);
        map.set(eventId, {
          event_id: eventId,
          origin_time: g.DateTime,
          magnitude: mag,
          depth_km: Number.isFinite(depth) ? depth : 10,
          latitude: coords.latitude,
          longitude: coords.longitude,
          region: g.Wilayah || "Wilayah Indonesia",
          tsunami_potential: false,
          potential: "Gempa ini dirasakan untuk diteruskan pada masyarakat",
          felt: g.Dirasakan || null,
          instruction: "Hati-hati terhadap gempabumi susulan yang mungkin terjadi",
          has_narrative: false,
          media: buildMediaLinks(eventId),
        });
      }
    } catch {
      // ignore
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.origin_time).getTime() - new Date(a.origin_time).getTime()
  );
}

/**
 * 4. Fetch Significant M5+ Earthquakes directly from BMKG InaTEWS GCS (last30event.xml) & BMKG TEWS (gempaterkini.json)
 */
export async function fetchDirectBmkgSignificant(): Promise<RoneEarthquake[]> {
  const bucket = Math.floor(Date.now() / 30000);
  const [xmlRaw, jsonRaw] = await Promise.all([
    fetchTextWithTimeout(`${BMKG_GCS_BASE}/last30event.xml?t=${bucket}`),
    fetchTextWithTimeout(`${BMKG_TEWS_BASE}/gempaterkini.json?t=${bucket}`),
  ]);

  const map = new Map<string, RoneEarthquake>();

  if (xmlRaw) {
    for (const ev of parseCapXmlInfoBlocks(xmlRaw)) {
      map.set(ev.event_id, ev);
    }
  }

  if (jsonRaw && map.size === 0) {
    try {
      const j = JSON.parse(jsonRaw) as {
        Infogempa?: {
          gempa?: Array<{
            DateTime?: string;
            Coordinates?: string;
            Lintang?: string;
            Bujur?: string;
            Magnitude?: string;
            Kedalaman?: string;
            Wilayah?: string;
            Potensi?: string;
          }>;
        };
      };
      for (const g of j.Infogempa?.gempa || []) {
        const coords = parseCoordPair(g.Coordinates, g.Lintang, g.Bujur);
        const mag = parseFloat(String(g.Magnitude || "0"));
        const depth = parseFloat(String(g.Kedalaman || "10").replace(/[^\d.]/g, ""));
        if (!coords || !Number.isFinite(mag) || !g.DateTime) continue;
        const wibDate = new Date(new Date(g.DateTime).getTime() + 7 * 3600_000);
        const eventId = wibDate
          .toISOString()
          .replace(/\D/g, "")
          .slice(0, 14);
        const potential = g.Potensi || null;
        const tsunamiPotential =
          Boolean(potential) &&
          !/tidak berpotensi tsunami/i.test(potential!) &&
          /berpotensi tsunami/i.test(potential!);
        map.set(eventId, {
          event_id: eventId,
          origin_time: g.DateTime,
          magnitude: mag,
          depth_km: Number.isFinite(depth) ? depth : 10,
          latitude: coords.latitude,
          longitude: coords.longitude,
          region: g.Wilayah || "Wilayah Indonesia",
          tsunami_potential: tsunamiPotential,
          potential,
          felt: null,
          instruction: "Hati-hati terhadap gempabumi susulan yang mungkin terjadi",
          has_narrative: false,
          media: buildMediaLinks(eventId),
        });
      }
    } catch {
      // ignore
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.origin_time).getTime() - new Date(a.origin_time).getTime()
  );
}

/**
 * Helper to merge two lists of RoneRealtimeEvent deduplicated by event_id, sorted newest first.
 */
export function mergeRealtimeEvents(
  primary: RoneRealtimeEvent[],
  secondary: RoneRealtimeEvent[],
  limit = 300
): RoneRealtimeEvent[] {
  const map = new Map<string, RoneRealtimeEvent>();
  for (const ev of secondary) {
    if (ev?.event_id) map.set(ev.event_id, ev);
  }
  for (const ev of primary) {
    if (ev?.event_id) {
      const existing = map.get(ev.event_id);
      map.set(ev.event_id, {
        ...existing,
        ...ev,
        phase_count: ev.phase_count ?? existing?.phase_count,
      });
    }
  }
  return Array.from(map.values())
    .sort(
      (a, b) => new Date(b.origin_time).getTime() - new Date(a.origin_time).getTime()
    )
    .slice(0, limit);
}

/**
 * Helper to pick the newer RoneEarthquake between two candidates.
 */
export function pickNewerEarthquake(
  a: RoneEarthquake | null | undefined,
  b: RoneEarthquake | null | undefined
): RoneEarthquake | null {
  if (a && b) {
    const tA = new Date(a.origin_time).getTime();
    const tB = new Date(b.origin_time).getTime();
    return tB > tA ? b : a;
  }
  return a || b || null;
}

/**
 * Helper to pick the fresher RoneEarthquake[] list between two candidates.
 */
export function pickNewerEarthquakeList(
  a: RoneEarthquake[],
  b: RoneEarthquake[]
): RoneEarthquake[] {
  if (a.length && b.length) {
    const tA = new Date(a[0].origin_time).getTime();
    const tB = new Date(b[0].origin_time).getTime();
    return tB > tA ? b : a;
  }
  return a.length ? a : b;
}
