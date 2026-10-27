'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Download,
  RefreshCw,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { Header } from '@/components/navigation/Header';
import { Footer } from '@/components/layout/Footer';
import {
  DatasetEnvelope,
  SeismicEvent,
  DepthCategory,
} from '@/lib/earthquakes/types';
import {
  filterAndSortEvents,
  serializeEventsToCsv,
  formatRelativeTimeId,
  formatCommaNumber,
  getRoneMagnitudeDataAttr,
} from '@/lib/earthquakes/parser';
import {
  getDepthSpec,
  getTsunamiStatusPresentation,
} from '@/lib/earthquakes/severity';
import { SeismicLiveMap } from '@/components/map/SeismicLiveMap';
import { EventDetailPanel } from '@/components/earthquake/EventDetailPanel';

export interface CatalogExplorerClientProps {
  initialDataset: DatasetEnvelope;
  defaultMode?: 'catalog' | 'map';
}

const PAGE_SIZE = 15;

export function CatalogExplorerClient({
  initialDataset,
  defaultMode = 'catalog',
}: CatalogExplorerClientProps) {
  const [dataset, setDataset] = useState<DatasetEnvelope>(initialDataset);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [minMag, setMinMag] = useState<number>(0);
  const [sourceAgency, setSourceAgency] = useState<'all' | 'BMKG' | 'USGS'>('all');
  const [depthFilter, setDepthFilter] = useState<'all' | DepthCategory>('all');
  const [sortBy, setSortBy] = useState<'time' | 'magnitude' | 'depth'>('time');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [timezoneMode, setTimezoneMode] = useState<'WIB' | 'UTC'>('WIB');

  const [selectedEventId, setSelectedEventId] = useState<string>(
    initialDataset.latestBmkgEvent.id
  );

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/earthquakes?limit=200', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json?.dataset) {
        setDataset(json.dataset);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat katalog gempa');
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredResult = useMemo(() => {
    return filterAndSortEvents(dataset.events, {
      search: searchQuery,
      minMag,
      depthCategory: depthFilter,
      sourceAgency,
      sortBy,
      sortOrder,
      page: currentPage,
      limit: PAGE_SIZE,
    });
  }, [dataset.events, searchQuery, minMag, depthFilter, sourceAgency, sortBy, sortOrder, currentPage]);

  const allFilteredEvents = useMemo(() => {
    return filterAndSortEvents(dataset.events, {
      search: searchQuery,
      minMag,
      depthCategory: depthFilter,
      sourceAgency,
      sortBy,
      sortOrder,
      page: 1,
      limit: 500,
    }).items;
  }, [dataset.events, searchQuery, minMag, depthFilter, sourceAgency, sortBy, sortOrder]);

  const selectedEvent: SeismicEvent = useMemo(() => {
    return (
      allFilteredEvents.find((e) => e.id === selectedEventId) ||
      allFilteredEvents[0] ||
      dataset.latestBmkgEvent
    );
  }, [allFilteredEvents, selectedEventId, dataset.latestBmkgEvent]);

  const handleExportCsv = () => {
    if (!allFilteredEvents.length) return;
    const csvContent = serializeEventsToCsv(allFilteredEvents);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gempa-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[var(--clay)] text-[var(--ink)] flex flex-col">
      <Header
        feedHealth={dataset.feedHealth}
        lastUpdatedIso={dataset.lastUpdatedIso}
        onRefreshRequest={fetchCatalog}
        isRefreshing={loading}
      />

      <main className="rone-container flex-1 space-y-8 py-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="section-head__eyebrow">
              {defaultMode === 'map'
                ? 'Pemantauan Peta Interaktif · gempa.rone.dev + USGS'
                : 'Katalog & Umpan Realtime · gempa.rone.dev API v2.0.0'}
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
              {defaultMode === 'map'
                ? 'Peta Seismik Interaktif Indonesia & Global'
                : 'Katalog & Umpan Realtime Gempa Bumi'}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--ink-2)]">
              Telusuri katalog gempa dirasakan, signifikan (M 5,0+), dan deteksi real-time dari BMKG (<code className="font-mono">gempa.rone.dev</code>) serta jaringan global USGS.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="segmented">
              <button
                type="button"
                aria-pressed={timezoneMode === 'WIB'}
                onClick={() => setTimezoneMode((z) => (z === 'WIB' ? 'UTC' : 'WIB'))}
                className="font-mono"
              >
                Zona Waktu: {timezoneMode}
              </button>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={allFilteredEvents.length === 0}
              className="btn disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5 text-[var(--accent)]" />
              Unduh CSV ({allFilteredEvents.length})
            </button>
            <button
              type="button"
              onClick={fetchCatalog}
              className="btn btn--accent"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Segarkan
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Cari Lokasi / Wilayah / Skala MMI
            </label>
            <div className="field mt-1.5">
              <Search className="h-4 w-4 text-[var(--muted)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Contoh: Nagekeo, Sumbawa, Maluku, III MMI..."
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Sumber Otoritas
            </label>
            <select
              value={sourceAgency}
              onChange={(e) => {
                setSourceAgency(e.target.value as 'all' | 'BMKG' | 'USGS');
                setCurrentPage(1);
              }}
              aria-label="Filter Sumber Otoritas"
              className="field mt-1.5 w-full text-xs font-semibold"
            >
              <option value="all">BMKG + USGS Global</option>
              <option value="BMKG">Khusus BMKG (Indonesia)</option>
              <option value="USGS">USGS (Konteks Global)</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Magnitudo Minimum
            </label>
            <select
              value={minMag}
              onChange={(e) => {
                setMinMag(Number(e.target.value));
                setCurrentPage(1);
              }}
              aria-label="Filter Magnitudo Minimum"
              className="field mt-1.5 w-full font-mono text-xs font-semibold"
            >
              <option value={0}>Semua Magnitudo</option>
              <option value={4.0}>≥ M 4,0</option>
              <option value={5.0}>≥ M 5,0 (Signifikan)</option>
              <option value={6.0}>≥ M 6,0 (Kuat)</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Kategori Kedalaman
            </label>
            <select
              value={depthFilter}
              onChange={(e) => {
                setDepthFilter(e.target.value as 'all' | DepthCategory);
                setCurrentPage(1);
              }}
              aria-label="Filter Kategori Kedalaman"
              className="field mt-1.5 w-full text-xs font-semibold"
            >
              <option value="all">Semua Kedalaman</option>
              <option value="shallow">Dangkal (&lt; 70 km)</option>
              <option value="intermediate">Menengah (70–300 km)</option>
              <option value="deep">Dalam (&gt; 300 km)</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Urutkan Berdasarkan
            </label>
            <select
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const [by, ord] = e.target.value.split('_') as [
                  'time' | 'magnitude' | 'depth',
                  'desc' | 'asc'
                ];
                setSortBy(by);
                setSortOrder(ord);
                setCurrentPage(1);
              }}
              aria-label="Urutkan Katalog"
              className="field mt-1.5 w-full text-xs font-semibold"
            >
              <option value="time_desc">Terbaru → Terlama</option>
              <option value="time_asc">Terlama → Terbaru</option>
              <option value="magnitude_desc">Magnitudo Tertinggi</option>
              <option value="magnitude_asc">Magnitudo Terendah</option>
              <option value="depth_desc">Kedalaman Terdalam</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="card flex items-center gap-3 p-4 text-xs text-[var(--danger)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Gagal memuat katalog: {error}</span>
          </div>
        )}

        {/* Map + Detail Split */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SeismicLiveMap
              events={allFilteredEvents}
              selectedEvent={selectedEvent}
              onSelectEvent={(ev) => setSelectedEventId(ev.id)}
            />
          </div>
          <div className="lg:col-span-5">
            <EventDetailPanel event={selectedEvent} />
          </div>
        </div>

        {/* Paginated Catalog Table */}
        <div className="card overflow-hidden p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] pb-4">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-base font-bold text-[var(--ink)]">
                Daftar Kejadian Gempa Bumi ({filteredResult.total} kejadian)
              </h2>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-[var(--muted)]">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Halaman {filteredResult.page} dari {filteredResult.totalPages}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--rule)] text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  <th className="py-3 px-3">Magnitudo</th>
                  <th className="py-3 px-3">Waktu ({timezoneMode})</th>
                  <th className="py-3 px-3">Wilayah / Lokasi</th>
                  <th className="py-3 px-3">Kedalaman</th>
                  <th className="py-3 px-3">Koordinat</th>
                  <th className="py-3 px-3">Status / MMI</th>
                  <th className="py-3 px-3">Sumber</th>
                  <th className="py-3 px-3 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {filteredResult.items.map((ev) => {
                  const isSelected = selectedEvent?.id === ev.id;
                  const depthCat = getDepthSpec(ev.depthCategory);
                  const tsu = getTsunamiStatusPresentation(ev.tsunamiStatus);

                  return (
                    <tr
                      key={ev.id}
                      onClick={() => setSelectedEventId(ev.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[var(--well)]' : 'hover:bg-[var(--clay-hi)]/60'
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div
                          className="mag"
                          data-m={getRoneMagnitudeDataAttr(ev.magnitude)}
                        >
                          <span className="mag__num">{formatCommaNumber(ev.magnitude, 1)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-[var(--ink-2)]">
                        <div>
                          {timezoneMode === 'WIB' ? ev.formattedTimeWib : ev.formattedTimeUtc}
                        </div>
                        <div className="text-[11px] text-[var(--muted)]">
                          {formatRelativeTimeId(
                            ev.originTimeIso,
                            Date.parse(dataset.lastUpdatedIso) || ev.originTimeEpochMs
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[var(--ink)]">{ev.region}</div>
                        {ev.feltReport && (
                          <div className="mt-0.5 text-[11px] text-[var(--accent)]">
                            Dirasakan: {ev.feltReport}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <div className="font-bold text-[var(--ink)]">
                          {formatCommaNumber(ev.depthKm, 0)} km
                        </div>
                        <div className="text-[11px] text-[var(--muted)]">{depthCat.labelId}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-[var(--muted)]">
                        {ev.coordinatesText}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block rounded-full bg-[var(--well)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-2)] shadow-[var(--inset-sm)]">
                          {tsu.shortStatusLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] font-bold text-[var(--ink-2)]">
                        {ev.sourceAgency}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          href={`/earthquakes/${encodeURIComponent(ev.id)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="btn !px-3 !py-1.5 !text-xs"
                        >
                          Buka
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rule)] pt-4">
            <div className="font-mono text-xs text-[var(--muted)]">
              Menampilkan {(filteredResult.page - 1) * PAGE_SIZE + 1}–
              {Math.min(filteredResult.page * PAGE_SIZE, filteredResult.total)} dari{' '}
              {filteredResult.total} kejadian
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={filteredResult.page <= 1}
                className="btn !px-3 !py-1.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Sebelumnya
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(filteredResult.totalPages, p + 1))
                }
                disabled={filteredResult.page >= filteredResult.totalPages}
                className="btn !px-3 !py-1.5 disabled:opacity-40"
              >
                Berikutnya
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default CatalogExplorerClient;
