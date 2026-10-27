/** Formatting for Indonesian readers. Every time is shown in WIB (Asia/Jakarta). */

const TZ = "Asia/Jakarta";
const LOCALE = "id-ID";

const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ, day: "numeric", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const timeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const shortTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ, day: "numeric", month: "long", year: "numeric",
});
const longFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const utcDateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: "UTC", day: "numeric", month: "short", year: "numeric",
});
const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" });
const oneDecimal = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDecimals = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

const toDate = (value) => (value instanceof Date ? value : new Date(value));

export const fmtDateTime = (v) => `${dateTimeFmt.format(toDate(v))} WIB`;
export const fmtLong = (v) => `${longFmt.format(toDate(v))} WIB`;
export const fmtTime = (v) => `${timeFmt.format(toDate(v))} WIB`;
export const fmtClock = (v) => shortTimeFmt.format(toDate(v));
export const fmtDate = (v) => dateFmt.format(toDate(v));
export const fmtUtcDate = (v) => utcDateFmt.format(toDate(v));
export const fmtMag = (m) => (m == null ? "–" : oneDecimal.format(m));
export const fmtNumber = (n) => integer.format(n);
export const fmtDepth = (km) => (km == null ? "–" : `${integer.format(km)} km`);
export const fmtMeters = (m) => (m == null ? "–" : `${twoDecimals.format(m)} m`);

export function fmtCoords(lat, lon) {
  if (lat == null || lon == null) return "–";
  const ns = lat < 0 ? "LS" : "LU";
  const ew = lon < 0 ? "BB" : "BT";
  return `${twoDecimals.format(Math.abs(lat))}° ${ns}, ${twoDecimals.format(Math.abs(lon))}° ${ew}`;
}

const UNITS = [
  ["year", 31536000], ["month", 2592000], ["week", 604800],
  ["day", 86400], ["hour", 3600], ["minute", 60],
];

export function fmtRelative(value, now = Date.now()) {
  const seconds = (toDate(value).getTime() - now) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 45) return "baru saja";
  for (const [unit, size] of UNITS) {
    if (abs >= size || unit === "minute") return rtf.format(Math.round(seconds / size), unit);
  }
  return "";
}

/** Magnitude bucket used for colour: 0 (<3), 3, 4, 5, 6, 7 (≥7). */
export function magBucket(m) {
  if (m == null || m < 3) return 0;
  return Math.min(7, Math.floor(m));
}

export function magLabel(m) {
  return ["Mikro", "", "", "Minor", "Ringan", "Sedang", "Kuat", "Besar"][magBucket(m)] || "Mikro";
}

/** Resolved hex for a magnitude (Leaflet needs real colours, not CSS vars). */
export function magColor(m) {
  const name = `--m-${magBucket(m)}`;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Split BMKG felt text ("II - III Kab. Manggarai, III Sumur") into {intensity, place}. */
export function parseFelt(text) {
  if (!text) return [];
  return text
    .split(/[,;]/)
    .map((chunk) => chunk.trim().match(/^([IVX]+(?:\s*-\s*[IVX]+)?)\s+(.+)$/))
    .filter(Boolean)
    .map((m) => ({ intensity: m[1].replace(/\s+/g, ""), place: m[2].trim() }));
}
