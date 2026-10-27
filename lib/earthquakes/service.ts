import {
  VERIFIED_BMKG_FELT_FIXTURES,
  VERIFIED_BMKG_LATEST_FIXTURE,
  VERIFIED_BMKG_M5_FIXTURES,
  VERIFIED_USGS_GLOBAL_FIXTURES,
} from './fixtures';
import {
  combineAndOrderEvents,
  normalizeBmkgEvent,
  normalizeRoneEarthquakeEvent,
  normalizeRoneRealtimeEvent,
  normalizeUsgsFeature,
} from './parser';
import {
  RoneListEarthquakeEnvelopeSchema,
  RoneListRealtimeEnvelopeSchema,
  RoneSingleEarthquakeEnvelopeSchema,
  UsgsFeatureCollectionSchema,
} from './schemas';
import {
  DatasetEnvelope,
  SeismicEvent,
  SourceId,
  SourceStatusReport,
} from './types';

const RONE_BASE_URL = (
  process.env.RONE_GEMPA_API_BASE_URL || 'https://gempa.rone.dev'
).replace(/\/$/, '');

const BMKG_BASE_URL =
  process.env.BMKG_API_BASE_URL || 'https://data.bmkg.go.id/DataMKG/TEWS';

const USGS_BASE_URL =
  process.env.USGS_API_BASE_URL || 'https://earthquake.usgs.gov/fdsnws/event/1';

const FETCH_TIMEOUT_MS = Number(process.env.SEISMA_FETCH_TIMEOUT_MS || 7000);
const CACHE_TTL_MS = Number(process.env.SEISMA_CACHE_TTL_SECONDS || 45) * 1000;

interface CachedDataset {
  envelope: DatasetEnvelope;
  storedAtMs: number;
}

