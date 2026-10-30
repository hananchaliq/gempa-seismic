/**
 * Pure formatting, bucketing, weekly chart calculation, and distance helpers
 * ported 1:1 from ridwaanhall/gempa (app/static/js/lib/format.js, chart.js, detail.js).
 */

export interface RoneEarthquake {
  event_id: string;
  origin_time: string;
  magnitude: number;
  depth_km: number;
  latitude: number;
  longitude: number;
  region: string;
  tsunami_potential?: boolean;
  potential?: string | null;
  felt?: string | null;
  instruction?: string | null;
  has_narrative?: boolean;
  media?: {
    shakemap?: string | null;
    impact?: string | null;
    station_intensity?: string | null;
    location_map?: string | null;
    intensity?: string | null;
  };
}

export interface RoneRealtimeEvent {
  event_id: string;
  origin_time: string;
  magnitude: number;
  depth_km: number;
  latitude: number;
  longitude: number;
  region: string;
  status: string;
  phase_count?: number;
  has_focal_mechanism: boolean;
}

export interface RoneDamagingEvent {
  event_id: string;
  origin_time: string;
  magnitude: number;
  depth_km: number;
  latitude: number;
  longitude: number;
  province: string;
  epicenter: string;
  impact: string | null;
  tsunami: boolean;
  felt: Array<{ intensity: string; place: string }>;
  source?: string;
}

export interface RoneTsunamiZone {
  province: string;
  district: string;
  level: "AWAS" | "SIAGA" | "WASPADA" | string;
  estimated_arrival?: string | null;
}

export interface RoneTsunamiObservation {
  station?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  time?: string;
  observed_at?: string;
  height_m: number;
}

export interface RoneTsunamiBulletin {
  event_id: string;
  code: string;
  issued_at: string;
  magnitude: number;
  headline?: string;
  description?: string;
  zones?: RoneTsunamiZone[];
  warning_zones?: RoneTsunamiZone[];
  observations: RoneTsunamiObservation[];
  media?: {
    warning_zones?: string | null;
    travel_time?: string | null;
    sea_height?: string | null;
    shakemap?: string | null;
  };
}

export interface RoneTsunamiEvent {
  id: string;
  origin_time: string;
  magnitude: number;
  depth_km: number;
  latitude: number;
  longitude: number;
  region: string;
  ended: boolean;
  max_level: string | null;
  max_wave_height_m: number | null;
  instructions: string[];
  bulletins: RoneTsunamiBulletin[];
}

export interface RoneStation {
  code: string;
  name: string;
  network: string;
  latitude: number;
  longitude: number;
}

export interface RoneHistoryRecord {
  timestamp: string;
  minutes_after_origin: number | null;
  latitude?: number | null;
  longitude?: number | null;
  magnitude: number | null;
  magnitude_type: string | null;
  magnitude_count?: number | null;
  depth_km: number | null;
  phase_count: number | null;
  status?: string | null;
}

const tzDateTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const tzLong = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const tzTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const tzShortTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const utcDate = new Intl.DateTimeFormat("id-ID", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const num1 = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const num2 = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numInt = new Intl.NumberFormat("id-ID");

export function fmtMag(m: number | null | undefined): string {
  return m == null ? "–" : num1.format(m);
}

export function fmtMagUnit(m: number | null | undefined): string {
  return m == null ? "–" : `M ${num1.format(m)}`;
}

export function fmtDepth(km: number | null | undefined): string {
  return km == null ? "–" : `${numInt.format(Math.round(km))} km`;
}

export function fmtNumber(n: number | null | undefined): string {
  return n == null ? "–" : numInt.format(n);
}

export function fmtDecimal(n: number | null | undefined): string {
  return n == null ? "–" : num2.format(n);
}

export function fmtCoords(lat: number, lon: number): string {
  const ns = lat < 0 ? "LS" : "LU";
  const ew = lon < 0 ? "BB" : "BT";
  return `${num2.format(Math.abs(lat))}° ${ns}, ${num2.format(Math.abs(lon))}° ${ew}`;
}

const FLEX_MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  mei: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  agu: "08",
  sep: "09",
  oct: "10",
  okt: "10",
  nov: "11",
  dec: "12",
  des: "12",
};

