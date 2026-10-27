'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  Share2,
  Check,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { Header } from '@/components/navigation/Header';
import { Footer } from '@/components/layout/Footer';
import { DatasetEnvelope, SeismicEvent } from '@/lib/earthquakes/types';
import {
  formatFullIndonesianDateTimeWib,
  formatCommaNumber,
} from '@/lib/earthquakes/parser';
import {
  getMagnitudeSpec,
  getDepthSpec,
  getTsunamiStatusPresentation,
} from '@/lib/earthquakes/severity';
import { HypocenterCrossSection } from '@/components/earthquake/HypocenterCrossSection';
import { SeismicLiveMap } from '@/components/map/SeismicLiveMap';

export default function EarthquakeDetailPage() {
  const params = useParams<{ id: string }>();
  const decodedId = decodeURIComponent(params?.id || '');

  const [dataset, setDataset] = useState<DatasetEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

  const event: SeismicEvent | null =
    dataset?.events.find((e) => e.id === decodedId) || null;

  const handleCopyShareUrl = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--clay)] text-[var(--ink)] flex flex-col">
      <Header
        feedHealth={dataset?.feedHealth}
        lastUpdatedIso={dataset?.lastUpdatedIso}
        isRefreshing={loading}
      />

      <main className="rone-container flex-1 space-y-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/catalog" className="btn">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Riwayat Katalog
          </Link>

          <button type="button" onClick={handleCopyShareUrl} className="btn">
            {copied ? (
              <>
                <Check className="h-4 w-4 text-[var(--ok)]" />
                Tautan Tersalin
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 text-[var(--accent)]" />
                Bagikan URL Kejadian
              </>
            )}
          </button>
        </div>

        {loading ? (
          <div className="card p-10 text-center font-mono text-sm text-[var(--muted)]">
            Memuat parameter lengkap kejadian gempa bumi...
          </div>
        ) : !event ? (
          <div className="card p-8">
            <div className="flex items-center gap-3 text-[var(--danger)]">
              <AlertTriangle className="h-6 w-6" />
              <h1 className="text-lg font-bold">
                Kejadian Tidak Ditemukan dalam Katalog Aktif
              </h1>
            </div>
            <p className="mt-2 text-sm text-[var(--ink-2)]">
              Identitas kejadian <code className="font-mono">{decodedId}</code> mungkin berada di luar jendela 200 kejadian terbaru atau telah diperbarui oleh sumber resmi.
            </p>
            <div className="mt-4">
              <Link href="/" className="btn btn--accent">
                Lihat Gempa Bumi Terkini
              </Link>
            </div>
          </div>
        ) : (
          (() => {
            const magSpec = getMagnitudeSpec(event.magnitudeClass);
            const depthSpec = getDepthSpec(event.depthCategory);
            const tsuSpec = getTsunamiStatusPresentation(event.tsunamiStatus);

            const clampedMag = Math.max(0, Math.min(9, event.magnitude));
            const dashOffset = (282.74 * (1 - clampedMag / 9)).toFixed(2);

            return (
              <div className="space-y-8">
                {/* Top Hero Card */}
                <div className="card p-6 sm:p-8">
                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                    <div className="flex flex-col items-center justify-center lg:col-span-4">
                      <div className="dial">
                        <svg viewBox="0 0 120 120" aria-hidden="true">
                          <circle
                            className="dial__track"
                            cx="60"
                            cy="60"
                            r="45"
                            strokeDasharray="282.74"
                            strokeDashoffset="0"
                            transform="rotate(135 60 60)"
                          />
                          <circle
                            className="dial__arc"
                            cx="60"
                            cy="60"
                            r="45"
                            stroke={magSpec.hexLight}
                            strokeDasharray="282.74"
                            strokeDashoffset={dashOffset}
                            transform="rotate(135 60 60)"
                          />
                        </svg>
                        <div className="dial__center">
                          <span className="dial__unit">{event.magnitudeType || 'M'}</span>
                          <span className="dial__value">
                            {formatCommaNumber(event.magnitude, 1)}
                          </span>
                          <span className="dial__scale">{magSpec.labelId}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 lg:col-span-8">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--well)] px-3 py-1 font-mono text-xs font-bold text-[var(--accent)] shadow-[var(--inset-sm)]">
                          {event.sourceAgency} · {event.sourceId}
                        </span>
                        <span className="rounded-full bg-[var(--well)] px-3 py-1 font-mono text-xs text-[var(--muted)] shadow-[var(--inset-sm)]">
                          ID: {event.id}
                        </span>
                      </div>

                      <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
                        {event.region}
                      </h1>

                      <p className="font-mono text-xs text-[var(--muted)]">
                        Waktu Kejadian: {formatFullIndonesianDateTimeWib(event.originTimeIso)} ({event.formattedTimeUtc})
                      </p>

                      <dl className="facts pt-2">
                        <div className="facts__item">
                          <dt>Kedalaman Hiposenter</dt>
                          <dd>
                            {formatCommaNumber(event.depthKm, 0)} km · {depthSpec.labelId}
                          </dd>
                        </div>
                        <div className="facts__item">
                          <dt>Koordinat Episenter</dt>
                          <dd>{event.coordinatesText}</dd>
                        </div>
                        <div className="facts__item">
                          <dt>Keterangan Resmi / Tsunami</dt>
                          <dd>{tsuSpec.shortStatusLabel}</dd>
                        </div>
                        <div className="facts__item">
                          <dt>Status Parameter</dt>
                          <dd>
                            {event.verificationStatus === 'verified'
                              ? 'Terverifikasi Seismolog'
                              : 'Parameter Awal Otomatis'}
                          </dd>
                        </div>
                      </dl>

                      {event.feltReport && (
                        <div className="well p-4">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                            Laporan Dirasakan Masyarakat (Skala MMI)
                          </div>
                          <div className="mt-1 text-sm font-semibold text-[var(--ink)]">
                            {event.feltReport}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Map + Cross Section + Shakemap */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-7">
                    <SeismicLiveMap
                      events={dataset?.events || [event]}
                      selectedEvent={event}
                      onSelectEvent={() => {}}
                    />
                  </div>
                  <div className="space-y-6 lg:col-span-5">
                    <HypocenterCrossSection event={event} />

                    {event.shakemapUrl && (
                      <div className="card p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                            Peta Guncangan Resmi (BMKG Shakemap)
                          </span>
                          <a
                            href={event.shakemapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[var(--accent)] hover:underline"
                          >
                            Buka Penuh <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                        <div className="well overflow-hidden p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={event.shakemapUrl}
                            alt={`BMKG Shakemap untuk ${event.region}`}
                            referrerPolicy="no-referrer"
                            className="max-h-80 w-full rounded-lg object-contain"
                          />
                        </div>
                      </div>
                    )}

                    <div className="well p-4 text-xs leading-relaxed text-[var(--ink-2)]">
                      <div className="flex items-center gap-2 font-bold text-[var(--ink)]">
                        <ShieldAlert className="h-4 w-4 text-[var(--accent)]" />
                        Catatan Keselamatan &amp; Sumber Resmi
                      </div>
                      <p className="mt-1">{event.tsunamiOfficialText}</p>
                      <div className="mt-3">
                        <a
                          href={event.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn !px-3.5 !py-2 !text-xs"
                        >
                          Verifikasi di Portal Resmi ({event.sourceAgency})
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </main>

      <Footer />
    </div>
  );
}
