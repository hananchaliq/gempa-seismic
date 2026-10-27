'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Compass,
  MapPin,
  ArrowDownRight,
  SlidersHorizontal,
} from 'lucide-react';
import { SeismicEvent, SeismicStatistics } from '@/lib/earthquakes/types';
import { getDepthSpec, getMagnitudeSpec } from '@/lib/earthquakes/severity';
import { formatCommaNumber, getRoneMagnitudeDataAttr } from '@/lib/earthquakes/parser';
import { HypocenterCrossSection } from '@/components/earthquake/HypocenterCrossSection';
import type { GlobeCameraPreset } from '@/components/globe/SeismicGlobe3D';

export interface SeismicScrollNarrativeProps {
  latestEvent: SeismicEvent;
  deepestEvent: SeismicEvent | null;
  statistics: SeismicStatistics;
  activePreset: GlobeCameraPreset;
  onPresetChange: (preset: GlobeCameraPreset) => void;
  onJumpToLiveMap: () => void;
}

const STORY_SEQUENCES: Array<{
  seq: string;
  title: string;
  subtitle: string;
  body: string;
  metricLabel: string;
  metricValue: string;
  preset: GlobeCameraPreset;
}> = [
  {
    seq: 'SEQUENCE 01 / GLOBAL TECTONIC CONTEXT',
    title: 'Sabuk Seismik Aktif & Pertemuan Tiga Lempeng Utama',
    subtitle: 'Introduction — Mengapa Nusantara Bergerak Setiap Hari',
    body: 'Kepulauan Indonesia berada tepat di titik konvergensi tiga lempeng tektonik raksasa: Indo-Australia (bergerak ke utara ~60–70 mm/tahun), Eurasia, dan Pasifik-Filipina. Tumbukan terus-menerus ini membentuk zona subduksi Sunda–Banda dan jaringan sesar darat aktif.',
    metricLabel: 'Konvergensi Indo-Australia',
    metricValue: '65 mm / thn',
    preset: 'global',
  },
  {
    seq: 'SEQUENCE 02 / ARCHIPELAGO SUBDUCTION',
    title: 'Dari Bola Bumi Menuju Busur Subduksi Nusantara',
    subtitle: 'From Earth to Indonesia — Pemetaan Episenter Aktual',
    body: 'Saat fokus beralih ke busur kepulauan Indonesia, distribusi episenter memperlihatkan pola yang jelas: gempa dangkal terkonsentrasi di sepanjang palung samudra dan sesar darat (Semangko, Palu-Koro, Sorong), sementara gempa menengah hingga dalam memetakan kemiringan lempeng (Wadati–Benioff zone) di bawah Laut Jawa, Flores, dan Banda.',
    metricLabel: 'Zona Subduksi Aktif',
    metricValue: 'Sunda — Banda',
    preset: 'indonesia',
  },
  {
    seq: 'SEQUENCE 03 / ANATOMY OF AN EVENT',
    title: 'Membedakan Episenter, Hiposenter, Magnitudo, dan Kedalaman',
    subtitle: 'Understanding an Event — Studi Kasus Kejadian Aktual',
    body: 'Episenter adalah proyeksi titik gempa tepat di permukaan bumi (Lintang/Bujur), sedangkan Hiposenter adalah titik pelepasan energi sesungguhnya di bawah kerak bumi. Gempa dangkal sering menghasilkan guncangan permukaan (MMI) lokal lebih kuat dibandingkan gempa dalam karena redaman gelombang seismik.',
    metricLabel: 'Parameter Kunci',
    metricValue: 'Hiposenter vs Episenter',
    preset: 'banda_deep',
  },
  {
    seq: 'SEQUENCE 04 / OPERATIONAL MONITORING',
    title: 'Transisi dari Observasi Spasial 3D ke Peta Kartografi Presisi',
    subtitle: 'From Globe to Live Map — Sinkronisasi Event Terpilih',
    body: 'Globe 3D memberikan pemahaman lengkungan bumi dan distribusi kedalaman regional, sedangkan peta 2D interaktif memungkinkan inspeksi jarak kota, garis pantai, dan klaster mikro-seismik secara presisi dengan tetap mempertahankan kejadian yang sedang Anda amati.',
    metricLabel: 'Sinkronisasi State',
    metricValue: '3D Globe ↔ 2D Map',
    preset: 'indonesia',
  },
];