function parseFlexibleDate(raw: string): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const m = trimmed.match(
    /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/
  );
  if (m) {
    const day = m[1].padStart(2, "0");
    const mon = FLEX_MONTHS[m[2].toLowerCase()];
    const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
    const hh = m[4].padStart(2, "0");
    const mm = m[5].padStart(2, "0");
    if (mon) {
      const d = new Date(`${yr}-${mon}-${day}T${hh}:${mm}:00+07:00`);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

function stripSecondsFallback(raw: string): string {
  return raw
    .replace(/(\b\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\b/g, "$1.$2")
    .trim();
}

export function fmtDateTime(iso: string): string {
  if (!iso) return "–";
  const d = parseFlexibleDate(iso);
  if (!d) return stripSecondsFallback(iso);
  return `${tzDateTime.format(d)} WIB`;
}

export function fmtLong(iso: string): string {
  if (!iso) return "–";
  const d = parseFlexibleDate(iso);
  if (!d) return stripSecondsFallback(iso);
  return `${tzLong.format(d)} WIB`;
}

export function fmtTime(iso: string): string {
  if (!iso) return "–";
  const d = parseFlexibleDate(iso);
  if (!d) return stripSecondsFallback(iso);
  return `${tzTime.format(d)} WIB`;
}

export function fmtTimeOnly(iso: string): string {
  if (!iso) return "–";
  const d = parseFlexibleDate(iso);
  if (!d) {
    return stripSecondsFallback(iso).replace(/\s*WIB$/i, "").trim();
  }
  return tzTime.format(d);
}

export function fmtClockWib(date: Date = new Date()): string {
  return tzShortTime.format(date);
}

export function fmtUtcDate(iso: string): string {
  return utcDate.format(new Date(iso));
}

export function fmtRelative(iso: string, nowMs: number = Date.now()): string {
  const sec = Math.round((nowMs - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(sec)) return "";
  if (sec < 45) return "baru saja";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} menit yang lalu`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} jam yang lalu`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} hari yang lalu`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo} bulan yang lalu`;
  return `${Math.round(day / 365)} tahun yang lalu`;
}

export function magBucket(m: number): "0" | "3" | "4" | "5" | "6" | "7" {
  if (m >= 7) return "7";
  if (m >= 6) return "6";
  if (m >= 5) return "5";
  if (m >= 4) return "4";
  if (m >= 3) return "3";
  return "0";
}

export type SeismicStrengthCategory =
  | "Mikro"
  | "Ringan"
  | "Sedang"
  | "Kuat"
  | "Besar"
  | "Dahsyat";

export function magCategory(m: number): SeismicStrengthCategory {
  if (!Number.isFinite(m) || m < 3) return "Mikro";
  if (m < 4) return "Ringan";
  if (m < 5) return "Sedang";
  if (m < 6) return "Kuat";
  if (m < 7) return "Besar";
  return "Dahsyat";
}

export function magScaleRange(m: number): string {
  if (m >= 7) return "M ≥ 7,0";
  if (m >= 6) return "M 6,0–6,9";
  if (m >= 5) return "M 5,0–5,9";
  if (m >= 4) return "M 4,0–4,9";
  if (m >= 3) return "M 3,0–3,9";
  return "M < 3,0";
}

export interface MagTierInfo {
  bucket: "0" | "3" | "4" | "5" | "6" | "7";
  shortTag: string;
  levelLabel: SeismicStrengthCategory;
  isHigh: boolean;
}

export function magTierInfo(m: number): MagTierInfo {
  const bucket = magBucket(m);
  if (bucket === "7") {
    return { bucket, shortTag: "M 7+", levelLabel: "Dahsyat", isHigh: true };
  }
  if (bucket === "6") {
    return { bucket, shortTag: "M 6", levelLabel: "Besar", isHigh: true };
  }
  if (bucket === "5") {
    return { bucket, shortTag: "M 5", levelLabel: "Kuat", isHigh: true };
  }
  if (bucket === "4") {
    return { bucket, shortTag: "M 4", levelLabel: "Sedang", isHigh: false };
  }
  if (bucket === "3") {
    return { bucket, shortTag: "M 3", levelLabel: "Ringan", isHigh: false };
  }
  return { bucket: "0", shortTag: "M <3", levelLabel: "Mikro", isHigh: false };
}

export function magColorHex(m: number, isDark = false): string {
  const b = magBucket(m);
  if (b === "7") return "#F43F5E";
  if (b === "6") return "#EF4444";
  if (b === "5") return "#EA580C";
  if (b === "4") return "#F59E0B";
  if (b === "3") return "#EAB308";
  return isDark ? "#94A3B8" : "#64748B";
}

const MMI_RE = /^([IVXL]+(?:\s*-\s*[IVXL]+)?)\s+(.+)$/i;

export function parseFelt(raw: string | null | undefined): Array<{ intensity: string; place: string }> {
  if (!raw || raw === "-") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(MMI_RE);
      return m
        ? { intensity: m[1].toUpperCase().replace(/\s*-\s*/g, "–"), place: m[2].trim() }
        : { intensity: "Dirasakan", place: part };
    });
}

export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}

const DAY = 86400000;
const WIB_OFFSET = 7 * 3600000;
const monthFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});

export interface WeeklyBucket<T extends { origin_time: string; magnitude: number; region?: string }> {
  start: number;
  label: string;
  shortLabel: string;
  count: number;
  max: T | null;
  partial: boolean;
}

function weekStart(t: number): number {
  const local = new Date(t + WIB_OFFSET);
  const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - dow);
}

export function weeklyBuckets<T extends { origin_time: string; magnitude: number; region?: string }>(
  events: T[]
): WeeklyBucket<T>[] {
  if (!events.length) return [];
  const times = events.map((e) => new Date(e.origin_time).getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const first = weekStart(minT);
  const last = weekStart(maxT);
  const weeks: WeeklyBucket<T>[] = [];
  for (let t = first; t <= last; t += 7 * DAY) {
    const partial = t - WIB_OFFSET < minT - DAY || t - WIB_OFFSET + 7 * DAY > maxT + DAY;
    weeks.push({
      start: t,
      label: `${monthFmt.format(t)} – ${monthFmt.format(t + 6 * DAY)}`,
      shortLabel: monthFmt.format(t),
      count: 0,
      max: null,
      partial,
    });
  }
  events.forEach((e, i) => {
    const w = weeks[Math.round((weekStart(times[i]) - first) / (7 * DAY))];
    if (!w) return;
    w.count += 1;
    if (!w.max || e.magnitude > w.max.magnitude) w.max = e;
  });
  return weeks;
}