let memoryCache: CachedDataset | null = null;

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<{
  ok: boolean;
  data: unknown;
  latencyMs: number;
  errorMessage: string | null;
}> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SEISMA-Seismic-Observatory/2.0 (gempa.rone.dev Integration)',
      },
      next: { revalidate: 45 },
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return {
        ok: false,
        data: null,
        latencyMs,
        errorMessage: `HTTP ${res.status}`,
      };
    }
    const json = await res.json();
    return {
      ok: true,
      data: json,
      latencyMs,
      errorMessage: null,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Timeout koneksi sumber eksternal'
          : err.message
        : 'Kegagalan jaringan';
    return {
      ok: false,
      data: null,
      latencyMs,
      errorMessage: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function buildVerifiedArchiveEnvelope(
  reasonReports?: SourceStatusReport[]
): DatasetEnvelope {
  const nowIso = new Date().toISOString();
  const latestBmkg = normalizeBmkgEvent(
    VERIFIED_BMKG_LATEST_FIXTURE,
    'BMKG_LATEST',
    { isArchiveFallback: true }
  )!;

  const m5Events = VERIFIED_BMKG_M5_FIXTURES.map((r) =>
    normalizeBmkgEvent(r, 'BMKG_M5', { isArchiveFallback: true })
  ).filter((e): e is SeismicEvent => e !== null);

  const feltEvents = VERIFIED_BMKG_FELT_FIXTURES.map((r) =>
    normalizeBmkgEvent(r, 'BMKG_FELT', { isArchiveFallback: true })
  ).filter((e): e is SeismicEvent => e !== null);

  const usgsEvents = VERIFIED_USGS_GLOBAL_FIXTURES.map((f) =>
    normalizeUsgsFeature(f, { isArchiveFallback: true })
  ).filter((e): e is SeismicEvent => e !== null);

  const combined = combineAndOrderEvents([
    latestBmkg,
    ...m5Events,
    ...feltEvents,
    ...usgsEvents,
  ]);

  const defaultReports: SourceStatusReport[] = [
    {
      sourceId: 'RONE_LATEST',
      name: 'Gempa API — Gempa Dirasakan Terakhir (/api/v1/earthquakes/latest)',
      endpoint: `${RONE_BASE_URL}/api/v1/earthquakes/latest`,
      ok: false,
      recordCount: 1,
      fetchedAtIso: nowIso,
      latencyMs: 0,
      errorMessage: 'Menggunakan snapshot arsip terverifikasi (jaringan eksternal tidak terjangkau)',
    },
    {
      sourceId: 'RONE_REALTIME',
      name: 'Gempa API — Deteksi Real-Time BMKG (/api/v1/earthquakes/realtime)',
      endpoint: `${RONE_BASE_URL}/api/v1/earthquakes/realtime`,
      ok: false,
      recordCount: m5Events.length,
      fetchedAtIso: nowIso,
      latencyMs: 0,
      errorMessage: 'Menggunakan snapshot arsip terverifikasi',
    },
    {
      sourceId: 'RONE_FELT',
      name: 'Gempa API — Gempa Dirasakan (/api/v1/earthquakes/felt)',
      endpoint: `${RONE_BASE_URL}/api/v1/earthquakes/felt`,
      ok: false,
      recordCount: feltEvents.length,
      fetchedAtIso: nowIso,
      latencyMs: 0,
      errorMessage: 'Menggunakan snapshot arsip terverifikasi',
    },
    {
      sourceId: 'RONE_SIGNIFICANT',
      name: 'Gempa API — Gempa Signifikan M5+ (/api/v1/earthquakes/significant)',
      endpoint: `${RONE_BASE_URL}/api/v1/earthquakes/significant`,
      ok: false,
      recordCount: m5Events.length,
      fetchedAtIso: nowIso,
      latencyMs: 0,
      errorMessage: 'Menggunakan snapshot arsip terverifikasi',
    },
  ];

  return {
    latestBmkgEvent: latestBmkg,
    events: combined,
    feedHealth: 'archive_fallback',
    lastUpdatedIso: nowIso,
    cacheAgeSeconds: 0,
    sources: reasonReports || defaultReports,
    disclaimer:
      'Data gempa bumi dan tsunami: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika) melalui Gempa API (gempa.rone.dev) & USGS. Situs tidak resmi; untuk keadaan darurat ikuti arahan BMKG, BNPB, dan BPBD setempat.',
  };
}

export async function getSeismicDataset(options?: {
  forceRefresh?: boolean;
}): Promise<DatasetEnvelope> {
  const now = Date.now();
  if (
    !options?.forceRefresh &&
    memoryCache &&
    now - memoryCache.storedAtMs < CACHE_TTL_MS
  ) {
    return {
      ...memoryCache.envelope,
      feedHealth:
        memoryCache.envelope.feedHealth === 'live_official'
          ? 'cached_official'
          : memoryCache.envelope.feedHealth,
      cacheAgeSeconds: Math.floor((now - memoryCache.storedAtMs) / 1000),
    };
  }

  const endpoints: Array<{
    sourceId: SourceId;
    name: string;
    url: string;
  }> = [
    {
      sourceId: 'RONE_LATEST',
      name: 'Gempa API — Gempa Dirasakan Terakhir (/api/v1/earthquakes/latest)',
      url: `${RONE_BASE_URL}/api/v1/earthquakes/latest`,
    },
    {
      sourceId: 'RONE_FELT',
      name: 'Gempa API — Katalog Gempa Dirasakan (/api/v1/earthquakes/felt)',
      url: `${RONE_BASE_URL}/api/v1/earthquakes/felt`,
    },
    {
      sourceId: 'RONE_SIGNIFICANT',
      name: 'Gempa API — Katalog Gempa Signifikan M5+ (/api/v1/earthquakes/significant)',
      url: `${RONE_BASE_URL}/api/v1/earthquakes/significant`,
    },
    {
      sourceId: 'RONE_REALTIME',
      name: 'Gempa API — Deteksi Real-Time Seismograf (/api/v1/earthquakes/realtime)',
      url: `${RONE_BASE_URL}/api/v1/earthquakes/realtime`,
    },
    {
      sourceId: 'USGS_GLOBAL',
      name: 'USGS Global Seismic Catalog (M ≥ 4.8)',
      url: `${USGS_BASE_URL}/query?format=geojson&minmagnitude=4.8&limit=20&orderby=time`,
    },
  ];

  const [latestRes, feltRes, sigRes, realtimeRes, usgsRes] = await Promise.all(
    endpoints.map((e) => fetchJsonWithTimeout(e.url, FETCH_TIMEOUT_MS))
  );

  const nowIso = new Date().toISOString();
  const collectedEvents: SeismicEvent[] = [];
  let latestBmkgEvent: SeismicEvent | null = null;
  let liveSuccessCount = 0;

  // 1. Parse Gempa API Latest Felt Earthquake (/api/v1/earthquakes/latest)
  let latestCount = 0;
  if (latestRes.ok) {
    const parsed = RoneSingleEarthquakeEnvelopeSchema.safeParse(latestRes.data);
    if (parsed.success) {
      const normalized = normalizeRoneEarthquakeEvent(
        parsed.data.data,
        'RONE_LATEST',
        { baseUrl: RONE_BASE_URL }
      );
      if (normalized) {
        latestBmkgEvent = normalized;
        collectedEvents.push(normalized);
        latestCount = 1;
        liveSuccessCount++;
      }
    }
  }

  // 2. Parse Gempa API Felt Earthquakes (/api/v1/earthquakes/felt)
  let feltCount = 0;
  if (feltRes.ok) {
    const parsed = RoneListEarthquakeEnvelopeSchema.safeParse(feltRes.data);
    if (parsed.success) {
      for (const raw of parsed.data.data) {
        const normalized = normalizeRoneEarthquakeEvent(raw, 'RONE_FELT', {
          baseUrl: RONE_BASE_URL,
        });
        if (normalized) {
          collectedEvents.push(normalized);
          feltCount++;
        }
      }
      if (feltCount > 0) liveSuccessCount++;
    }
  }

  // 3. Parse Gempa API Significant M5+ Earthquakes (/api/v1/earthquakes/significant)
  let sigCount = 0;
  if (sigRes.ok) {
    const parsed = RoneListEarthquakeEnvelopeSchema.safeParse(sigRes.data);
    if (parsed.success) {
      for (const raw of parsed.data.data) {
        const normalized = normalizeRoneEarthquakeEvent(raw, 'RONE_SIGNIFICANT', {
          baseUrl: RONE_BASE_URL,
        });
        if (normalized) {
          collectedEvents.push(normalized);
          sigCount++;
        }
      }
      if (sigCount > 0) liveSuccessCount++;
    }
  }

  // 4. Parse Gempa API Real-time Detections (/api/v1/earthquakes/realtime) - take top 50 recent detections
  let realtimeCount = 0;
  if (realtimeRes.ok) {
    const parsed = RoneListRealtimeEnvelopeSchema.safeParse(realtimeRes.data);
    if (parsed.success) {
      for (const raw of parsed.data.data.slice(0, 50)) {
        const normalized = normalizeRoneRealtimeEvent(raw, {
          baseUrl: RONE_BASE_URL,
        });
        if (normalized) {
          collectedEvents.push(normalized);
          realtimeCount++;
        }
      }
      if (realtimeCount > 0) liveSuccessCount++;
    }
  }

  // 5. Parse USGS Global Catalog
  let usgsCount = 0;
  if (usgsRes.ok) {
    const parsed = UsgsFeatureCollectionSchema.safeParse(usgsRes.data);
    if (parsed.success) {
      for (const rawFeature of parsed.data.features) {
        const normalized = normalizeUsgsFeature(rawFeature);
        if (normalized) {
          collectedEvents.push(normalized);
          usgsCount++;
        }
      }
      if (usgsCount > 0) liveSuccessCount++;
    }
  }

  const reports: SourceStatusReport[] = [
    {
      sourceId: 'RONE_LATEST',
      name: endpoints[0].name,
      endpoint: endpoints[0].url,
      ok: latestCount > 0,
      recordCount: latestCount,
      fetchedAtIso: nowIso,
      latencyMs: latestRes.latencyMs,
      errorMessage: latestCount > 0 ? null : latestRes.errorMessage || 'Skema tidak sesuai',
    },
    {
      sourceId: 'RONE_FELT',
      name: endpoints[1].name,
      endpoint: endpoints[1].url,
      ok: feltCount > 0,
      recordCount: feltCount,
      fetchedAtIso: nowIso,
      latencyMs: feltRes.latencyMs,
      errorMessage: feltCount > 0 ? null : feltRes.errorMessage || 'Skema tidak sesuai',
    },
    {
      sourceId: 'RONE_SIGNIFICANT',
      name: endpoints[2].name,
      endpoint: endpoints[2].url,
      ok: sigCount > 0,
      recordCount: sigCount,
      fetchedAtIso: nowIso,
      latencyMs: sigRes.latencyMs,
      errorMessage: sigCount > 0 ? null : sigRes.errorMessage || 'Skema tidak sesuai',
    },
    {
      sourceId: 'RONE_REALTIME',
      name: endpoints[3].name,
      endpoint: endpoints[3].url,
      ok: realtimeCount > 0,
      recordCount: realtimeCount,
      fetchedAtIso: nowIso,
      latencyMs: realtimeRes.latencyMs,
      errorMessage: realtimeCount > 0 ? null : realtimeRes.errorMessage || 'Skema tidak sesuai',
    },
    {
      sourceId: 'USGS_GLOBAL',
      name: endpoints[4].name,
      endpoint: endpoints[4].url,
      ok: usgsCount > 0,
      recordCount: usgsCount,
      fetchedAtIso: nowIso,
      latencyMs: usgsRes.latencyMs,
      errorMessage: usgsCount > 0 ? null : usgsRes.errorMessage || 'Skema tidak sesuai',
    },
  ];

  if (collectedEvents.length > 0) {
    if (latestCount === 0 && feltCount === 0 && sigCount === 0 && realtimeCount === 0) {
      const archiveBmkgLatest = normalizeBmkgEvent(
        VERIFIED_BMKG_LATEST_FIXTURE,
        'BMKG_LATEST',
        { isArchiveFallback: true }
      )!;
      latestBmkgEvent = archiveBmkgLatest;
      collectedEvents.push(
        archiveBmkgLatest,
        ...VERIFIED_BMKG_M5_FIXTURES.map((r) =>
          normalizeBmkgEvent(r, 'BMKG_M5', { isArchiveFallback: true })!
        ),
        ...VERIFIED_BMKG_FELT_FIXTURES.map((r) =>
          normalizeBmkgEvent(r, 'BMKG_FELT', { isArchiveFallback: true })!
        )
      );
    }

    const ordered = combineAndOrderEvents(collectedEvents);
    const primaryBmkg =
      latestBmkgEvent ||
      ordered.find((e) => e.sourceId === 'RONE_FELT') ||
      ordered.find((e) => e.sourceAgency === 'BMKG') ||
      ordered[0];

    const envelope: DatasetEnvelope = {
      latestBmkgEvent: primaryBmkg,
      events: ordered,
      feedHealth: liveSuccessCount >= 2 ? 'live_official' : 'cached_official',
      lastUpdatedIso: nowIso,
      cacheAgeSeconds: 0,
      sources: reports,
      disclaimer:
        'Data gempa bumi dan tsunami: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika) melalui Gempa API (gempa.rone.dev) & USGS. Situs tidak resmi; untuk keadaan darurat ikuti arahan BMKG, BNPB, dan BPBD setempat.',
    };

    memoryCache = {
      envelope,
      storedAtMs: now,
    };
    return envelope;
  }

  if (memoryCache) {
    return {
      ...memoryCache.envelope,
      feedHealth: 'stale_cache',
      cacheAgeSeconds: Math.floor((now - memoryCache.storedAtMs) / 1000),
      sources: reports,
    };
  }

  return buildVerifiedArchiveEnvelope(reports);
}