export function SeismicScrollNarrative({
  latestEvent,
  deepestEvent,
  statistics,
  onPresetChange,
  onJumpToLiveMap,
}: SeismicScrollNarrativeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  const onPresetChangeRef = useRef(onPresetChange);
  useEffect(() => {
    onPresetChangeRef.current = onPresetChange;
  }, [onPresetChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || reducedMotion) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.seismic-story-step');
      cards.forEach((card, index) => {
        ScrollTrigger.create({
          trigger: card,
          start: 'top 65%',
          end: 'bottom 35%',
          onEnter: () => {
            setActiveStep(index);
            const targetPreset = STORY_SEQUENCES[index]?.preset;
            if (targetPreset) onPresetChangeRef.current(targetPreset);
          },
          onEnterBack: () => {
            setActiveStep(index);
            const targetPreset = STORY_SEQUENCES[index]?.preset;
            if (targetPreset) onPresetChangeRef.current(targetPreset);
          },
        });
      });
    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, [reducedMotion]);

  const caseStudyEvent = latestEvent;
  const shallowBucket = statistics.depthDistribution.find((d) => d.category === 'shallow');
  const shallowPct = shallowBucket ? shallowBucket.percentage : 0;
  const deepPct = Math.max(0, 100 - shallowPct);

  return (
    <section
      ref={containerRef}
      aria-label="Panduan Visual Tektonik dan Anatomi Gempa"
      className="relative"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="section-head__eyebrow">
            Interactive Geospatial Narrative · GSAP ScrollTrigger
          </span>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
            Memahami Dinamika Seismik Indonesia dari Data Aktual
          </h2>
        </div>

        <div className="segmented" role="tablist" aria-label="Tahapan narasi seismik">
          {[0, 1, 2, 3].map((step) => (
            <button
              key={step}
              type="button"
              role="tab"
              aria-selected={activeStep === step}
              aria-pressed={activeStep === step}
              onClick={() => {
                setActiveStep(step);
                onPresetChange(STORY_SEQUENCES[step].preset);
              }}
              className="font-mono"
            >
              0{step + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Sticky Analytical Diagram Column */}
        <div className="lg:col-span-5">
          <div className="card sticky top-24 p-6">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-[var(--accent)]" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                  STAGE 0{activeStep + 1} TELEMETRI
                </span>
              </div>
              <span className="rounded-full bg-[var(--well)] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--muted)] shadow-[var(--inset-sm)]">
                {reducedMotion ? 'STATIC MODE' : 'SCROLL SYNC'}
              </span>
            </div>

            {activeStep === 0 && (
              <div className="mt-4 space-y-4">
                <div className="well p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Sampel Katalog Aktif Saat Ini
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <div className="font-mono text-2xl font-bold text-[var(--ink)]">
                        {statistics.totalEvents}
                      </div>
                      <div className="text-xs text-[var(--muted)]">Total Kejadian Terekam</div>
                    </div>
                    <div>
                      <div className="font-mono text-2xl font-bold text-[var(--accent)]">
                        {statistics.bmkgCount}
                      </div>
                      <div className="text-xs text-[var(--muted)]">Sumber Resmi BMKG</div>
                    </div>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-[var(--ink-2)]">
                  Lebih dari 80% energi seismik di sekitar kepulauan Indonesia dilepaskan sepanjang batas subduksi Sunda–Banda dan zona tumbukan Laut Maluku–Papua.
                </p>
              </div>
            )}

            {activeStep === 1 && (
              <div className="mt-4 space-y-4">
                <div className="well p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Profil Kedalaman Katalog Aktif
                  </div>
                  <div className="mt-3 space-y-2.5">
                    <div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--ink-2)]">Dangkal (&lt;70 km)</span>
                        <span className="font-mono font-bold text-[var(--ink)]">
                          {formatCommaNumber(shallowPct, 1)}%
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--clay-deep)] shadow-[var(--inset-sm)]">
                        <div
                          className="h-full bg-[#d0461a]"
                          style={{ width: `${Math.round(shallowPct)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--ink-2)]">Menengah &amp; Dalam (≥70 km)</span>
                        <span className="font-mono font-bold text-[var(--ink)]">
                          {formatCommaNumber(deepPct, 1)}%
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--clay-deep)] shadow-[var(--inset-sm)]">
                        <div
                          className="h-full bg-[#e8b10c]"
                          style={{ width: `${Math.round(deepPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {deepestEvent && (
                  <p className="text-xs leading-relaxed text-[var(--ink-2)]">
                    Hiposenter terdalam saat ini berada pada{' '}
                    <strong className="font-mono text-[var(--ink)]">
                      {formatCommaNumber(deepestEvent.depthKm, 0)} km
                    </strong>{' '}
                    di wilayah {deepestEvent.region}.
                  </p>
                )}
              </div>
            )}

            {activeStep === 2 && caseStudyEvent && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-[var(--well)] px-3.5 py-2.5 shadow-[var(--inset-sm)]">
                  <div className="min-w-0 pr-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      Studi Kasus Aktual Terpilih
                    </div>
                    <div className="truncate text-xs font-bold text-[var(--ink)]">
                      {caseStudyEvent.region}
                    </div>
                  </div>
                  <div
                    className="mag shrink-0"
                    data-m={getRoneMagnitudeDataAttr(caseStudyEvent.magnitude)}
                  >
                    <span className="mag__num">{formatCommaNumber(caseStudyEvent.magnitude, 1)}</span>
                  </div>
                </div>
                <HypocenterCrossSection event={caseStudyEvent} />
              </div>
            )}

            {activeStep === 3 && (
              <div className="mt-4 space-y-4">
                <div className="well p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--ink)]">
                    <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
                    Kontrol Eksplorasi Lanjutan
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-2)]">
                    Beralih langsung ke Peta Interaktif 2D di bagian atas dengan tetap mempertahankan kejadian yang sedang dipilih:
                  </p>
                  <button
                    type="button"
                    onClick={onJumpToLiveMap}
                    className="btn btn--accent mt-3 w-full"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Fokus ke Peta Interaktif 2D
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Story Cards */}
        <div className="space-y-4 lg:col-span-7">
          {STORY_SEQUENCES.map((item, idx) => {
            const isCurrent = activeStep === idx;
            const magSpec = getMagnitudeSpec(caseStudyEvent.magnitudeClass);
            const depthSpec = getDepthSpec(caseStudyEvent.depthCategory);

            return (
              <article
                key={item.seq}
                onClick={() => {
                  setActiveStep(idx);
                  onPresetChange(item.preset);
                }}
                className={`seismic-story-step cursor-pointer rounded-[var(--r-lg)] p-6 transition-all ${
                  isCurrent
                    ? 'card ring-2 ring-[var(--accent)]/45'
                    : 'well opacity-85 hover:opacity-100'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    {item.seq}
                  </span>
                  <span className="rounded-full bg-[var(--clay)] px-3 py-1 font-mono text-[11px] font-semibold text-[var(--ink-2)] shadow-[var(--raise-sm)]">
                    {item.metricLabel}: <strong>{item.metricValue}</strong>
                  </span>
                </div>

                <h3 className="mt-2 text-lg font-bold text-[var(--ink)]">{item.title}</h3>
                <div className="mt-0.5 text-xs font-semibold text-[var(--muted)]">
                  {item.subtitle}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ink-2)]">{item.body}</p>

                {idx === 2 && caseStudyEvent && (
                  <div className="mt-4 grid grid-cols-3 gap-2.5 rounded-xl bg-[var(--clay)] p-3.5 shadow-[var(--raise-sm)]">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--muted)]">
                        Magnitudo
                      </div>
                      <div
                        className="font-mono text-sm font-bold"
                        style={{ color: magSpec.hexLight }}
                      >
                        M {formatCommaNumber(caseStudyEvent.magnitude, 1)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--muted)]">
                        Hiposenter
                      </div>
                      <div className="font-mono text-sm font-bold text-[var(--ink)]">
                        {formatCommaNumber(caseStudyEvent.depthKm, 0)} km ({depthSpec.labelId})
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--muted)]">
                        Sumber Data
                      </div>
                      <div className="font-mono text-sm font-bold text-[var(--ink)]">
                        {caseStudyEvent.sourceAgency}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default SeismicScrollNarrative;
