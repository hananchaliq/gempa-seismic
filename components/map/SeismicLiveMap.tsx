'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Layers, Plus, Minus, Table2, Globe2 } from 'lucide-react';
import { useSeismaTheme } from '@/components/theme/ThemeProvider';
import {
  formatCommaNumber,
  getRoneMagnitudeDataAttr,
} from '@/lib/earthquakes/parser';
import {
  getDepthSpec,
  getMagnitudeSpec,
} from '@/lib/earthquakes/severity';
import { SeismicEvent } from '@/lib/earthquakes/types';
import { INDONESIAN_FAULT_PATHS } from '@/lib/globe/proceduralGlobe';

interface SeismicLiveMapProps {
  events: SeismicEvent[];
  selectedEvent: SeismicEvent | null;
  onSelectEvent: (event: SeismicEvent) => void;
}

const EMBEDDED_LAND_GEOJSON: Array<{
  name: string;
  coordinates: Array<[number, number]>;
}> = [
  {
    name: 'Sumatra',
    coordinates: [
      [95.3, 5.6],
      [97.5, 5.1],
      [99.8, 3.2],
      [102.2, 1.2],
      [104.8, -1.8],
      [105.9, -5.8],
      [104.4, -5.9],
      [102.1, -3.8],
      [100.2, -1.2],
      [98.4, 1.5],
      [96.0, 4.2],
      [95.3, 5.6],
    ],
  },
  {
    name: 'Jawa',
    coordinates: [
      [105.2, -6.1],
      [108.5, -6.4],
      [111.2, -6.7],
      [114.4, -7.8],
      [114.3, -8.6],
      [111.0, -8.2],
      [107.8, -7.7],
      [105.3, -6.9],
      [105.2, -6.1],
    ],
  },
  {
    name: 'Bali & Nusa Tenggara',
    coordinates: [
      [114.5, -8.1],
      [116.7, -8.3],
      [119.2, -8.4],
      [122.9, -8.2],
      [125.2, -8.9],
      [124.0, -10.2],
      [120.0, -9.9],
      [116.2, -9.0],
      [114.5, -8.1],
    ],
  },
  {
    name: 'Kalimantan',
    coordinates: [
      [108.9, 1.2],
      [111.8, 2.8],
      [115.5, 5.2],
      [118.8, 4.5],
      [117.8, 0.8],
      [116.2, -3.5],
      [113.2, -3.4],
      [110.1, -2.8],
      [108.9, 1.2],
    ],
  },
  {
    name: 'Sulawesi',
    coordinates: [
      [119.5, 1.1],
      [124.9, 1.5],
      [125.2, 0.8],
      [121.2, 0.3],
      [123.3, -1.2],
      [122.9, -4.5],
      [121.5, -4.8],
      [120.4, -2.5],
      [120.3, -5.5],
      [119.3, -5.4],
      [118.9, -2.6],
      [119.5, 1.1],
    ],
  },
  {
    name: 'Maluku',
    coordinates: [
      [127.4, 2.1],
      [128.7, 1.5],
      [128.2, -0.8],
      [130.6, -3.1],
      [128.0, -3.6],
      [127.1, -0.4],
      [127.4, 2.1],
    ],
  },
  {
    name: 'Papua',
    coordinates: [
      [130.8, -0.9],
      [134.2, -0.8],
      [138.5, -2.1],
      [141.5, -2.7],
      [147.8, -6.2],
      [150.2, -10.1],
      [146.5, -8.5],
      [141.0, -8.9],
      [138.1, -8.2],
      [135.2, -4.5],
      [131.8, -2.6],
      [130.8, -0.9],
    ],
  },
  {
    name: 'Australia Utara',
    coordinates: [
      [114.0, -22.0],
      [122.0, -17.0],
      [131.0, -12.0],
      [136.5, -12.5],
      [142.5, -11.0],
      [148.0, -20.0],
      [114.0, -22.0],
    ],
  },
  {
    name: 'Filipina',
    coordinates: [
      [120.5, 18.2],
      [122.4, 16.0],
      [125.6, 11.5],
      [126.4, 6.5],
      [124.0, 6.2],
      [121.8, 11.0],
      [120.0, 15.0],
      [120.5, 18.2],
    ],
  },
];

