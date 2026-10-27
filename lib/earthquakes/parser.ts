import {
  BmkgGempaItemRaw,
  BmkgGempaItemSchema,
  RoneEarthquakeItemRaw,
  RoneEarthquakeItemSchema,
  RoneRealtimeItemRaw,
  RoneRealtimeItemSchema,
  UsgsFeatureRaw,
  UsgsFeatureSchema,
} from './schemas';
import {
  DailyActivityPoint,
  DepthBucket,
  DepthCategory,
  EarthquakeFilterParams,
  MagnitudeBucket,
  MagnitudeClass,
  RegionalActivitySummary,
  SeismicEvent,
  SeismicStatistics,
  SourceId,
  TsunamiAdvisoryStatus,
} from './types';

export function classifyDepthCategory(depthKm: number): DepthCategory {
  if (depthKm < 70) return 'shallow';
  if (depthKm <= 300) return 'intermediate';
  return 'deep';
}

export function classifyMagnitude(magnitude: number): MagnitudeClass {
  if (magnitude < 4.0) return 'minor';
  if (magnitude < 5.0) return 'light';
  if (magnitude < 6.0) return 'moderate';
  if (magnitude < 7.0) return 'strong';
  if (magnitude < 8.0) return 'major';
  return 'great';
}

/**
 * Maps magnitude to the exact data-m attribute bucket used by gempa.rone.dev:
 * '0' (<3), '3' (3.0-3.9), '4' (4.0-4.9), '5' (5.0-5.9), '6' (6.0-6.9), '7' (7.0+)
 */
export function getRoneMagnitudeDataAttr(magnitude: number): '0' | '3' | '4' | '5' | '6' | '7' {
  if (magnitude < 3.0) return '0';
  if (magnitude < 4.0) return '3';
  if (magnitude < 5.0) return '4';
  if (magnitude < 6.0) return '5';
  if (magnitude < 7.0) return '6';
  return '7';
}

export function formatCommaNumber(val: number, decimals: number = 1): string {
  return val.toFixed(decimals).replace('.', ',');
}

export function inferTectonicZone(lat: number, lng: number, wilayahText: string): string {
  const upper = wilayahText.toUpperCase();
  if (
    upper.includes('ACEH') ||
    upper.includes('SUMUT') ||
    upper.includes('SUMBAR') ||
    upper.includes('BENGKULU') ||
    upper.includes('LAMPUNG') ||
    upper.includes('NIAS') ||
    upper.includes('MENTAWAI') ||
    upper.includes('TAPANULI') ||
    upper.includes('SUMATRA') ||
    upper.includes('LEBONG')
  ) {
    return 'Zona Subduksi Sunda — Sumatra';
  }
  if (
    upper.includes('BANTEN') ||
    upper.includes('JABAR') ||
    upper.includes('JATENG') ||
    upper.includes('JATIM') ||
    upper.includes('DIY') ||
    upper.includes('CIANJUR') ||
    upper.includes('TASIKMALAYA') ||
    upper.includes('GUNUNGKIDUL') ||
    upper.includes('BANTUL') ||
    upper.includes('GARUT') ||
    upper.includes('SUKABUMI') ||
    upper.includes('JAVA')
  ) {
    return 'Busur Sunda — Jawa & Sesar Aktif Darat';
  }
  if (
    upper.includes('BALI') ||
    upper.includes('NTB') ||
    upper.includes('NTT') ||
    upper.includes('LOMBOK') ||
    upper.includes('SUMBA') ||
    upper.includes('FLORES') ||
    upper.includes('KARANGASEM') ||
    upper.includes('MATARAM') ||
    upper.includes('KUPANG') ||
    upper.includes('MBAY') ||
    upper.includes('NAGEKEO')
  ) {
    return 'Busur Banda Dalam — Bali & Nusa Tenggara';
  }
  if (
    upper.includes('SULUT') ||
    upper.includes('SULTENG') ||
    upper.includes('SULSEL') ||
    upper.includes('SULTRA') ||
    upper.includes('GORONTALO') ||
    upper.includes('PALU') ||
    upper.includes('POSO') ||
    upper.includes('MINAHASA') ||
    upper.includes('SULAWESI')
  ) {
    return 'Sistem Sesar Palu-Koro & Sulawesi';
  }
  if (
    upper.includes('MALUKU') ||
    upper.includes('MALUT') ||
    upper.includes('TERNATE') ||
    upper.includes('AMBON') ||
    upper.includes('TANIMBAR') ||
    upper.includes('HALMAHERA') ||
    upper.includes('BANDA') ||
    upper.includes('SERAM') ||
    upper.includes('TALAUD')
  ) {
    return 'Laut Maluku & Busur Banda Timur';
  }
  if (
    upper.includes('PAPUA') ||
    upper.includes('JAYAPURA') ||
    upper.includes('MANOKWARI') ||
    upper.includes('SORONG') ||
    upper.includes('BIAK') ||
    upper.includes('NABIRE')
  ) {
    return 'Sabuk Orogenik Papua & Sesar Sorong-Yapen';
  }
  if (lng >= 90 && lng <= 145 && lat >= -15 && lat <= 10) {
    return 'Kepulauan Indonesia (Regional)';
  }
  return 'Sabuk Seismik Global (Circum-Pacific / Alpide)';
}

