'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Compass,
  Download,
  ExternalLink,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { Header } from '@/components/navigation/Header';
import { Footer } from '@/components/layout/Footer';
import { EventDetailPanel } from '@/components/earthquake/EventDetailPanel';
import { SeismicLiveMap } from '@/components/map/SeismicLiveMap';
import { SeismicAnalyticsCharts } from '@/components/charts/SeismicAnalyticsCharts';
import { SeismicScrollNarrative } from '@/components/storytelling/SeismicScrollNarrative';
import type { GlobeCameraPreset } from '@/components/globe/SeismicGlobe3D';
import {
  computeSeismicStatistics,
  filterAndSortEvents,
  formatCommaNumber,
  formatFullIndonesianDateTimeWib,
  formatRelativeTimeId,
  getRoneMagnitudeDataAttr,
} from '@/lib/earthquakes/parser';
import {
  getMagnitudeSpec,
  getTsunamiStatusPresentation,
} from '@/lib/earthquakes/severity';
import {
  DatasetEnvelope,
  DepthCategory,
  SeismicEvent,
} from '@/lib/earthquakes/types';

const SeismicGlobe3D = dynamic(
  () => import('@/components/globe/SeismicGlobe3D').then((m) => m.SeismicGlobe3D),
  {
    ssr: false,
    loading: () => (
      <div className="card w-full h-[540px] flex flex-col items-center justify-center p-6 text-center">
        <div className="font-mono text-xs font-bold text-[var(--accent-ink)]">
          MENGINISIALISASI OBSERVATORIUM BOLA BUMI 3D...
        </div>
        <p className="mt-1 text-xs text-[var(--ink-3)]">
          Menyiapkan geometri tektonik Sunda–Banda dan koordinat hiposenter.
        </p>
      </div>
    ),
  }
);

interface OverviewDashboardClientProps {
  initialDataset: DatasetEnvelope;
}

