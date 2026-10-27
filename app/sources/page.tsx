'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/navigation/Header';
import { Footer } from '@/components/layout/Footer';
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Database,
  Code2,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { DatasetEnvelope } from '@/lib/earthquakes/types';
import { formatFullIndonesianDateTimeWib } from '@/lib/earthquakes/parser';

const RONE_ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1/earthquakes/latest',
    description: 'Gempa bumi terbaru tunggal dari BMKG lengkap dengan parameter lokasi, potensi tsunami, dan tautan shakemap.',
    url: 'https://gempa.rone.dev/api/v1/earthquakes/latest',
  },
  {
    method: 'GET',
    path: '/api/v1/earthquakes/felt',
    description: 'Daftar 15 gempa bumi terkini yang dirasakan masyarakat beserta laporan intensitas skala MMI.',
    url: 'https://gempa.rone.dev/api/v1/earthquakes/felt',
  },
  {
    method: 'GET',
    path: '/api/v1/earthquakes/significant',
    description: 'Daftar 15 gempa bumi signifikan dengan magnitudo M ≥ 5,0 beserta status potensi tsunami resmi BMKG.',
    url: 'https://gempa.rone.dev/api/v1/earthquakes/significant',
  },
  {
    method: 'GET',
    path: '/api/v1/earthquakes/realtime',
    description: 'Umpan deteksi seismik real-time (semua magnitudo) yang diperbarui secara berkala dari jaringan InaTEWS BMKG.',
    url: 'https://gempa.rone.dev/api/v1/earthquakes/realtime',
  },
];

export default function SourcesPage() {
  const [dataset, setDataset] = useState<DatasetEnvelope | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/earthquakes?limit=50', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json?.dataset) setDataset(json.dataset);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--clay)] text-[var(--ink)] flex flex-col">
      <Header
        feedHealth={dataset?.feedHealth}
        lastUpdatedIso={dataset?.lastUpdatedIso}
        onRefreshRequest={loadHealth}
        isRefreshing={loading}
      />

      <main className="rone-container flex-1 space-y-8 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="section-head__eyebrow">
              Dokumentasi Integrasi API &amp; Sumber Resmi · OAS 3.1 (v2.0.0)
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
              Arsitektur Data &amp; Endpoint gempa.rone.dev
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--ink-2)]">
              Platform ini mengintegrasikan langsung REST API publik{' '}
              <a
                href="https://gempa.rone.dev/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono font-semibold text-[var(--accent)] underline"
              >
                https://gempa.rone.dev/docs
              </a>{' '}
              yang menyajikan data terbuka resmi <strong>BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)</strong>, dilengkapi katalog global USGS.
            </p>
          </div>

          <button type="button" onClick={loadHealth} className="btn btn--accent">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Uji Koneksi Endpoint
          </button>
        </div>

        {/* Live Adapter Status Grid */}
        <section className="space-y-3">
          <div className="section-head">
            <span className="section-head__eyebrow">Status Telemetri Saat Ini</span>
            <span className="section-head__meta">
              {dataset?.lastUpdatedIso
                ? `Diperbarui ${formatFullIndonesianDateTimeWib(dataset.lastUpdatedIso)}`
                : 'Memeriksa...'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dataset?.sources.map((src) => (
              <div key={src.sourceId} className="card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[11px] font-bold uppercase text-[var(--accent)]">
                      {src.sourceId}
                    </span>
                    <h2 className="mt-0.5 text-sm font-bold text-[var(--ink)]">
                      {src.name}
                    </h2>
                  </div>
                  {src.ok ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--well)] px-2.5 py-1 font-mono text-[11px] font-bold text-[var(--ok)] shadow-[var(--inset-sm)]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      LIVE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--well)] px-2.5 py-1 font-mono text-[11px] font-bold text-[var(--warn)] shadow-[var(--inset-sm)]">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      FALLBACK
                    </span>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[var(--well)] p-3 font-mono text-xs shadow-[var(--inset-sm)]">
                  <div>
                    <dt className="text-[10px] uppercase text-[var(--muted)]">Jumlah Event</dt>
                    <dd className="font-bold text-[var(--ink)]">{src.recordCount} item</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-[var(--muted)]">Latensi</dt>
                    <dd className="font-bold text-[var(--ink)]">{src.latencyMs} ms</dd>
                  </div>
                </dl>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="truncate font-mono text-[11px] text-[var(--muted)]">
                    {src.endpoint}
                  </span>
                  <a
                    href={src.endpoint}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
                  >
                    JSON <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* gempa.rone.dev OpenAPI v2.0.0 Reference */}
        <section className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] pb-4">
            <div className="flex items-center gap-2.5">
              <Code2 className="h-5 w-5 text-[var(--accent)]" />
              <div>
                <h2 className="text-lg font-bold text-[var(--ink)]">
                  Spesifikasi Endpoint <code className="font-mono">gempa.rone.dev</code> (v2.0.0)
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  Kontrak skema JSON divalidasi secara ketat menggunakan Zod pada batas server.
                </p>
              </div>
            </div>
            <a
              href="https://gempa.rone.dev/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
            >
              Buka Scalar API Docs
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {RONE_ENDPOINTS.map((ep) => (
              <div key={ep.path} className="well p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-[var(--accent)] px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                      {ep.method}
                    </span>
                    <code className="font-mono text-xs font-bold text-[var(--ink)]">
                      {ep.path}
                    </code>
                  </div>
                  <a
                    href={ep.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    Buka Endpoint ↗
                  </a>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--ink-2)]">
                  {ep.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer & Safety */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="card p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
              <Database className="h-4 w-4 text-[var(--accent)]" />
              Atribusi &amp; Integritas Sumber
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--ink-2)]">
              Seluruh data gempa bumi Indonesia bersumber dari <strong>BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)</strong> melalui layanan distribusi <code className="font-mono">gempa.rone.dev</code> dan endpoint resmi <code className="font-mono">data.bmkg.go.id</code>. Parameter kejadian awal dapat mengalami pembaruan setelah dianalisis ulang oleh seismolog.
            </p>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
              <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
              Kebijakan Keselamatan Tsunami
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--ink-2)]">
              Aplikasi ini menyajikan ulang status resmi BMKG apa adanya dan tidak pernah membuat prediksi tsunami spekulatif sendiri. Untuk keputusan evakuasi dan arahan keselamatan darurat, selalu ikuti instruksi resmi BMKG InaTEWS dan BPBD setempat.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