const REFERENCE_LABELS: Array<{
  label: string;
  lng: number;
  lat: number;
  kind: 'city' | 'sea' | 'country';
}> = [
  { label: 'I N D O N E S I A', lng: 120.2, lat: -5.4, kind: 'country' },
  { label: 'Palu', lng: 119.87, lat: -0.89, kind: 'city' },
  { label: 'Mamuju', lng: 118.89, lat: -2.68, kind: 'city' },
  { label: 'Banjarmasin', lng: 114.59, lat: -3.32, kind: 'city' },
  { label: 'Surabaya', lng: 112.75, lat: -7.25, kind: 'city' },
  { label: 'Denpasar', lng: 115.22, lat: -8.65, kind: 'city' },
  { label: 'Kupang', lng: 123.58, lat: -10.17, kind: 'city' },
  { label: 'Dili', lng: 125.57, lat: -8.55, kind: 'city' },
  { label: 'Ambon', lng: 128.18, lat: -3.69, kind: 'city' },
  { label: 'Jayapura', lng: 140.7, lat: -2.53, kind: 'city' },
  { label: 'Java Sea', lng: 111.5, lat: -5.2, kind: 'sea' },
  { label: 'Flores Sea', lng: 120.8, lat: -7.2, kind: 'sea' },
  { label: 'Banda Sea', lng: 127.5, lat: -5.5, kind: 'sea' },
  { label: 'Makassar Strait', lng: 117.8, lat: -1.5, kind: 'sea' },
  { label: 'Timor Sea', lng: 127.0, lat: -11.5, kind: 'sea' },
];

function getRoneMarkerHex(magnitude: number): string {
  if (magnitude < 3.0) return '#a39a8c';
  if (magnitude < 4.0) return '#e8b10c';
  if (magnitude < 5.0) return '#f08c1a';
  if (magnitude < 6.0) return '#d0461a';
  if (magnitude < 7.0) return '#b3202f';
  return '#6e1426';
}