export function OverviewDashboardClient({
  initialDataset,
}: OverviewDashboardClientProps) {
  const [dataset, setDataset] = useState<DatasetEnvelope>(initialDataset);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<SeismicEvent>(
    initialDataset.latestBmkgEvent
  );
  const [globePreset, setGlobePreset] = useState<GlobeCameraPreset>('indonesia');

  // Filter states for synchronized Map, Globe & Catalog
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [minMagnitude, setMinMagnitude] = useState<number>(0);
  const [depthFilter, setDepthFilter] = useState<DepthCategory | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'BMKG' | 'USGS'>('all');

  const liveMapSectionRef = useRef<HTMLElement | null>(null);
  const globeSectionRef = useRef<HTMLElement | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch('/api/earthquakes?refresh=1&limit=100');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data && Array.isArray(data.items) && data.latestBmkgEvent) {
        setDataset({
          latestBmkgEvent: data.latestBmkgEvent,
          events: data.items,
          feedHealth: data.feedHealth,
          lastUpdatedIso: data.lastUpdatedIso,
          cacheAgeSeconds: data.cacheAgeSeconds ?? 0,
          sources: data.sources ?? dataset.sources,
          disclaimer: data.disclaimer ?? dataset.disclaimer,
        });
      }
    } catch {
      setRefreshError(
        'Pembaruan jaringan gagal; mempertahankan data terverifikasi terakhir.'
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [dataset.disclaimer, dataset.sources]);

  const filteredData = useMemo(() => {
    return filterAndSortEvents(dataset.events, {
      search: searchQuery,
      minMag: minMagnitude,
      depthCategory: depthFilter,
      sourceAgency: sourceFilter,
      sortBy: 'time',
      sortOrder: 'desc',
      limit: 100,
    });
  }, [dataset.events, searchQuery, minMagnitude, depthFilter, sourceFilter]);

  const statistics = useMemo(() => {
    return computeSeismicStatistics(filteredData.items);
  }, [filteredData.items]);

  const latest = dataset.latestBmkgEvent;
  const referenceNowMs = useMemo(() => {
    const parsed = Date.parse(dataset.lastUpdatedIso);
    return Number.isFinite(parsed) ? parsed : latest.originTimeEpochMs;
  }, [dataset.lastUpdatedIso, latest.originTimeEpochMs]);
  const latestMagSpec = getMagnitudeSpec(latest.magnitudeClass);
  const latestTsunami = getTsunamiStatusPresentation(latest.tsunamiStatus);
  const latestDataM = getRoneMagnitudeDataAttr(latest.magnitude);
  const dialDash = Math.min(75, Math.max(6, (latest.magnitude / 9) * 75)).toFixed(1);

  const handleSelectEventAndFocus = useCallback((ev: SeismicEvent) => {
    setSelectedEvent(ev);
    setGlobePreset('selected_event');
  }, []);

  const handleJumpToLiveMap = useCallback(() => {
    liveMapSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--clay)] text-[var(--ink)]">
      <Header
        feedHealth={dataset.feedHealth}
        lastUpdatedIso={dataset.lastUpdatedIso}
        onRefreshRequest={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <main id="main" className="page flex-1 rone-container space-y-8">
        {refreshError && (
          <div role="status" className="well text-xs font-mono text-[var(--accent-ink)]">
            {refreshError}
          </div>
        )}

        {/* PAGE HEAD (Exact gempa.rone.dev Typography & Hierarchy) */}
        <div className="page-head">
          <h1>Gempa bumi terkini di Indonesia</h1>
          <p>
            Gempa terakhir yang dirasakan dan deteksi real-time dari jaringan seismik BMKG
            (terintegrasi melalui <a href="https://gempa.rone.dev/docs" target="_blank" rel="noopener noreferrer">gempa.rone.dev API</a>), diperbarui setiap menit.
          </p>
        </div>

        {/* BENTO GRID (Matches https://gempa.rone.dev/ Hero + Map + Ringkasan + Deteksi Terbaru + Jelajahi) */}
        <div className="bento">
          {/* 1. LEFT HERO ARTICLE: Neumorphic Dial + Latest Felt Earthquake */}
          <article
            aria-label={latest.region}
            className="card hero bento__hero"
            data-m={latestDataM}
          >
            <div className="hero__top">
              {/* Circular Neumorphic Magnitude Dial (.dial) */}
              <div className="dial" data-m={latestDataM} aria-hidden="true">
                <svg viewBox="0 0 36 36">
                  <circle
                    className="dial__track"
                    cx="18"
                    cy="18"
                    r="15.9155"
                  />
                  <circle
                    className="dial__arc"
                    cx="18"
                    cy="18"
                    r="15.9155"
                    style={{ strokeDasharray: `${dialDash} 100` }}
                  />
                </svg>
                <div className="dial__value">
                  <span className="dial__num">
                    {formatCommaNumber(latest.magnitude, 1)}
                  </span>
                  <span className="dial__label">{latestMagSpec.labelId}</span>
                </div>
              </div>

              <div className="hero__intro">
                <div className="hero__kicker">Gempa dirasakan terakhir</div>
                <h2 className="hero__title">{latest.region}</h2>
                <div className="hero__time">
                  {formatFullIndonesianDateTimeWib(latest.originTimeEpochMs)} ·{' '}
                  {formatRelativeTimeId(latest.originTimeEpochMs, referenceNowMs)}
                </div>
              </div>
            </div>

            {/* 2x2 Inset Wells Facts Grid (.facts) */}
            <dl className="facts">
              <div>
                <dt>Kedalaman</dt>
                <dd className="num">{latest.depthKm.toFixed(0)} km</dd>
              </div>
              <div>
                <dt>Koordinat</dt>
                <dd className="num">{latest.coordinatesText}</dd>
              </div>
              <div>
                <dt>Potensi tsunami</dt>
                <dd>{latestTsunami.shortStatusLabel}</dd>
              </div>
              <div>
                <dt>Dirasakan</dt>
                <dd>{latest.feltReport || 'Dirasakan masyarakat lokal'}</dd>
              </div>
            </dl>

            {/* Primary & Secondary Actions */}
            <div className="hero__actions">
              <Link
                href={`/earthquakes/${encodeURIComponent(latest.id)}`}
                className="btn btn--accent"
              >
                Detail &amp; peta guncangan
              </Link>
              <Link href="/catalog" className="btn">
                Gempa dirasakan lainnya
              </Link>
            </div>
          </article>

          {/* 2. RIGHT EPICENTER MAP REGION */}
          <section
            ref={liveMapSectionRef}
            aria-label="Peta episentrum"
            className="card map-card bento__map"
          >
            <SeismicLiveMap
              events={filteredData.items}
              selectedEvent={selectedEvent}
              onSelectEvent={handleSelectEventAndFocus}
            />
          </section>

          {/* 3. RINGKASAN (4 Neumorphic Stat Tiles) */}
          <section aria-labelledby="ringkasan-heading" className="bento__stats space-y-3">
            <h2 id="ringkasan-heading" className="text-base font-bold text-[var(--ink)] sr-only">
              Ringkasan
            </h2>
            <div className="stats">
              <div className="stat">
                <div className="stat__label">Total kejadian aktif</div>
                <div className="stat__value">{statistics.totalEvents}</div>
                <div className="stat__note">
                  {statistics.bmkgCount} deteksi BMKG · {statistics.usgsCount} global
                </div>
              </div>

              <div className="stat">
                <div className="stat__label">Terkuat tercatat</div>
                <div className="stat__value">
                  {statistics.maxMagnitudeEvent
                    ? formatCommaNumber(statistics.maxMagnitudeEvent.magnitude, 1)
                    : '0,0'}
                </div>
                <div className="stat__note">
                  {statistics.maxMagnitudeEvent?.region || '-'}
                </div>
              </div>

              <div className="stat">
                <div className="stat__label">M5+ signifikan</div>
                <div className="stat__value">{statistics.significantCountM5Plus}</div>
                <div className="stat__note">
                  {statistics.feltEventsCount} kejadian dirasakan (MMI)
                </div>
              </div>

              <div className="stat">
                <div className="stat__label">Status tsunami</div>
                <div className="stat__value text-[var(--ok)]">
                  {latest.tsunamiStatus === 'potential_warning' ? 'Siaga' : 'Aman'}
                </div>
                <div className="stat__note">{latestTsunami.shortStatusLabel}</div>
              </div>
            </div>
          </section>

          {/* 4. DETEKSI TERBARU (List with Mini Circular Magnitude Dials .mag) */}
          <section
            aria-label="Deteksi terbaru"
            className="card bento__recent"
          >
            <div className="card__head">
              <div>
                <h2>Deteksi terbaru</h2>
                <span className="hint">
                  Klik kejadian untuk memeriksa parameter &amp; memfokuskan peta/globe 3D
                </span>
              </div>
              <Link href="/catalog">Semua deteksi ({dataset.events.length})</Link>
            </div>

            <ul className="event-list">
              {filteredData.items.slice(0, 8).map((ev) => {
                const isSelected = selectedEvent.id === ev.id;
                const dataM = getRoneMagnitudeDataAttr(ev.magnitude);
                return (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectEventAndFocus(ev)}
                      aria-current={isSelected ? 'true' : undefined}
                      className="event"
                    >
                      <div
                        className="mag"
                        data-m={dataM}
                        style={{ '--v': ev.magnitude } as React.CSSProperties}
                      >
                        <span className="mag__num">
                          {formatCommaNumber(ev.magnitude, 1)}
                        </span>
                      </div>

                      <div className="event__body">
                        <div className="event__title">{ev.region}</div>
                        <div className="event__meta">
                          <span>{ev.formattedTimeWib}</span>
                          <span className="num">{ev.depthKm.toFixed(0)} km</span>
                        </div>
                      </div>

                      <div className="event__side">
                        {ev.magnitude >= 5.0 && (
                          <span className="pill pill--signal">M5+</span>
                        )}
                        <span>{formatRelativeTimeId(ev.originTimeEpochMs, referenceNowMs)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 5. JELAJAHI & PANEL INSPEKSI KEJADIAN TERPILIH */}
          <div className="bento__links space-y-5">
            <nav aria-label="Jelajahi" className="card space-y-3">
              <div className="card__head !mb-2">
                <h2>Jelajahi</h2>
              </div>
              <div className="links">
                <Link href="/catalog" className="tile">
                  <div className="tile__icon">
                    <Activity className="w-[18px] h-[18px]" />
                  </div>
                  <div>
                    <strong>Katalog &amp; Deteksi Real-Time</strong>
                    <span>Pencarian wilayah, filter M5+, &amp; ekspor CSV</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--ink-3)]" />
                </Link>

                <Link href="/earthquakes" className="tile">
                  <div className="tile__icon">
                    <Compass className="w-[18px] h-[18px]" />
                  </div>
                  <div>
                    <strong>Peta Seismisitas Interaktif</strong>
                    <span>Sesar aktif, hiposenter, &amp; mode tabel</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--ink-3)]" />
                </Link>

                <Link href="/sources" className="tile">
                  <div className="tile__icon">
                    <ShieldAlert className="w-[18px] h-[18px]" />
                  </div>
                  <div>
                    <strong>Sumber Data &amp; Dokumentasi API</strong>
                    <span>Integrasi gempa.rone.dev, BMKG, &amp; USGS</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--ink-3)]" />
                </Link>
              </div>
            </nav>

            <EventDetailPanel event={selectedEvent} compact />
          </div>
        </div>

        {/* FILTER TOOLBAR FOR SYNCHRONIZED 3D GLOBE & ANALYTICS */}
        <section aria-label="Filter Sinkronisasi Katalog dan Observatorium" className="card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="field flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-[var(--ink-3)]" />
              <label htmlFor="overview-search-input" className="sr-only">
                Cari lokasi atau wilayah gempa
              </label>
              <input
                id="overview-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari wilayah (mis. Nagekeo, Sumbawa, Flores, Banda)..."
              />
            </div>

            <div className="segmented" role="group" aria-label="Filter Magnitudo">
              {[
                { val: 0, label: 'Semua' },
                { val: 4.0, label: 'M ≥ 4,0' },
                { val: 5.0, label: 'M ≥ 5,0' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setMinMagnitude(opt.val)}
                  aria-pressed={minMagnitude === opt.val}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="segmented" role="group" aria-label="Filter Kedalaman">
              {(
                [
                  { id: 'all', label: 'Semua Kedalaman' },
                  { id: 'shallow', label: 'Dangkal (<70km)' },
                  { id: 'intermediate', label: 'Menengah' },
                  { id: 'deep', label: 'Dalam (>300km)' },
                ] as const
              ).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDepthFilter(d.id)}
                  aria-pressed={depthFilter === d.id}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <a
              href={`/api/earthquakes?format=csv&minMag=${minMagnitude}&depthCategory=${depthFilter}&sourceAgency=${sourceFilter}`}
              download="seisma-earthquake-catalog.csv"
              className="btn btn--sm"
            >
              <Download className="w-3.5 h-3.5" /> Unduh CSV ({filteredData.total})
            </a>
          </div>
        </section>

        {/* IMMERSIVE 3D EARTH OBSERVATORY */}
        <section
          ref={globeSectionRef}
          aria-label="Observatorium Globe Bumi 3D Interaktif"
          className="space-y-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-mono font-bold text-[var(--accent-ink)]">
                OBSERVATORIUM GEOSPASIAL 3D · SINKRONISASI GEMPA API &amp; BMKG
              </div>
              <h2 className="mt-1 text-xl sm:text-2xl font-bold text-[var(--ink)]">
                Eksplorasi Bola Bumi 3D, Sabuk Subduksi, &amp; Vektor Hiposenter
              </h2>
            </div>
            <p className="text-xs text-[var(--ink-3)]">
              Putar bola bumi atau gunakan tombol fokus di bawah untuk meninjau kedalaman hiposenter secara proporsional.
            </p>
          </div>

          <SeismicGlobe3D
            events={filteredData.items}
            selectedEvent={selectedEvent}
            onSelectEvent={handleSelectEventAndFocus}
            cameraPreset={globePreset}
            onSwitchTo2DMap={handleJumpToLiveMap}
          />
        </section>

        {/* SCROLL-DRIVEN GEODYNAMIC STORYTELLING */}
        <SeismicScrollNarrative
          latestEvent={selectedEvent}
          deepestEvent={statistics.deepestEvent}
          statistics={statistics}
          activePreset={globePreset}
          onPresetChange={setGlobePreset}
          onJumpToLiveMap={handleJumpToLiveMap}
        />

        {/* STATISTICAL INSIGHTS & WEEKLY/HISTORICAL ACTIVITY */}
        <section aria-label="Analisis Statistik dan Aktivitas Katalog" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-mono font-bold text-[var(--accent-ink)]">
                AKTIVITAS &amp; DISTRIBUSI KATALOG
              </div>
              <h2 className="mt-1 text-xl sm:text-2xl font-bold text-[var(--ink)]">
                Analisis Statistik, Distribusi Kedalaman, &amp; Aktivitas Regional
              </h2>
            </div>
            <Link href="/insights" className="text-sm font-bold text-[var(--accent-ink)]">
              Buka Analisis Lengkap →
            </Link>
          </div>

          <SeismicAnalyticsCharts statistics={statistics} />
        </section>
      </main>

      <Footer />
    </div>
  );
}
