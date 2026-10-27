'use client';

import React from 'react';
import { useSeismaTheme } from '@/components/theme/ThemeProvider';
import { formatCommaNumber } from '@/lib/earthquakes/parser';
import { getDepthSpec, getMagnitudeSpec } from '@/lib/earthquakes/severity';
import { SeismicEvent } from '@/lib/earthquakes/types';

interface HypocenterCrossSectionProps {
  event: SeismicEvent;
}

export function HypocenterCrossSection({ event }: HypocenterCrossSectionProps) {
  const { resolvedTheme } = useSeismaTheme();
  const isDark = resolvedTheme === 'dark';
  const magSpec = getMagnitudeSpec(event.magnitudeClass);
  const depthSpec = getDepthSpec(event.depthCategory);

  const clampedDepth = Math.min(650, Math.max(2, event.depthKm));
  const hypoY = 52 + (clampedDepth / 650) * 176;
  const colorHex = isDark ? magSpec.hexDark : magSpec.hexLight;
  const depthHex = isDark ? depthSpec.hexDark : depthSpec.hexLight;

  return (
    <div className="well space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="text-xs font-mono font-bold uppercase text-[var(--ink-2)]">
            Penampang Litosfer: Episenter vs Hiposenter
          </h4>
          <p className="text-xs text-[var(--ink-3)] mt-0.5">
            Visualisasi proporsional kedalaman fokus gempa terhadap lapisan kerak dan zona subduksi.
          </p>
        </div>
        <span className="num text-xs font-bold text-[var(--ink)]">
          Kedalaman Fokus: {formatCommaNumber(event.depthKm, 1)} km ({depthSpec.labelId})
        </span>
      </div>

      <svg
        viewBox="0 0 520 260"
        className="w-full h-auto rounded-[12px]"
        style={{ background: isDark ? '#23201c' : '#e7e1d8' }}
        role="img"
        aria-label={`Diagram penampang hiposenter gempa pada kedalaman ${event.depthKm} kilometer`}
      >
        {/* Crust Layer (0 - 70 km) */}
        <rect
          x={65}
          y={52}
          width={435}
          height={28}
          fill={isDark ? '#2f2923' : '#ddd6cb'}
          opacity={0.85}
        />
        {/* Intermediate Wadati-Benioff Zone (70 - 300 km) */}
        <rect
          x={65}
          y={80}
          width={435}
          height={64}
          fill={isDark ? '#26221d' : '#d5cdc0'}
          opacity={0.9}
        />
        {/* Deep Upper Mantle (300 - 650 km) */}
        <rect
          x={65}
          y={144}
          width={435}
          height={88}
          fill={isDark ? '#1c1a17' : '#ccc3b4'}
          opacity={0.95}
        />

        {/* Subducting Slab Schematic Curve */}
        <path
          d="M 110 52 Q 240 85 360 228 L 415 228 Q 290 75 155 52 Z"
          fill={isDark ? 'rgba(240, 122, 60, 0.12)' : 'rgba(194, 65, 12, 0.1)'}
          stroke={isDark ? 'rgba(240, 122, 60, 0.35)' : 'rgba(194, 65, 12, 0.3)'}
          strokeDasharray="4 3"
        />

        {/* Depth Horizon Reference Lines */}
        {[
          { km: 0, y: 52 },
          { km: 70, y: 80 },
          { km: 300, y: 144 },
          { km: 600, y: 222 },
        ].map((line) => (
          <g key={line.km}>
            <line
              x1={65}
              y1={line.y}
              x2={500}
              y2={line.y}
              stroke={isDark ? 'rgba(239, 232, 220, 0.14)' : 'rgba(98, 88, 73, 0.22)'}
              strokeDasharray={line.km === 0 ? undefined : '3 3'}
              strokeWidth={line.km === 0 ? 1.5 : 1}
            />
            <text
              x={60}
              y={line.y + 3}
              textAnchor="end"
              fill={isDark ? '#9d9383' : '#625849'}
              className="text-[9px] font-mono"
            >
              {line.km} km
            </text>
          </g>
        ))}

        {/* Vertical Plumb Axis from Epicenter to Hypocenter */}
        <line
          x1={260}
          y1={52}
          x2={260}
          y2={hypoY}
          stroke={depthHex}
          strokeWidth={2}
          strokeDasharray="4 2"
        />

        {/* Wavefront Concentric Attenuation Rings */}
        {[18, 34, 52].map((r) => (
          <circle
            key={r}
            cx={260}
            cy={hypoY}
            r={r}
            fill="none"
            stroke={colorHex}
            strokeOpacity={0.28}
            strokeWidth={1.2}
          />
        ))}

        {/* Surface Epicenter Marker */}
        <circle
          cx={260}
          cy={52}
          r={6}
          fill={isDark ? '#f07a3c' : '#c2410c'}
          stroke="#FFFFFF"
          strokeWidth={1.5}
        />
        <text
          x={260}
          y={36}
          textAnchor="middle"
          fill={isDark ? '#efe8dc' : '#2a241d'}
          className="text-[10px] font-mono font-bold"
        >
          EPISENTER ({event.coordinatesText})
        </text>

        {/* Subsurface Hypocenter Marker */}
        <circle
          cx={260}
          cy={hypoY}
          r={8}
          fill={colorHex}
          stroke="#FFFFFF"
          strokeWidth={2}
        />
        <text
          x={276}
          y={hypoY - 3}
          fill={isDark ? '#efe8dc' : '#2a241d'}
          className="text-[10px] font-mono font-bold"
        >
          HIPOSENTER (M {formatCommaNumber(event.magnitude, 1)})
        </text>
        <text
          x={276}
          y={hypoY + 11}
          fill={isDark ? '#c4baaa' : '#4f463b'}
          className="text-[9px] font-mono"
        >
          Kedalaman: {formatCommaNumber(event.depthKm, 1)} km · [{depthSpec.shortCode}]
        </text>
      </svg>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[var(--ink-2)]">
        <div>
          <strong className="text-[var(--ink)]">Episenter:</strong> Proyeksi tegak lurus di
          permukaan bumi ({event.coordinatesText}).
        </div>
        <div>
          <strong className="text-[var(--ink)]">Hiposenter:</strong> Titik pelepasan energi pada
          kedalaman {event.depthKm} km. {depthSpec.description}
        </div>
      </div>
    </div>
  );
}