export function parseBmkgCoordinates(
  coordinatesStr: string,
  lintangStr: string,
  bujurStr: string
): { latitude: number; longitude: number } | null {
  const parts = coordinatesStr.split(',').map((s) => s.trim());
  if (parts.length === 2) {
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return { latitude: lat, longitude: lng };
    }
  }

  // Fallback to Lintang / Bujur parsing
  const latMatch = lintangStr.match(/([0-9]+(?:\.[0-9]+)?)\s*(LU|LS)/i);
  const lngMatch = bujurStr.match(/([0-9]+(?:\.[0-9]+)?)\s*(BT|BB)/i);
  if (!latMatch || !lngMatch) return null;

  let lat = Number(latMatch[1]);
  let lng = Number(lngMatch[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  if (latMatch[2].toUpperCase() === 'LS') lat = -lat;
  if (lngMatch[2].toUpperCase() === 'BB') lng = -lng;

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

export function parseBmkgDepthKm(kedalamanStr: string): number | null {
  const cleaned = kedalamanStr.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const val = Number(cleaned);
  if (!Number.isFinite(val) || val < 0 || val > 1000) return null;
  return val;
}

export function parseBmkgMagnitude(magInput: string | number): number | null {
  const val = typeof magInput === 'number' ? magInput : Number(String(magInput).trim());
  if (!Number.isFinite(val) || val <= 0 || val > 10.5) return null;
  return Number(val.toFixed(1));
}

export function formatIndonesianWib(epochMs: number): string {
  const wibDate = new Date(epochMs + 7 * 3600 * 1000);
  const year = wibDate.getUTCFullYear();
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];
  const month = monthNames[wibDate.getUTCMonth()];
  const day = String(wibDate.getUTCDate()).padStart(2, '0');
  const hours = String(wibDate.getUTCHours()).padStart(2, '0');
  const minutes = String(wibDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(wibDate.getUTCSeconds()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}.${minutes}.${seconds} WIB`;
}

export function formatFullIndonesianDateTimeWib(input: number | string): string {
  const epochMs = typeof input === 'number' ? input : Date.parse(input);
  if (!Number.isFinite(epochMs)) return String(input);
  const wibDate = new Date(epochMs + 7 * 3600 * 1000);
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  const dayName = dayNames[wibDate.getUTCDay()];
  const day = wibDate.getUTCDate();
  const month = monthNames[wibDate.getUTCMonth()];
  const year = wibDate.getUTCFullYear();
  const hours = String(wibDate.getUTCHours()).padStart(2, '0');
  const minutes = String(wibDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(wibDate.getUTCSeconds()).padStart(2, '0');
  return `${dayName}, ${day} ${month} ${year} pukul ${hours}.${minutes}.${seconds} WIB`;
}

export function formatRelativeTimeId(
  input: number | string,
  nowEpochMs: number = Date.now()
): string {
  const epochMs = typeof input === 'number' ? input : Date.parse(input);
  if (!Number.isFinite(epochMs)) return 'baru saja';
  const diffSec = Math.max(0, Math.floor((nowEpochMs - epochMs) / 1000));
  if (diffSec < 60) return 'baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit yang lalu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} jam yang lalu`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} hari yang lalu`;
}

export function formatUtcTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

export function parseTsunamiAdvisory(
  potensi?: string | null,
  tsunamiPotentialBool?: boolean | null
): {
  status: TsunamiAdvisoryStatus;
  officialText: string;
} {
  if (tsunamiPotentialBool === true) {
    return {
      status: 'potential_warning',
      officialText: potensi?.trim() || 'Berpotensi tsunami — ikuti arahan resmi BMKG InaTEWS',
    };
  }
  if (!potensi || !potensi.trim()) {
    if (tsunamiPotentialBool === false) {
      return {
        status: 'no_potential',
        officialText: 'Tidak berpotensi tsunami',
      };
    }
    return {
      status: 'official_info_unavailable',
      officialText: 'Informasi status tsunami resmi tidak tercantum pada parameter ini',
    };
  }
  const normalized = potensi.trim();
  const lower = normalized.toLowerCase();

  if (lower.includes('tidak berpotensi')) {
    return {
      status: 'no_potential',
      officialText: normalized,
    };
  }
  if (lower.includes('potensi tsunami') || lower.includes('peringatan dini tsunami')) {
    return {
      status: 'potential_warning',
      officialText: normalized,
    };
  }
  if (lower.includes('dirasakan')) {
    return {
      status: 'felt_local',
      officialText: normalized,
    };
  }
  return {
    status: tsunamiPotentialBool === false ? 'no_potential' : 'official_info_unavailable',
    officialText: normalized,
  };
}

/**
 * Normalizes an Earthquake object from https://gempa.rone.dev/api/v1/earthquakes/{latest|felt|significant}
 */
export function normalizeRoneEarthquakeEvent(
  rawInput: unknown,
  sourceId: Extract<SourceId, 'RONE_LATEST' | 'RONE_FELT' | 'RONE_SIGNIFICANT'>,
  options?: { baseUrl?: string; isArchiveFallback?: boolean }
): SeismicEvent | null {
  const parsed = RoneEarthquakeItemSchema.safeParse(rawInput);
  if (!parsed.success) return null;
  const item: RoneEarthquakeItemRaw = parsed.data;

  if (
    !Number.isFinite(item.latitude) ||
    !Number.isFinite(item.longitude) ||
    item.latitude < -90 ||
    item.latitude > 90 ||
    item.longitude < -180 ||
    item.longitude > 180
  ) {
    return null;
  }

  if (!Number.isFinite(item.depth_km) || item.depth_km < 0 || item.depth_km > 1000) {
    return null;
  }

  const magnitude = parseBmkgMagnitude(item.magnitude);
  if (magnitude === null) return null;

  const epochMs = Date.parse(item.origin_time);
  if (!Number.isFinite(epochMs) || epochMs <= 0) return null;

  const baseUrl = (options?.baseUrl || 'https://gempa.rone.dev').replace(/\/$/, '');
  const tsunami = parseTsunamiAdvisory(item.potential, item.tsunami_potential);
  const tectonicZone = inferTectonicZone(item.latitude, item.longitude, item.region);

  const latLabel = `${formatCommaNumber(Math.abs(item.latitude), 2)}° ${
    item.latitude < 0 ? 'LS' : 'LU'
  }`;
  const lngLabel = `${formatCommaNumber(Math.abs(item.longitude), 2)}° ${
    item.longitude < 0 ? 'BB' : 'BT'
  }`;

  const shakemapUrl = item.media?.shakemap
    ? item.media.shakemap.startsWith('http')
      ? item.media.shakemap
      : `${baseUrl}${item.media.shakemap}`
    : null;

  const safeId = item.event_id.replace(/[^a-zA-Z0-9_-]/g, '');

  return {
    id: `rone-${safeId}`,
    sourceId,
    sourceAgency: 'BMKG',
    sourceUrl: `${baseUrl}/docs`,
    title: `M ${formatCommaNumber(magnitude, 1)} · ${item.region}`,
    region: item.region,
    subRegion: tectonicZone,
    magnitude,
    magnitudeType: 'M',
    magnitudeClass: classifyMagnitude(magnitude),
    depthKm: Number(item.depth_km.toFixed(1)),
    depthCategory: classifyDepthCategory(item.depth_km),
    latitude: Number(item.latitude.toFixed(4)),
    longitude: Number(item.longitude.toFixed(4)),
    coordinatesText: `${latLabel}, ${lngLabel}`,
    originTimeIso: new Date(epochMs).toISOString(),
    originTimeEpochMs: epochMs,
    formattedTimeWib: formatIndonesianWib(epochMs),
    formattedTimeUtc: formatUtcTimestamp(epochMs),
    tsunamiStatus: tsunami.status,
    tsunamiOfficialText: tsunami.officialText,
    feltReport: item.felt && item.felt !== '-' ? item.felt : null,
    instructionText: item.instruction || null,
    shakemapUrl,
    mediaUrls: item.media
      ? {
          shakemap: shakemapUrl,
          location_map: item.media.location_map
            ? `${baseUrl}${item.media.location_map}`
            : null,
          station_intensity: item.media.station_intensity
            ? `${baseUrl}${item.media.station_intensity}`
            : null,
          impact: item.media.impact ? `${baseUrl}${item.media.impact}` : null,
          intensity: item.media.intensity ? `${baseUrl}${item.media.intensity}` : null,
        }
      : null,
    verificationStatus: 'verified',
    tectonicZone,
    isArchiveFallback: options?.isArchiveFallback ?? false,
  };
}

/**
 * Normalizes a RealtimeEvent object from https://gempa.rone.dev/api/v1/earthquakes/realtime
 */
export function normalizeRoneRealtimeEvent(
  rawInput: unknown,
  options?: { baseUrl?: string; isArchiveFallback?: boolean }
): SeismicEvent | null {
  const parsed = RoneRealtimeItemSchema.safeParse(rawInput);
  if (!parsed.success) return null;
  const item: RoneRealtimeItemRaw = parsed.data;

  if (
    !Number.isFinite(item.latitude) ||
    !Number.isFinite(item.longitude) ||
    item.latitude < -90 ||
    item.latitude > 90 ||
    item.longitude < -180 ||
    item.longitude > 180
  ) {
    return null;
  }

  if (!Number.isFinite(item.depth_km) || item.depth_km < 0 || item.depth_km > 1000) {
    return null;
  }

  const magnitude = parseBmkgMagnitude(item.magnitude);
  if (magnitude === null) return null;

  const epochMs = Date.parse(item.origin_time);
  if (!Number.isFinite(epochMs) || epochMs <= 0) return null;

  const baseUrl = (options?.baseUrl || 'https://gempa.rone.dev').replace(/\/$/, '');
  const tectonicZone = inferTectonicZone(item.latitude, item.longitude, item.region);

  const latLabel = `${formatCommaNumber(Math.abs(item.latitude), 2)}° ${
    item.latitude < 0 ? 'LS' : 'LU'
  }`;
  const lngLabel = `${formatCommaNumber(Math.abs(item.longitude), 2)}° ${
    item.longitude < 0 ? 'BB' : 'BT'
  }`;

  const safeId = item.event_id.replace(/[^a-zA-Z0-9_-]/g, '');

  return {
    id: `rone-rt-${safeId}`,
    sourceId: 'RONE_REALTIME',
    sourceAgency: 'BMKG',
    sourceUrl: `${baseUrl}/docs`,
    title: `M ${formatCommaNumber(magnitude, 1)} · ${item.region}`,
    region: item.region,
    subRegion: tectonicZone,
    magnitude,
    magnitudeType: 'M',
    magnitudeClass: classifyMagnitude(magnitude),
    depthKm: Number(item.depth_km.toFixed(1)),
    depthCategory: classifyDepthCategory(item.depth_km),
    latitude: Number(item.latitude.toFixed(4)),
    longitude: Number(item.longitude.toFixed(4)),
    coordinatesText: `${latLabel}, ${lngLabel}`,
    originTimeIso: new Date(epochMs).toISOString(),
    originTimeEpochMs: epochMs,
    formattedTimeWib: formatIndonesianWib(epochMs),
    formattedTimeUtc: formatUtcTimestamp(epochMs),
    tsunamiStatus: 'no_potential',
    tsunamiOfficialText: 'Deteksi real-time jaringan seismograf BMKG (InaTEWS)',
    feltReport: null,
    instructionText: null,
    shakemapUrl: null,
    mediaUrls: null,
    verificationStatus: item.status === 'confirmed' ? 'verified' : 'preliminary',
    tectonicZone,
    isArchiveFallback: options?.isArchiveFallback ?? false,
  };
}

export function normalizeBmkgEvent(
  rawInput: unknown,
  sourceId: Extract<SourceId, 'BMKG_LATEST' | 'BMKG_M5' | 'BMKG_FELT'>,
  options?: { isArchiveFallback?: boolean }
): SeismicEvent | null {
  const parsed = BmkgGempaItemSchema.safeParse(rawInput);
  if (!parsed.success) return null;
  const item: BmkgGempaItemRaw = parsed.data;

  const coords = parseBmkgCoordinates(item.Coordinates, item.Lintang, item.Bujur);
  if (!coords) return null;

  const depthKm = parseBmkgDepthKm(item.Kedalaman);
  if (depthKm === null) return null;

  const magnitude = parseBmkgMagnitude(item.Magnitude);
  if (magnitude === null) return null;

  const epochMs = Date.parse(item.DateTime);
  if (!Number.isFinite(epochMs) || epochMs <= 0) return null;

  const originTimeIso = new Date(epochMs).toISOString();
  const tsunami = parseTsunamiAdvisory(item.Potensi);
  const tectonicZone = inferTectonicZone(coords.latitude, coords.longitude, item.Wilayah);

  const coordSlug = `${coords.latitude.toFixed(2)}_${coords.longitude.toFixed(2)}`.replace(
    /[^a-zA-Z0-9_-]/g,
    ''
  );
  const id = `bmkg-${sourceId.toLowerCase().replace('bmkg_', '')}-${Math.floor(
    epochMs / 1000
  )}-${coordSlug}`;

  const latLabel = `${formatCommaNumber(Math.abs(coords.latitude), 2)}° ${
    coords.latitude < 0 ? 'LS' : 'LU'
  }`;
  const lngLabel = `${formatCommaNumber(Math.abs(coords.longitude), 2)}° ${
    coords.longitude < 0 ? 'BB' : 'BT'
  }`;

  return {
    id,
    sourceId,
    sourceAgency: 'BMKG',
    sourceUrl: 'https://data.bmkg.go.id/gempabumi/',
    title: `M ${formatCommaNumber(magnitude, 1)} · ${item.Wilayah}`,
    region: item.Wilayah,
    subRegion: tectonicZone,
    magnitude,
    magnitudeType: 'M',
    magnitudeClass: classifyMagnitude(magnitude),
    depthKm,
    depthCategory: classifyDepthCategory(depthKm),
    latitude: coords.latitude,
    longitude: coords.longitude,
    coordinatesText: `${latLabel}, ${lngLabel}`,
    originTimeIso,
    originTimeEpochMs: epochMs,
    formattedTimeWib: formatIndonesianWib(epochMs),
    formattedTimeUtc: formatUtcTimestamp(epochMs),
    tsunamiStatus: tsunami.status,
    tsunamiOfficialText: tsunami.officialText,
    feltReport: item.Dirasakan && item.Dirasakan !== '-' ? item.Dirasakan : null,
    shakemapUrl: item.Shakemap
      ? `https://data.bmkg.go.id/DataMKG/TEWS/${encodeURIComponent(item.Shakemap)}`
      : null,
    verificationStatus: 'verified',
    tectonicZone,
    isArchiveFallback: options?.isArchiveFallback ?? false,
  };
}

