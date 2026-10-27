'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink, Share2 } from 'lucide-react';
import {
  formatCommaNumber,
  getRoneMagnitudeDataAttr,
} from '@/lib/earthquakes/parser';
import {
  getDepthSpec,
  getMagnitudeSpec,
  getTsunamiStatusPresentation,
} from '@/lib/earthquakes/severity';
import { SeismicEvent } from '@/lib/earthquakes/types';
import { HypocenterCrossSection } from './HypocenterCrossSection';

interface EventDetailPanelProps {
  event: SeismicEvent;
  compact?: boolean;
}

export function EventDetailPanel({ event, compact = false }: EventDetailPanelProps) {
  const magSpec = getMagnitudeSpec(event.magnitudeClass);
  const depthSpec = getDepthSpec(event.depthCategory);
  const tsunamiPresentation = getTsunamiStatusPresentation(event.tsunamiStatus);
  const dataM = getRoneMagnitudeDataAttr(event.magnitude);

  const handleCopyShareUrl = () => {
    if (typeof window === 'undefined' || !navigator.clipboard) return;
    const url = `${window.location.origin}/earthquakes/${encodeURIComponent(event.id)}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  return (
    <article
      aria-label={`Detail peristiwa gempa ${event.region}`}
      className="card space-y-4"
    >
      {/* Top Metadata Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[var(--ink-3)]">
        <div>
          <span className="font-bold text-[var(--accent-ink)]">
            {event.sourceAgency} · {event.sourceId}
          </span>
          <span aria-hidden="true"> · </span>
          <span>
            {event.verificationStatus === 'verified'
              ? 'Terverifikasi'
              : 'Parameter Awal'}
          </span>
        </div>
        <span className="num">ID: {event.id}</span>
      </div>

      {/* Primary Magnitude Badge & Region Headline */}
      <div className="flex items-start gap-4 pb-3 border-b border-[var(--rule)]">
        <div
          className="mag"
          data-m={dataM}
          style={{ '--v': event.magnitude, '--size': '54px' } as React.CSSProperties}
        >
          <span className="mag__num">{formatCommaNumber(event.magnitude, 1)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-[var(--accent-ink)]">
            Magnitudo M {formatCommaNumber(event.magnitude, 1)} · {magSpec.labelId} ({magSpec.rangeText})
          </div>
          <h3 className="mt-0.5 text-base sm:text-lg font-bold text-[var(--ink)] leading-snug">
            {event.region}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--ink-3)]">
            {event.tectonicZone}
          </p>
        </div>
      </div>

      {/* Inset Wells Facts Grid (.facts) */}
      <dl className="facts">
        <div>
          <dt>Kedalaman</dt>
          <dd className="num">
            {event.depthKm.toFixed(1)} km ({depthSpec.labelId})
          </dd>
        </div>

        <div>
          <dt>Koordinat</dt>
          <dd className="num">{event.coordinatesText}</dd>
        </div>

        <div>
          <dt>Waktu Kejadian (WIB)</dt>
          <dd className="num text-xs">{event.formattedTimeWib}</dd>
        </div>

        <div>
          <dt>Potensi Tsunami</dt>
          <dd className="text-xs">{tsunamiPresentation.shortStatusLabel}</dd>
        </div>
      </dl>

      {/* Official Tsunami & Felt Report Well */}
      <div className="well space-y-1.5 text-xs">
        <div className={`font-mono font-bold ${tsunamiPresentation.toneClass}`}>
          {tsunamiPresentation.codeLabel}
        </div>
        <p className="text-[var(--ink-2)]">
          <strong>Keterangan:</strong> {event.tsunamiOfficialText}
        </p>
        {event.feltReport && (
          <p className="text-[var(--ink-2)] pt-1 border-t border-[var(--rule)]">
            <strong>Dirasakan (Skala MMI):</strong> {event.feltReport}
          </p>
        )}
        {event.instructionText && (
          <p className="text-[var(--ink-3)] pt-1 border-t border-[var(--rule)]">
            <strong>Arahan BMKG:</strong> {event.instructionText}
          </p>
        )}
      </div>

      {/* Hypocenter Cross-Section Visualization */}
      {!compact && <HypocenterCrossSection event={event} />}

      {/* Actions */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--rule)]">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/earthquakes/${encodeURIComponent(event.id)}`}
            className="btn btn--accent btn--sm"
          >
            Detail &amp; Peta Guncangan
          </Link>
          <button
            type="button"
            onClick={handleCopyShareUrl}
            className="btn btn--sm"
          >
            <Share2 className="w-3.5 h-3.5" /> Bagikan
          </button>
        </div>

        <a
          href="https://gempa.rone.dev/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--accent-ink)]"
        >
          Gempa API <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </article>
  );
}