export function SeismicLiveMap({
  events,
  selectedEvent,
  onSelectEvent,
}: SeismicLiveMapProps) {
  const { resolvedTheme } = useSeismaTheme();
  const isDark = resolvedTheme === 'dark';

  const [viewMode, setViewMode] = useState<'map' | 'table'>('map');
  const [mapScope, setMapScope] = useState<'indonesia' | 'global'>('indonesia');
  const [showFaultLines, setShowFaultLines] = useState<boolean>(true);
  const [layerMenuOpen, setLayerMenuOpen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.max(1, Math.min(3.0, Number((prev + delta).toFixed(2)))));
  };

  const projectedMarkers = useMemo(() => {
    const minLng = mapScope === 'indonesia' ? 95 : -180;
    const maxLng = mapScope === 'indonesia' ? 142 : 180;
    const minLat = mapScope === 'indonesia' ? -12.5 : -68;
    const maxLat = mapScope === 'indonesia' ? 6.5 : 68;

    return events.map((ev) => {
      const normX = (ev.longitude - minLng) / (maxLng - minLng);
      const normY = (maxLat - ev.latitude) / (maxLat - minLat);
      const x = Math.max(24, Math.min(976, normX * 920 + 40));
      const y = Math.max(24, Math.min(496, normY * 440 + 40));
      return {
        event: ev,
        x,
        y,
      };
    });
  }, [events, mapScope]);

  const activeFocusEvent = selectedEvent || events[0] || null;
  const activeProjected = useMemo(() => {
    if (!activeFocusEvent) return null;
    return projectedMarkers.find((m) => m.event.id === activeFocusEvent.id) || null;
  }, [activeFocusEvent, projectedMarkers]);

  return (
    <div className="flex flex-col gap-3 w-full">
      {viewMode === 'map' ? (
        <div
          data-testid="live-seismic-map-stage"
          role="region"
          aria-label="Peta lokasi gempa terakhir dan deteksi 48 jam"
          className="map relative select-none"
          style={{
            background: isDark ? '#191714' : '#d2d0cc',
          }}
        >
          {/* Top-Left Neumorphic Zoom Controls matching gempa.rone.dev */}
          <div className="absolute top-3.5 left-3.5 z-20 flex flex-col rounded-[14px] bg-[var(--clay)] shadow-[var(--raise-sm)] overflow-hidden">
            <button
              type="button"
              onClick={() => handleZoom(0.35)}
              aria-label="Perbesar peta"
              className="w-10 h-10 grid place-items-center text-[var(--ink)] hover:bg-[var(--well)] border-0 border-b border-[var(--rule)] cursor-pointer bg-transparent"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(-0.35)}
              aria-label="Perkecil peta"
              className="w-10 h-10 grid place-items-center text-[var(--ink)] hover:bg-[var(--well)] border-0 cursor-pointer bg-transparent"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Top-Right Circular Layer & Scope Controls matching gempa.rone.dev */}
          <div className="absolute top-3.5 right-3.5 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-label="Tampilan tabel aksesibel"
              title="Beralih ke tabel aksesibel keyboard"
              className="icon-btn"
            >
              <Table2 className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setLayerMenuOpen((prev) => !prev)}
                aria-expanded={layerMenuOpen}
                aria-label="Opsi lapisan dan cakupan peta"
                className="icon-btn"
              >
                <Layers className="w-4 h-4" />
              </button>

              {layerMenuOpen && (
                <div className="absolute right-0 top-12 w-52 p-2.5 rounded-[14px] bg-[var(--clay)] shadow-[var(--float)] z-30 space-y-2 text-xs">
                  <div className="font-bold text-[var(--ink-3)] px-1">Cakupan Wilayah</div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMapScope('indonesia');
                        setZoomLevel(1);
                      }}
                      className={`py-1.5 px-2 rounded-[10px] font-semibold border-0 cursor-pointer ${
                        mapScope === 'indonesia'
                          ? 'bg-[var(--well)] text-[var(--accent-ink)] shadow-[var(--inset-sm)]'
                          : 'bg-transparent text-[var(--ink-2)] hover:bg-[var(--well)]'
                      }`}
                    >
                      Indonesia
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMapScope('global');
                        setZoomLevel(1);
                      }}
                      className={`py-1.5 px-2 rounded-[10px] font-semibold border-0 cursor-pointer ${
                        mapScope === 'global'
                          ? 'bg-[var(--well)] text-[var(--accent-ink)] shadow-[var(--inset-sm)]'
                          : 'bg-transparent text-[var(--ink-2)] hover:bg-[var(--well)]'
                      }`}
                    >
                      Global
                    </button>
                  </div>
                  <label className="flex items-center justify-between px-1 pt-1 border-t border-[var(--rule)] cursor-pointer text-[var(--ink-2)]">
                    <span>Garis Sesar &amp; Subduksi</span>
                    <input
                      type="checkbox"
                      checked={showFaultLines}
                      onChange={(e) => setShowFaultLines(e.target.checked)}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Vector Map Canvas */}
          <svg
            viewBox="0 0 1000 520"
            className="w-full h-full block"
            role="img"
            aria-label="Kanvas Peta Episenter Interaktif"
          >
            <g
              transform={`translate(${500 * (1 - zoomLevel)}, ${
                260 * (1 - zoomLevel)
              }) scale(${zoomLevel})`}
            >
              {/* Landmass Polygons */}
              {mapScope === 'indonesia' &&
                EMBEDDED_LAND_GEOJSON.map((feat, i) => {
                  const pointsStr = feat.coordinates
                    .map(([lng, lat]) => {
                      const px = ((lng - 95) / 47) * 920 + 40;
                      const py = ((6.5 - lat) / 19) * 440 + 40;
                      return `${px.toFixed(1)},${py.toFixed(1)}`;
                    })
                    .join(' ');
                  return (
                    <polygon
                      key={`poly-${i}`}
                      points={pointsStr}
                      fill={isDark ? '#2b2722' : '#eceae4'}
                      stroke={isDark ? '#3a342c' : '#dcd8cf'}
                      strokeWidth={1.1}
                    />
                  );
                })}

              {/* Tectonic Fault Lines */}
              {mapScope === 'indonesia' &&
                showFaultLines &&
                INDONESIAN_FAULT_PATHS.map((fault, idx) => {
                  const pts = fault.coords
                    .map(([lng, lat]) => {
                      const px = ((lng - 95) / 47) * 920 + 40;
                      const py = ((6.5 - lat) / 19) * 440 + 40;
                      return `${px.toFixed(1)},${py.toFixed(1)}`;
                    })
                    .join(' ');
                  return (
                    <polyline
                      key={`fault-${idx}`}
                      points={pts}
                      fill="none"
                      stroke={isDark ? 'rgba(240, 122, 60, 0.35)' : 'rgba(194, 65, 12, 0.25)'}
                      strokeWidth={1.4}
                      strokeDasharray="5 4"
                    />
                  );
                })}

              {/* Geographic Labels matching rone-home.png */}
              {mapScope === 'indonesia' &&
                REFERENCE_LABELS.map((lbl) => {
                  const px = ((lbl.lng - 95) / 47) * 920 + 40;
                  const py = ((6.5 - lbl.lat) / 19) * 440 + 40;
                  if (lbl.kind === 'country') {
                    return (
                      <text
                        key={lbl.label}
                        x={px}
                        y={py}
                        textAnchor="middle"
                        fill={isDark ? '#8a8174' : '#7a756c'}
                        className="text-[13px] font-semibold tracking-[0.25em] pointer-events-none select-none"
                      >
                        {lbl.label}
                      </text>
                    );
                  }
                  if (lbl.kind === 'sea') {
                    return (
                      <text
                        key={lbl.label}
                        x={px}
                        y={py}
                        textAnchor="middle"
                        fill={isDark ? '#625849' : '#9c968d'}
                        className="text-[10px] italic pointer-events-none select-none"
                      >
                        {lbl.label}
                      </text>
                    );
                  }
                  return (
                    <text
                      key={lbl.label}
                      x={px}
                      y={py}
                      textAnchor="middle"
                      fill={isDark ? '#c4baaa' : '#4a453d'}
                      className="text-[11px] font-medium pointer-events-none select-none"
                    >
                      {lbl.label}
                    </text>
                  );
                })}

              {/* Earthquake Epicenter Dots */}
              {projectedMarkers.map(({ event: ev, x, y }) => {
                const isSelected = activeFocusEvent?.id === ev.id;
                const colorHex = getRoneMarkerHex(ev.magnitude);
                const baseRadius = Math.max(4.5, Math.min(13, (ev.magnitude - 2.0) * 2.2));

                return (
                  <g
                    key={ev.id}
                    transform={`translate(${x}, ${y})`}
                    onClick={() => onSelectEvent(ev)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectEvent(ev);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Pilih gempa M ${formatCommaNumber(ev.magnitude, 1)} di ${ev.region}, kedalaman ${ev.depthKm} km`}
                    className="cursor-pointer focus:outline-none"
                  >
                    {isSelected && (
                      <>
                        <circle
                          cx={0}
                          cy={0}
                          r={baseRadius + 16}
                          fill={colorHex}
                          fillOpacity={0.18}
                        />
                        <circle
                          cx={0}
                          cy={0}
                          r={baseRadius + 8}
                          fill="none"
                          stroke={colorHex}
                          strokeOpacity={0.55}
                          strokeWidth={2}
                        />
                      </>
                    )}
                    <circle
                      cx={0}
                      cy={0}
                      r={isSelected ? baseRadius + 1.5 : baseRadius}
                      fill={colorHex}
                      fillOpacity={isSelected ? 0.96 : 0.78}
                      stroke={isDark ? '#23201c' : '#ffffff'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />
                  </g>
                );
              })}

              {/* Floating Dark Pill Callout above Selected Event ("Terbaru · M4,9") matching rone-home.png */}
              {activeProjected && activeFocusEvent && (
                <g
                  transform={`translate(${activeProjected.x}, ${Math.max(
                    38,
                    activeProjected.y - 24
                  )})`}
                  className="pointer-events-none"
                >
                  <rect
                    x={-58}
                    y={-22}
                    width={116}
                    height={24}
                    rx={12}
                    fill={isDark ? '#efe8dc' : '#2a241d'}
                  />
                  <polygon
                    points="-5,2 5,2 0,7"
                    fill={isDark ? '#efe8dc' : '#2a241d'}
                  />
                  <text
                    x={0}
                    y={-6}
                    textAnchor="middle"
                    fill={isDark ? '#23201c' : '#e7e1d8'}
                    className="text-[11px] font-bold"
                  >
                    Terbaru · M{formatCommaNumber(activeFocusEvent.magnitude, 1)}
                  </text>
                </g>
              )}
            </g>
          </svg>

          {/* Bottom-Right Map Attribution matching rone-home.png */}
          <div className="absolute bottom-1.5 right-2 z-10 px-2 py-0.5 rounded text-[10px] text-[var(--ink-3)] bg-[var(--clay)]/85">
            Data © BMKG · Gempa API (gempa.rone.dev) &amp; OpenStreetMap contributors
          </div>
        </div>
      ) : (
        /* Accessible Keyboard Table Alternative */
        <div className="well overflow-x-auto max-h-[520px]">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--rule)]">
            <span className="text-xs font-bold text-[var(--ink)]">
              Tabel Episenter Aksesibel ({events.length} Kejadian)
            </span>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className="btn btn--sm"
            >
              <Globe2 className="w-3.5 h-3.5" /> Kembali ke Peta
            </button>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead className="text-[var(--ink-3)] font-mono border-b border-[var(--rule)]">
              <tr>
                <th className="py-2 px-2">Magnitudo</th>
                <th className="py-2 px-2">Kedalaman</th>
                <th className="py-2 px-2">Wilayah</th>
                <th className="py-2 px-2">Koordinat</th>
                <th className="py-2 px-2">Waktu (WIB)</th>
                <th className="py-2 px-2 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] font-mono tabular-nums">
              {events.map((ev) => {
                const isSelected = activeFocusEvent?.id === ev.id;
                const magSpec = getMagnitudeSpec(ev.magnitudeClass);
                const depthSpec = getDepthSpec(ev.depthCategory);
                return (
                  <tr
                    key={ev.id}
                    onClick={() => onSelectEvent(ev)}
                    className={`cursor-pointer ${
                      isSelected ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--clay)]/60'
                    }`}
                  >
                    <td className="py-2 px-2 font-bold text-[var(--ink)] whitespace-nowrap">
                      M {formatCommaNumber(ev.magnitude, 1)} ({magSpec.labelId})
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap text-[var(--ink-2)]">
                      {ev.depthKm.toFixed(0)} km [{depthSpec.shortCode}]
                    </td>
                    <td className="py-2 px-2 font-sans text-[var(--ink)]">{ev.region}</td>
                    <td className="py-2 px-2 whitespace-nowrap text-[var(--ink-3)]">
                      {ev.coordinatesText}
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap text-[var(--ink-3)]">
                      {ev.formattedTimeWib}
                    </td>
                    <td className="py-2 px-2 text-right whitespace-nowrap font-sans">
                      <Link
                        href={`/earthquakes/${encodeURIComponent(ev.id)}`}
                        className="font-bold text-[var(--accent-ink)]"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Magnitude Legend matching gempa.rone.dev */}
      <div className="legend" aria-label="Legenda magnitudo">
        <span className="font-semibold text-[var(--ink-2)]">Magnitudo</span>
        {[
          { label: '<3', color: 'var(--m-0)' },
          { label: '3', color: 'var(--m-3)' },
          { label: '4', color: 'var(--m-4)' },
          { label: '5', color: 'var(--m-5)' },
          { label: '6', color: 'var(--m-6)' },
          { label: '7+', color: 'var(--m-7)' },
        ].map((item) => (
          <span key={item.label} className="legend__item">
            <span
              className="legend__swatch"
              style={{ '--c': item.color } as React.CSSProperties}
            />
            <span>{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
