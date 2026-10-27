import { NextRequest, NextResponse } from 'next/server';
import {
  computeSeismicStatistics,
  filterAndSortEvents,
  serializeEventsToCsv,
} from '@/lib/earthquakes/parser';
import { EarthquakeQuerySchema } from '@/lib/earthquakes/schemas';
import { getSeismicDataset } from '@/lib/earthquakes/service';

const rateLimitWindowMs = 60_000;
const maxRequestsPerWindow = 90;
const ipHits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ipKey: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const current = ipHits.get(ipKey);
  if (!current || now >= current.resetAt) {
    ipHits.set(ipKey, { count: 1, resetAt: now + rateLimitWindowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (current.count >= maxRequestsPerWindow) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export async function GET(req: NextRequest) {
  try {
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local-client';
    const rl = checkRateLimit(clientIp);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: 'Batas frekuensi permintaan terlampaui. Silakan coba beberapa saat lagi.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rl.retryAfterSec),
            'X-Content-Type-Options': 'nosniff',
          },
        }
      );
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('id');
    const format = searchParams.get('format');
    const forceRefresh = searchParams.get('refresh') === '1';

    const rawQuery: Record<string, string> = {};
    for (const key of [
      'search',
      'minMag',
      'maxMag',
      'minDepth',
      'maxDepth',
      'depthCategory',
      'sourceAgency',
      'sourceId',
      'tectonicZone',
      'sortBy',
      'sortOrder',
      'page',
      'limit',
    ]) {
      const val = searchParams.get(key);
      if (val !== null && val !== '') {
        rawQuery[key] = val;
      }
    }

    const parsedQuery = EarthquakeQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: 'Parameter filter atau paginasi tidak valid.',
          issues: parsedQuery.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        {
          status: 400,
          headers: { 'X-Content-Type-Options': 'nosniff' },
        }
      );
    }

    const dataset = await getSeismicDataset({ forceRefresh });

    if (eventId) {
      const found = dataset.events.find((e) => e.id === eventId);
      if (!found) {
        return NextResponse.json(
          { error: 'Peristiwa gempa dengan identitas tersebut tidak ditemukan.' },
          { status: 404, headers: { 'X-Content-Type-Options': 'nosniff' } }
        );
      }
      return NextResponse.json(
        {
          event: found,
          feedHealth: dataset.feedHealth,
          lastUpdatedIso: dataset.lastUpdatedIso,
          disclaimer: dataset.disclaimer,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
            'X-Content-Type-Options': 'nosniff',
          },
        }
      );
    }

    const filteredResult = filterAndSortEvents(dataset.events, parsedQuery.data);

    if (format === 'csv') {
      const csv = serializeEventsToCsv(filteredResult.items);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="seisma-earthquake-catalog.csv"',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const statistics = computeSeismicStatistics(filteredResult.items);

    return NextResponse.json(
      {
        latestBmkgEvent: dataset.latestBmkgEvent,
        items: filteredResult.items,
        pagination: {
          total: filteredResult.total,
          page: filteredResult.page,
          limit: filteredResult.limit,
          totalPages: filteredResult.totalPages,
        },
        statistics,
        feedHealth: dataset.feedHealth,
        lastUpdatedIso: dataset.lastUpdatedIso,
        cacheAgeSeconds: dataset.cacheAgeSeconds,
        sources: dataset.sources,
        disclaimer: dataset.disclaimer,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        error: 'Terjadi kesalahan saat memproses data seismik. Silakan muat ulang.',
      },
      {
        status: 500,
        headers: { 'X-Content-Type-Options': 'nosniff' },
      }
    );
  }
}
