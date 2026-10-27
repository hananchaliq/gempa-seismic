'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/navigation/Header';
import { Footer } from '@/components/layout/Footer';
import { SeismicAnalyticsCharts } from '@/components/charts/SeismicAnalyticsCharts';
import { DatasetEnvelope } from '@/lib/earthquakes/types';
import { computeSeismicStatistics, formatCommaNumber } from '@/lib/earthquakes/parser';

export default function InsightsPage() {
  const [dataset, setDataset] = useState<DatasetEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<'ALL' | 'BMKG'>('ALL');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/earthquakes?limit=200', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json?.dataset) setDataset(json.dataset);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredEvents = useMemo(() => {
    const list = dataset?.events || [];
    if (scope === 'BMKG') return list.filter((e) => e.sourceAgency === 'BMKG');
    return list;
  }, [dataset, scope]);

  const statistics = useMemo(() => computeSeismicStatistics(filteredEvents), [filteredEvents]);

  return (
    <div className="min-h-screen bg-[var(--clay)] text-[var(--ink)] flex flex-col">
      <Header
        feedHealth={dataset?.feedHealth}
        lastUpdatedIso={dataset?.lastUpdatedIso}
        isRefreshing={loading}
      />

      <main className="rone-container flex-1 space-y-8 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="section-head__eyebrow">
              Analitik &amp; Distribusi Katalog · BMKG (gempa.rone.dev) + USGS
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
              Analisis Statistik Aktivitas Seismik
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--ink-2)]">
              Evaluasi distribusi magnitudo, zona kedalaman hiposenter (Wadati–Benioff), dan frekuensi wilayah berdasarkan katalog pengamatan aktual.
            </p>
          </div>

          <div className="segmented" role="tablist" aria-label="Cakupan sampel analitik">
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'ALL'}
              aria-pressed={scope === 'ALL'}
              onClick={() => setScope('ALL')}
            >
              Semua Sampel ({dataset?.events.length ?? 0})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'BMKG'}
              aria-pressed={scope === 'BMKG'}
              onClick={() => setScope('BMKG')}
            >
              Khusus Indonesia (BMKG)
            </button>
          </div>
        </div>

        {/* 4 Summary Tiles */}
        <section className="stats" aria-label="Ringkasan sampel statistik">
          <div className="stat">
            <span className="stat__label">Total Sampel Dianalisis</span>
            <span className="stat__value">{statistics.totalEvents}</span>
            <span className="stat__sub">Kejadian terverifikasi</span>
          </div>
          <div className="stat">
            <span className="stat__label">Magnitudo Tertinggi</span>
            <span className="stat__value">
              M{' '}
              {statistics.maxMagnitudeEvent
                ? formatCommaNumber(statistics.maxMagnitudeEvent.magnitude, 1)
                : '—'}
            </span>
            <span className="stat__sub truncate">
              {statistics.maxMagnitudeEvent?.region || 'Tidak ada data'}
            </span>
          </div>
          <div className="stat">
            <span className="stat__label">Rata-rata Kedalaman</span>
            <span className="stat__value">
              {formatCommaNumber(statistics.meanDepthKm, 1)} km
            </span>
            <span className="stat__sub">Kedalaman hiposenter</span>
          </div>
          <div className="stat">
            <span className="stat__label">Gempa Signifikan (M ≥ 5,0)</span>
            <span className="stat__value">{statistics.significantCountM5Plus}</span>
            <span className="stat__sub">{statistics.feltEventsCount} dirasakan (MMI)</span>
          </div>
        </section>

        <SeismicAnalyticsCharts statistics={statistics} />
      </main>

      <Footer />
    </div>
  );
}
