import type { RoneEarthquake, RoneRealtimeEvent } from "./format";

const BMKG_GCS_BASE = "https://bmkg-content-inatews.storage.googleapis.com";
const BMKG_TEWS_BASE = "https://data.bmkg.go.id/DataMKG/TEWS";

const DEFAULT_SERVER_HEADERS: Record<string, string> = {
  Accept: "application/json, text/xml, application/xml, */*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

async function fetchTextWithTimeout(
  url: string,
  timeoutMs = 5500,
  includeServerHeaders = typeof window === "undefined"
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = includeServerHeaders
      ? DEFAULT_SERVER_HEADERS
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

/**
 * Parse actual earthquake origin time in WIB (+07:00) from BMKG CAP fields.
 * IMPORTANT: Prefer `fallbackDate` + `fallbackTime` (actual origin time) over `eventId`,
 * because in BMKG CAP XML/JSON (`datagempa.json`, `last30event.xml`), `eventid` is often
 * the bulletin dissemination timestamp (`timesent`), which is 3-10 minutes AFTER `origin_time`.
 */
function parseEventIdToIsoWib(
  eventId?: string,
  fallbackDate?: string,
  fallbackTime?: string
): string {
  // 1. Primary: Parse explicit earthquake date (DD-MM-YY or YYYY-MM-DD) + time (HH:MM:SS WIB)
  if (fallbackDate && fallbackTime) {
    const cleanDate = fallbackDate.trim();
    const timeClean = fallbackTime.replace(/[^\d:]/g, "").trim();
    const parts = cleanDate.split(/[-/]/);
    if (parts.length === 3 && /^\d{2}:\d{2}(:\d{2})?$/.test(timeClean)) {
      const normalizedTime =
        timeClean.length === 5 ? `${timeClean}:00` : timeClean.slice(0, 8);
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const yyyy = parts[0];
        const mm = parts[1].padStart(2, "0");
        const dd = parts[2].padStart(2, "0");
        return `${yyyy}-${mm}-${dd}T${normalizedTime}+07:00`;
      } else {
        // DD-MM-YY or DD-MM-YYYY
        const dd = parts[0].padStart(2, "0");
        const mm = parts[1].padStart(2, "0");
        const yy = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        return `${yy}-${mm}-${dd}T${normalizedTime}+07:00`;
      }
    }
  }

  // 2. Fallback: BMKG eventid format YYYYMMDDHHmmss in WIB (+07:00)
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

  return new Date().toISOString();
}

function parseCoordPair(
  pointCoords?: string,
  latStr?: string,
  lonStr?: string
): { latitude: number; longitude: number } | null {
  if (latStr && lonStr) {
    const latNum = parseFloat(latStr.replace(/[^\d.-]/g, ""));
    const lonNum = parseFloat(lonStr.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
      const hasDirection = /[A-Za-z]/.test(latStr) || /[A-Za-z]/.test(lonStr);
      if (hasDirection) {
        const latSign = /LS|S/i.test(latStr) ? -1 : 1;
        const lonSign = /BB|W/i.test(lonStr) ? -1 : 1;
        return {
          latitude: Number((Math.abs(latNum) * latSign).toFixed(2)),
          longitude: Number((Math.abs(lonNum) * lonSign).toFixed(2)),
        };
      }
      return {
        latitude: Number(latNum.toFixed(2)),
        longitude: Number(lonNum.toFixed(2)),
      };
    }
  }
  if (pointCoords) {
    const [a, b] = pointCoords.split(",").map((v) => parseFloat(v.trim()));
    if (Number.isFinite(a) && Number.isFinite(b)) {
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
 * Parse BMKG InaTEWS `live30event.xml` (SeisComP live repository feed).
 * This feed updates independently of `gempaQL.json` and contains confirmed magnitudes & focal mechanisms.
 */
function parseLive30EventXml(xml: string, minMag = 0): RoneRealtimeEvent[] {
  const blocks = xml.match(/<gempa>[\s\S]*?<\/gempa>/gi) || [];
  const events: RoneRealtimeEvent[] = [];

  for (const block of blocks) {
    const id = extractXmlTag(block, "eventid");
    const statusRaw = extractXmlTag(block, "status").toLowerCase();
    const waktuRaw = extractXmlTag(block, "waktu");
    const latRaw = extractXmlTag(block, "lintang");
    const lonRaw = extractXmlTag(block, "bujur");
    const depthRaw = extractXmlTag(block, "dalam");
    const magRaw = extractXmlTag(block, "mag");
    const fokalRaw = extractXmlTag(block, "fokal").toLowerCase();
    const areaRaw = extractXmlTag(block, "area");

    if (!id || !waktuRaw) continue;
    const mag = Number(parseFloat(magRaw).toFixed(1));
    const depth = Number(parseFloat(depthRaw.replace(/[^\d.-]/g, "")).toFixed(1));
    const lat = Number(parseFloat(latRaw).toFixed(2));
    const lon = Number(parseFloat(lonRaw).toFixed(2));
    if (
      !Number.isFinite(mag) ||
      !Number.isFinite(depth) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      continue;
    }
    if (mag < minMag) continue;

    // waktu format: "2026/10/29  21:46:47.520" (UTC)
    const normalizedWaktu = waktuRaw
      .replace(/\//g, "-")
      .replace(/\s+/g, "T")
      .replace(/Z?$/, "Z");
    const parsedTime = new Date(normalizedWaktu).getTime();
    if (!Number.isFinite(parsedTime)) continue;

    events.push({
      event_id: id,
      origin_time: new Date(parsedTime).toISOString(),
      magnitude: mag,
      depth_km: depth,
      latitude: lat,
      longitude: lon,
      region: areaRaw || "Wilayah Indonesia",
      status:
        statusRaw === "confirmed" || statusRaw === "m" ? "confirmed" : "automatic",
      has_focal_mechanism: fokalRaw.includes("yes"),
    });
  }

  return events;
}

/**
 * 1. Fetch Live Real-Time Seismograph Detections from BOTH BMKG InaTEWS GCS feeds:
 *    - `live30event.xml` (real-time SeisComP repository feed, updates within 1-3 mins)
 *    - `gempaQL.json` (QuickLocation GeoJSON feed with phase counts & micro-earthquakes)
 */
export async function fetchDirectBmkgRealtime(
  limit = 300,
  minMag = 0
): Promise<RoneRealtimeEvent[]> {
  const ts = Date.now();
  const [qlRaw, liveXmlRaw] = await Promise.all([
    fetchTextWithTimeout(`${BMKG_GCS_BASE}/gempaQL.json?t=${ts}`),
    fetchTextWithTimeout(`${BMKG_GCS_BASE}/live30event.xml?t=${ts}`),
  ]);

  const qlEvents: RoneRealtimeEvent[] = [];
  if (qlRaw) {
    try {
      const parsed = JSON.parse(qlRaw) as {
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

      if (Array.isArray(parsed.features)) {
        for (const feat of parsed.features) {
          const p = feat.properties;
          const coords = feat.geometry?.coordinates;
          if (!p?.id || !p?.time || !coords || coords.length < 2) continue;

          const mag = Number(parseFloat(String(p.mag)).toFixed(1));
          const depth = Number(parseFloat(String(p.depth)).toFixed(1));
          const lon = Number(parseFloat(String(coords[0])).toFixed(2));
          const lat = Number(parseFloat(String(coords[1])).toFixed(2));
          if (
            !Number.isFinite(mag) ||
            !Number.isFinite(depth) ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
          ) {
            continue;
          }
          if (mag < minMag) continue;

          const timeStr = String(p.time).trim();
          const isoUtc = timeStr.includes("T")
            ? timeStr
            : `${timeStr.replace(/\s+/g, "T")}${timeStr.endsWith("Z") ? "" : "Z"}`;

          const faseNum =
            p.fase !== undefined ? parseInt(String(p.fase), 10) : undefined;

          qlEvents.push({
            event_id: String(p.id).trim(),
            origin_time: isoUtc,
            magnitude: mag,
            depth_km: depth,
            latitude: lat,
            longitude: lon,
            region: String(p.place || "Wilayah Indonesia").trim(),
            status:
              p.status === "M" || p.status === "confirmed"
                ? "confirmed"
                : "automatic",
            phase_count: Number.isFinite(faseNum) ? faseNum : undefined,
            has_focal_mechanism: false,
          });
        }
      }
    } catch {
      // ignore malformed JSON
    }
  }

  const liveXmlEvents = liveXmlRaw ? parseLive30EventXml(liveXmlRaw, minMag) : [];

  // Merge live30event.xml (preferred for confirmed mag/depth/focal) with gempaQL.json (has phase_count & full list)
  return mergeRealtimeEvents(liveXmlEvents, qlEvents, limit);
}

/**
 * 2. Fetch Latest Earthquake directly from BMKG InaTEWS GCS (datagempa.json) & BMKG TEWS (autogempa.json)
 */
export async function fetchDirectBmkgLatest(): Promise<RoneEarthquake | null> {
  const ts = Date.now();
  const [gcsRaw, tewsRaw] = await Promise.all([
    fetchTextWithTimeout(`${BMKG_GCS_BASE}/datagempa.json?t=${ts}`),
    fetchTextWithTimeout(`${BMKG_TEWS_BASE}/autogempa.json?t=${ts}`),
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
        const depth = parseFloat(
          String(info.depth || "10").replace(/[^\d.]/g, "")
        );
        if (eventId && coords && Number.isFinite(mag)) {
          const potential = info.potential || null;
          const tsunamiPotential =
            Boolean(potential) &&
            !/tidak berpotensi tsunami/i.test(potential!) &&
            /berpotensi tsunami/i.test(potential!);
          const feltClean =
            info.felt && info.felt.trim() !== "-" ? info.felt.trim() : null;
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
            felt: feltClean,
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
        const depth = parseFloat(
          String(g.Kedalaman || "10").replace(/[^\d.]/g, "")
        );
        if (eventId && coords && Number.isFinite(mag)) {
          const potential = g.Potensi || null;
          const tsunamiPotential =
            Boolean(potential) &&
            !/tidak berpotensi tsunami/i.test(potential!) &&
            /berpotensi tsunami/i.test(potential!);
          const feltClean =
            g.Dirasakan && g.Dirasakan.trim() !== "-" ? g.Dirasakan.trim() : null;
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
            felt: feltClean,
            instruction:
              "Hati-hati terhadap gempabumi susulan yang mungkin terjadi",
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
      eventIdRaw ||
      originIso.replace(/\D/g, "").slice(0, 14) ||
      `bmkg-${results.length}`;
    const tsunamiPotential =
      Boolean(potentialStr) &&
      !/tidak berpotensi tsunami/i.test(potentialStr) &&
      /berpotensi tsunami/i.test(potentialStr);
    const feltClean =
      feltStr && feltStr.trim() !== "-" ? feltStr.trim() : null;

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
      felt: feltClean,
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
 * Deduplicate and merge two lists of RoneEarthquake by event_id OR close origin_time (within 10s).
 * Prefers entries in `primary` (which have exact CAP XML event_id for ShakeMaps) while still
 * including any brand-new earthquakes from `secondary` (TEWS JSON / Rone API) that haven't hit XML yet.
 */
export function mergeEarthquakeLists(
  primary: RoneEarthquake[],
  secondary: RoneEarthquake[],
  limit = 60
): RoneEarthquake[] {
  const result: RoneEarthquake[] = [];

  const addOrMerge = (incoming: RoneEarthquake, isPreferred: boolean) => {
    if (!incoming?.origin_time) return;
    const tIn = new Date(incoming.origin_time).getTime();
    if (!Number.isFinite(tIn)) return;

    const existingIdx = result.findIndex((existing) => {
      if (existing.event_id === incoming.event_id) return true;
      const tEx = new Date(existing.origin_time).getTime();
      const timeDiff = Math.abs(tEx - tIn);
      const latDiff = Math.abs(existing.latitude - incoming.latitude);
      const lonDiff = Math.abs(existing.longitude - incoming.longitude);
      return timeDiff <= 15_000 && latDiff <= 0.35 && lonDiff <= 0.35;
    });

    if (existingIdx === -1) {
      result.push(incoming);
    } else if (isPreferred) {
      const prev = result[existingIdx];
      result[existingIdx] = {
        ...prev,
        ...incoming,
        felt: incoming.felt || prev.felt,
        potential: incoming.potential || prev.potential,
      };
    } else {
      const prev = result[existingIdx];
      if (!prev.felt && incoming.felt) {
        result[existingIdx] = { ...prev, felt: incoming.felt };
      }
    }
  };

  for (const ev of primary) addOrMerge(ev, true);
  for (const ev of secondary) addOrMerge(ev, false);

  return result
    .sort(
      (a, b) => new Date(b.origin_time).getTime() - new Date(a.origin_time).getTime()
    )
    .slice(0, limit);
}

/**
 * 3. Fetch Felt Earthquakes directly from BOTH BMKG InaTEWS GCS (last30feltevent.xml)
 *    AND BMKG TEWS (gempadirasakan.json), merging both so whichever updates first is shown immediately.
 */
export async function fetchDirectBmkgFelt(): Promise<RoneEarthquake[]> {
  const ts = Date.now();
  const [xmlRaw, jsonRaw] = await Promise.all([
    fetchTextWithTimeout(`${BMKG_GCS_BASE}/last30feltevent.xml?t=${ts}`),
    fetchTextWithTimeout(`${BMKG_TEWS_BASE}/gempadirasakan.json?t=${ts}`),
  ]);

  const xmlEvents = xmlRaw ? parseCapXmlInfoBlocks(xmlRaw) : [];
  const jsonEvents: RoneEarthquake[] = [];

  if (jsonRaw) {
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
        const depth = parseFloat(
          String(g.Kedalaman || "10").replace(/[^\d.]/g, "")
        );
        if (!coords || !Number.isFinite(mag) || !g.DateTime) continue;
        const wibDate = new Date(new Date(g.DateTime).getTime() + 7 * 3600_000);
        const eventId = wibDate
          .toISOString()
          .replace(/\D/g, "")
          .slice(0, 14);
        jsonEvents.push({
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
          instruction:
            "Hati-hati terhadap gempabumi susulan yang mungkin terjadi",
          has_narrative: false,
          media: buildMediaLinks(eventId),
        });
      }
    } catch {
      // ignore
    }
  }

  return mergeEarthquakeLists(xmlEvents, jsonEvents, 45);
}

/**
 * 4. Fetch Significant M5+ Earthquakes directly from BOTH BMKG InaTEWS GCS (last30event.xml)
 *    AND BMKG TEWS (gempaterkini.json), merging both so whichever updates first is shown immediately.
 */
export async function fetchDirectBmkgSignificant(): Promise<RoneEarthquake[]> {
  const ts = Date.now();
  const [xmlRaw, jsonRaw] = await Promise.all([
    fetchTextWithTimeout(`${BMKG_GCS_BASE}/last30event.xml?t=${ts}`),
    fetchTextWithTimeout(`${BMKG_TEWS_BASE}/gempaterkini.json?t=${ts}`),
  ]);

  const xmlEvents = xmlRaw ? parseCapXmlInfoBlocks(xmlRaw) : [];
  const jsonEvents: RoneEarthquake[] = [];

  if (jsonRaw) {
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
        const depth = parseFloat(
          String(g.Kedalaman || "10").replace(/[^\d.]/g, "")
        );
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
        jsonEvents.push({
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
          instruction:
            "Hati-hati terhadap gempabumi susulan yang mungkin terjadi",
          has_narrative: false,
          media: buildMediaLinks(eventId),
        });
      }
    } catch {
      // ignore
    }
  }

  return mergeEarthquakeLists(xmlEvents, jsonEvents, 45);
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
        has_focal_mechanism:
          Boolean(ev.has_focal_mechanism) || Boolean(existing?.has_focal_mechanism),
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
 * Bridge brand-new official BMKG earthquakes (`latest`, `felt`, `significant`) into the
 * `realtime` list if `gempaQL.json` / `live30event.xml` hasn't exported them yet.
 * This eliminates the ~10 minute batch delay when an earthquake is already announced on BMKG.
 */
export function bridgeOfficialQuakesIntoRealtime(
  realtime: RoneRealtimeEvent[],
  officials: Array<RoneEarthquake | null | undefined>,
  limit = 300
): RoneRealtimeEvent[] {
  const list = [...realtime];

  for (const q of officials) {
    if (!q?.origin_time || !q.event_id) continue;
    const tQ = new Date(q.origin_time).getTime();
    if (!Number.isFinite(tQ)) continue;

    const alreadyPresent = list.some((rt) => {
      if (rt.event_id === q.event_id) return true;
      const tRt = new Date(rt.origin_time).getTime();
      const timeDiff = Math.abs(tRt - tQ);
      const latDiff = Math.abs(rt.latitude - q.latitude);
      const lonDiff = Math.abs(rt.longitude - q.longitude);
      return timeDiff <= 90_000 && latDiff <= 0.75 && lonDiff <= 0.75;
    });

    if (!alreadyPresent) {
      list.push({
        event_id: q.event_id,
        origin_time: new Date(tQ).toISOString(),
        magnitude: q.magnitude,
        depth_km: q.depth_km,
        latitude: q.latitude,
        longitude: q.longitude,
        region: q.region,
        status: "confirmed",
        has_focal_mechanism: false,
      });
    }
  }

  return list
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
    if (Math.abs(tA - tB) <= 15_000) {
      // Same earthquake: prefer the one with a felt report or non-synthetic event_id
      if (a.felt && !b.felt) return a;
      if (b.felt && !a.felt) return b;
      return a;
    }
    return tB > tA ? b : a;
  }
  return a || b || null;
}

/**
 * Helper to merge and sort two RoneEarthquake[] lists so no recent event is lost.
 */
export function pickNewerEarthquakeList(
  a: RoneEarthquake[],
  b: RoneEarthquake[]
): RoneEarthquake[] {
  if (a.length && b.length) {
    return mergeEarthquakeLists(a, b, Math.max(a.length, b.length, 45));
  }
  return a.length ? a : b;
}