export function normalizeUsgsFeature(
  rawFeature: unknown,
  options?: { isArchiveFallback?: boolean }
): SeismicEvent | null {
  const parsed = UsgsFeatureSchema.safeParse(rawFeature);
  if (!parsed.success) return null;
  const feature: UsgsFeatureRaw = parsed.data;

  const [lng, lat, rawDepth] = feature.geometry.coordinates;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(rawDepth) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  const depthKm = Math.max(0, Math.min(1000, Number(rawDepth.toFixed(1))));
  const magRaw = feature.properties.mag;
  if (magRaw === null || !Number.isFinite(magRaw) || magRaw <= 0 || magRaw > 10.5) {
    return null;
  }
  const magnitude = Number(magRaw.toFixed(1));

  const epochMs = feature.properties.time;
  if (!Number.isFinite(epochMs) || epochMs <= 0) return null;

  const place = feature.properties.place?.trim() || 'Wilayah Samudra / Global';
  const tectonicZone = inferTectonicZone(lat, lng, place);
  const latLabel = `${formatCommaNumber(Math.abs(lat), 2)}° ${lat < 0 ? 'LS' : 'LU'}`;
  const lngLabel = `${formatCommaNumber(Math.abs(lng), 2)}° ${lng < 0 ? 'BB' : 'BT'}`;

  return {
    id: `usgs-${feature.id.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    sourceId: 'USGS_GLOBAL',
    sourceAgency: 'USGS',
    sourceUrl:
      feature.properties.url || 'https://earthquake.usgs.gov/fdsnws/event/1/',
    title: `M ${formatCommaNumber(magnitude, 1)} · ${place}`,
    region: place,
    subRegion: tectonicZone,
    magnitude,
    magnitudeType: (feature.properties.magType || 'Mw').toUpperCase(),
    magnitudeClass: classifyMagnitude(magnitude),
    depthKm,
    depthCategory: classifyDepthCategory(depthKm),
    latitude: Number(lat.toFixed(4)),
    longitude: Number(lng.toFixed(4)),
    coordinatesText: `${latLabel}, ${lngLabel}`,
    originTimeIso: new Date(epochMs).toISOString(),
    originTimeEpochMs: epochMs,
    formattedTimeWib: formatIndonesianWib(epochMs),
    formattedTimeUtc: formatUtcTimestamp(epochMs),
    tsunamiStatus:
      feature.properties.tsunami === 1
        ? 'potential_warning'
        : 'official_info_unavailable',
    tsunamiOfficialText:
      feature.properties.tsunami === 1
        ? 'USGS menandai adanya informasi tsunami regional; periksa otoritas resmi setempat (BMKG untuk wilayah Indonesia)'
        : 'Katalog global USGS — untuk wilayah Indonesia, rujuk status resmi BMKG InaTEWS',
    feltReport:
      typeof feature.properties.mmi === 'number'
        ? `Estimasi intensitas instrumental MMI ~${feature.properties.mmi.toFixed(1)}`
        : null,
    shakemapUrl: null,
    verificationStatus:
      feature.properties.status === 'reviewed' ? 'verified' : 'preliminary',
    tectonicZone,
    isArchiveFallback: options?.isArchiveFallback ?? false,
  };
}

/**
 * Deduplicates ONLY identical BMKG records that appear across multiple BMKG/Rone feeds
 * with the exact same timestamp and coordinates.
 * Never merges BMKG and USGS records into a single synthetic record.
 */
export function combineAndOrderEvents(events: SeismicEvent[]): SeismicEvent[] {
  const seenBmkgKeys = new Set<string>();
  const result: SeismicEvent[] = [];

  for (const ev of events) {
    if (ev.sourceAgency === 'BMKG') {
      const key = `${Math.floor(ev.originTimeEpochMs / 1000)}_${ev.latitude.toFixed(2)}_${ev.longitude.toFixed(2)}_${ev.magnitude.toFixed(1)}`;
      if (seenBmkgKeys.has(key)) {
        continue;
      }
      seenBmkgKeys.add(key);
    }
    result.push(ev);
  }

  return result.sort((a, b) => b.originTimeEpochMs - a.originTimeEpochMs);
}

export function filterAndSortEvents(
  events: SeismicEvent[],
  params: EarthquakeFilterParams
): {
  items: SeismicEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} {
  const search = (params.search || '').trim().toLowerCase();
  const minMag = params.minMag ?? 0;
  const maxMag = params.maxMag ?? 10;
  const minDepth = params.minDepth ?? 0;
  const maxDepth = params.maxDepth ?? 1000;
  const depthCategory = params.depthCategory ?? 'all';
  const sourceAgency = params.sourceAgency ?? 'all';
  const sourceId = params.sourceId ?? 'all';
  const tectonicZone = params.tectonicZone ?? 'all';
  const sortBy = params.sortBy ?? 'time';
  const sortOrder = params.sortOrder ?? 'desc';
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.max(1, Math.min(200, params.limit ?? 50));

  const filtered = events.filter((ev) => {
    if (ev.magnitude < minMag || ev.magnitude > maxMag) return false;
    if (ev.depthKm < minDepth || ev.depthKm > maxDepth) return false;
    if (depthCategory !== 'all' && ev.depthCategory !== depthCategory) return false;
    if (sourceAgency !== 'all' && ev.sourceAgency !== sourceAgency) return false;
    if (sourceId !== 'all' && ev.sourceId !== sourceId) return false;
    if (tectonicZone !== 'all' && ev.tectonicZone !== tectonicZone) return false;

    if (search) {
      const haystack = `${ev.region} ${ev.tectonicZone} ${ev.id} ${ev.coordinatesText} ${
        ev.feltReport || ''
      }`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'magnitude') {
      cmp = a.magnitude - b.magnitude;
    } else if (sortBy === 'depth') {
      cmp = a.depthKm - b.depthKm;
    } else {
      cmp = a.originTimeEpochMs - b.originTimeEpochMs;
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const items = filtered.slice(start, start + limit);

  return {
    items,
    total,
    page: safePage,
    limit,
    totalPages,
  };
}

export function computeSeismicStatistics(events: SeismicEvent[]): SeismicStatistics {
  if (events.length === 0) {
    return {
      totalEvents: 0,
      bmkgCount: 0,
      usgsCount: 0,
      maxMagnitudeEvent: null,
      deepestEvent: null,
      shallowestEvent: null,
      meanMagnitude: 0,
      medianMagnitude: 0,
      meanDepthKm: 0,
      medianDepthKm: 0,
      significantCountM5Plus: 0,
      feltEventsCount: 0,
      periodStartIso: null,
      periodEndIso: null,
      magnitudeDistribution: [],
      depthDistribution: [],
      dailySeries: [],
      regionalBreakdown: [],
      scatterPoints: [],
    };
  }

  let bmkgCount = 0;
  let usgsCount = 0;
  let maxMagnitudeEvent = events[0];
  let deepestEvent = events[0];
  let shallowestEvent = events[0];
  let sumMag = 0;
  let sumDepth = 0;
  let significantCountM5Plus = 0;
  let feltEventsCount = 0;
  let minEpoch = events[0].originTimeEpochMs;
  let maxEpoch = events[0].originTimeEpochMs;

  const mags: number[] = [];
  const depths: number[] = [];

  for (const ev of events) {
    if (ev.sourceAgency === 'BMKG') bmkgCount++;
    else usgsCount++;

    if (ev.magnitude > maxMagnitudeEvent.magnitude) maxMagnitudeEvent = ev;
    if (ev.depthKm > deepestEvent.depthKm) deepestEvent = ev;
    if (ev.depthKm < shallowestEvent.depthKm) shallowestEvent = ev;

    sumMag += ev.magnitude;
    sumDepth += ev.depthKm;
    mags.push(ev.magnitude);
    depths.push(ev.depthKm);

    if (ev.magnitude >= 5.0) significantCountM5Plus++;
    if (ev.feltReport) feltEventsCount++;

    if (ev.originTimeEpochMs < minEpoch) minEpoch = ev.originTimeEpochMs;
    if (ev.originTimeEpochMs > maxEpoch) maxEpoch = ev.originTimeEpochMs;
  }

  mags.sort((a, b) => a - b);
  depths.sort((a, b) => a - b);

  const calcMedian = (arr: number[]): number => {
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };

  const magRanges: Array<{ range: string; label: string; min: number; max: number }> = [
    { range: '< 4.0', label: 'Minor (<4.0)', min: 0, max: 3.99 },
    { range: '4.0–4.9', label: 'Ringan (4.0–4.9)', min: 4.0, max: 4.99 },
    { range: '5.0–5.4', label: 'Sedang Bawah (5.0–5.4)', min: 5.0, max: 5.49 },
    { range: '5.5–5.9', label: 'Sedang Atas (5.5–5.9)', min: 5.5, max: 5.99 },
    { range: '6.0–6.9', label: 'Kuat (6.0–6.9)', min: 6.0, max: 6.99 },
    { range: '≥ 7.0', label: 'Mayor (≥7.0)', min: 7.0, max: 11.0 },
  ];

  const magnitudeDistribution: MagnitudeBucket[] = magRanges.map((b) => ({
    ...b,
    count: events.filter((e) => e.magnitude >= b.min && e.magnitude <= b.max).length,
  }));

  const shallowCount = events.filter((e) => e.depthCategory === 'shallow').length;
  const intermediateCount = events.filter((e) => e.depthCategory === 'intermediate').length;
  const deepCount = events.filter((e) => e.depthCategory === 'deep').length;
  const total = events.length;

  const depthDistribution: DepthBucket[] = [
    {
      category: 'shallow',
      label: 'Dangkal (< 70 km)',
      rangeLabel: '0–69 km',
      count: shallowCount,
      percentage: Number(((shallowCount / total) * 100).toFixed(1)),
    },
    {
      category: 'intermediate',
      label: 'Menengah (70–300 km)',
      rangeLabel: '70–300 km',
      count: intermediateCount,
      percentage: Number(((intermediateCount / total) * 100).toFixed(1)),
    },
    {
      category: 'deep',
      label: 'Dalam (> 300 km)',
      rangeLabel: '> 300 km',
      count: deepCount,
      percentage: Number(((deepCount / total) * 100).toFixed(1)),
    },
  ];

  const byDayMap = new Map<
    string,
    { count: number; maxMag: number; depthSum: number }
  >();
  for (const ev of events) {
    const dayKey = ev.originTimeIso.slice(0, 10);
    const existing = byDayMap.get(dayKey);
    if (!existing) {
      byDayMap.set(dayKey, {
        count: 1,
        maxMag: ev.magnitude,
        depthSum: ev.depthKm,
      });
    } else {
      existing.count += 1;
      existing.maxMag = Math.max(existing.maxMag, ev.magnitude);
      existing.depthSum += ev.depthKm;
    }
  }

  const dailySeries: DailyActivityPoint[] = Array.from(byDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({
      date,
      label: date.slice(5),
      count: stats.count,
      maxMagnitude: Number(stats.maxMag.toFixed(1)),
      avgDepthKm: Number((stats.depthSum / stats.count).toFixed(1)),
    }));

  const byZoneMap = new Map<
    string,
    {
      count: number;
      maxMag: number;
      depthSum: number;
      shallow: number;
      intermediate: number;
      deep: number;
    }
  >();

  for (const ev of events) {
    const current = byZoneMap.get(ev.tectonicZone) || {
      count: 0,
      maxMag: 0,
      depthSum: 0,
      shallow: 0,
      intermediate: 0,
      deep: 0,
    };
    current.count += 1;
    current.maxMag = Math.max(current.maxMag, ev.magnitude);
    current.depthSum += ev.depthKm;
    if (ev.depthCategory === 'shallow') current.shallow += 1;
    else if (ev.depthCategory === 'intermediate') current.intermediate += 1;
    else current.deep += 1;
    byZoneMap.set(ev.tectonicZone, current);
  }

  const regionalBreakdown: RegionalActivitySummary[] = Array.from(byZoneMap.entries())
    .map(([zone, s]) => ({
      zone,
      count: s.count,
      maxMagnitude: Number(s.maxMag.toFixed(1)),
      avgDepthKm: Number((s.depthSum / s.count).toFixed(1)),
      shallowCount: s.shallow,
      intermediateCount: s.intermediate,
      deepCount: s.deep,
    }))
    .sort((a, b) => b.count - a.count);

  const scatterPoints = events.map((ev) => ({
    id: ev.id,
    region: ev.region,
    depthKm: ev.depthKm,
    magnitude: ev.magnitude,
    depthCategory: ev.depthCategory,
    sourceAgency: ev.sourceAgency,
    originTimeIso: ev.originTimeIso,
  }));

  return {
    totalEvents: total,
    bmkgCount,
    usgsCount,
    maxMagnitudeEvent,
    deepestEvent,
    shallowestEvent,
    meanMagnitude: Number((sumMag / total).toFixed(2)),
    medianMagnitude: Number(calcMedian(mags).toFixed(2)),
    meanDepthKm: Number((sumDepth / total).toFixed(1)),
    medianDepthKm: Number(calcMedian(depths).toFixed(1)),
    significantCountM5Plus,
    feltEventsCount,
    periodStartIso: new Date(minEpoch).toISOString(),
    periodEndIso: new Date(maxEpoch).toISOString(),
    magnitudeDistribution,
    depthDistribution,
    dailySeries,
    regionalBreakdown,
    scatterPoints,
  };
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const sanitized = /^[=+\-@\t\r]/.test(raw) && !/^-?[0-9]+(\.[0-9]+)?$/.test(raw)
    ? `'${raw}`
    : raw;
  if (/[",\n\r]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

export function serializeEventsToCsv(events: SeismicEvent[]): string {
  const headers = [
    'Event_ID',
    'Source_Agency',
    'Source_Feed',
    'Origin_Time_ISO',
    'Origin_Time_WIB',
    'Magnitude',
    'Magnitude_Type',
    'Depth_km',
    'Depth_Category',
    'Latitude',
    'Longitude',
    'Region',
    'Tectonic_Zone',
    'Tsunami_Official_Note',
    'Felt_MMI_Report',
    'Verification_Status',
  ];

  const rows = events.map((ev) =>
    [
      ev.id,
      ev.sourceAgency,
      ev.sourceId,
      ev.originTimeIso,
      ev.formattedTimeWib,
      ev.magnitude.toFixed(1),
      ev.magnitudeType,
      ev.depthKm.toFixed(1),
      ev.depthCategory,
      ev.latitude.toFixed(4),
      ev.longitude.toFixed(4),
      ev.region,
      ev.tectonicZone,
      ev.tsunamiOfficialText,
      ev.feltReport || '',
      ev.verificationStatus,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
