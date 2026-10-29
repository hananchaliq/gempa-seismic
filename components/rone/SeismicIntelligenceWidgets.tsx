"use client";

import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  fmtClockWib,
  fmtCoords,
  fmtDateTime,
  fmtDepth,
  fmtMag,
  fmtNumber,
  fmtRelative,
  magBucket,
  magCategory,
  RoneEarthquake,
  RoneRealtimeEvent,
} from "@/lib/rone/format";
import { MagBadge } from "./RoneIcons";

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface UserReferencePoint {
  id: string;
  label: string;
  lat: number;
  lon: number;
  isGps?: boolean;
}

export const INDONESIA_REFERENCE_CITIES: UserReferencePoint[] = [
  { id: "jakarta", label: "Jakarta", lat: -6.2088, lon: 106.8456 },
  { id: "bandung", label: "Bandung", lat: -6.9175, lon: 107.6191 },
  { id: "yogyakarta", label: "Yogyakarta", lat: -7.7956, lon: 110.3695 },
  { id: "semarang", label: "Semarang", lat: -6.9667, lon: 110.4167 },
  { id: "surabaya", label: "Surabaya", lat: -7.2575, lon: 112.7521 },
  { id: "denpasar", label: "Denpasar", lat: -8.6705, lon: 115.2126 },
  { id: "mataram", label: "Mataram", lat: -8.5833, lon: 116.1167 },
  { id: "kupang", label: "Kupang", lat: -10.1772, lon: 123.607 },
  { id: "medan", label: "Medan", lat: 3.5952, lon: 98.6722 },
  { id: "padang", label: "Padang", lat: -0.9471, lon: 100.4172 },
  { id: "bengkulu", label: "Bengkulu", lat: -3.7928, lon: 102.2608 },
  { id: "palembang", label: "Palembang", lat: -2.9761, lon: 104.7754 },
  { id: "makassar", label: "Makassar", lat: -5.1477, lon: 119.4327 },
  { id: "palu", label: "Palu", lat: -0.8917, lon: 119.8707 },
  { id: "manado", label: "Manado", lat: 1.4748, lon: 124.8421 },
  { id: "ambon", label: "Ambon", lat: -3.6954, lon: 128.1814 },
  { id: "ternate", label: "Ternate", lat: 0.7893, lon: 127.3772 },
  { id: "jayapura", label: "Jayapura", lat: -2.5337, lon: 140.7181 },
];

export type InspectableQuake = (RoneRealtimeEvent | RoneEarthquake) & {
  felt?: string | null;
  potential?: string | null;
  tsunami_potential?: boolean;
};

/**
 * Synthesizes a clean, non-startling scientific dual-tone chime via Web Audio API.
 */
export function playSeismicAlertChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number, gainPeak: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(gainPeak, now + startOffset + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    playTone(523.25, 0, 0.22, 0.14);
    playTone(783.99, 0.16, 0.34, 0.16);
  } catch {
    // Ignore audio context restrictions if blocked
  }
}

export function depthCategoryLabel(depthKm: number): {
  tier: "Dangkal" | "Menengah" | "Dalam";
  desc: string;
} {
  if (depthKm < 60) {
    return {
      tier: "Dangkal",
      desc: "Kerak bumi & sesar aktif (<60 km) — guncangan permukaan lebih terasa",
    };
  }
  if (depthKm <= 300) {
    return {
      tier: "Menengah",
      desc: "Zona subduksi litosfer (60–300 km) — redaman energi moderat",
    };
  }
  return {
    tier: "Dalam",
    desc: "Zona transisi mantel (>300 km) — dirasakan luas namun minim kerusakan",
  };
}

export function estimateFeelAtDistance(
  mag: number,
  depthKm: number,
  hypoDistKm: number
): string {
  const effectiveRadius = Math.pow(10, 0.48 * mag - 0.75);
  if (hypoDistKm <= effectiveRadius * 0.25 && mag >= 4.5) {
    return "Getaran sedang–kuat (IV–V MMI)";
  }
  if (hypoDistKm <= effectiveRadius * 0.65 && mag >= 3.5) {
    return "Getaran ringan (II–III MMI)";
  }
  if (hypoDistKm <= effectiveRadius * 1.15) {
    return "Getaran sangat lemah (I–II MMI)";
  }
  return "Terdeteksi instrumen seismograf";
}

export function EpicenterDistanceBar({
  quake,
  userPoint,
  gpsLoading,
  refreshCycle = 0,
  onSelectCity,
  onRequestGps,
}: {
  quake: InspectableQuake | null;
  userPoint: UserReferencePoint;
  gpsLoading: boolean;
  refreshCycle?: number;
  onSelectCity: (city: UserReferencePoint) => void;
  onRequestGps: () => void;
}) {
  const metrics = useMemo(() => {
    if (!quake) return null;
    const surfaceKm = haversineKm(
      userPoint.lat,
      userPoint.lon,
      quake.latitude,
      quake.longitude
    );
    const hypoKm = Math.sqrt(surfaceKm * surfaceKm + quake.depth_km * quake.depth_km);
    const pWaveSec = Math.max(1, Math.round(hypoKm / 6.2));
    const sWaveSec = Math.max(2, Math.round(hypoKm / 3.6));
    const deltaPS = Math.max(1, sWaveSec - pWaveSec);
    const feelEstimate = estimateFeelAtDistance(
      quake.magnitude,
      quake.depth_km,
      hypoKm
    );

    return {
      surfaceKm: Math.round(surfaceKm),
      hypoKm: Math.round(hypoKm),
      pWaveSec,
      sWaveSec,
      deltaPS,
      feelEstimate,
    };
  }, [quake, userPoint]);

  if (!quake || !metrics) return null;

  const formatCompactSec = (s: number) => {
    if (s < 60) return `${s}d`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}m ${rem}d` : `${m}m`;
  };

  return (
    <motion.div
      key={`calc-${quake.event_id}-${refreshCycle}`}
      initial={refreshCycle > 0 ? { opacity: 0.78, scale: 0.99 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="seismic-calc"
      aria-label="Kalkulator jarak episenter dan gelombang"
    >
      <div className="seismic-calc__top">
        <div className="seismic-calc__title">
          <span className="seismic-calc__kicker">Estimasi Jarak &amp; Gelombang</span>
          <span className="seismic-calc__feel">{metrics.feelEstimate}</span>
        </div>
        <div className="seismic-calc__controls">
          <label className="seismic-select-wrap">
            <span className="visually-hidden">Pilih kota referensi</span>
            <select
              aria-label="Pilih kota referensi"
              value={userPoint.isGps ? "gps" : userPoint.id}
              onChange={(e) => {
                const found = INDONESIA_REFERENCE_CITIES.find(
                  (c) => c.id === e.target.value
                );
                if (found) onSelectCity(found);
              }}
            >
              {userPoint.isGps ? (
                <option value="gps">GPS ({userPoint.label})</option>
              ) : null}
              {INDONESIA_REFERENCE_CITIES.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="seismic-gps-btn"
            onClick={onRequestGps}
            disabled={gpsLoading}
            title="Hitung jarak dari koordinat GPS perangkat Anda"
          >
            {gpsLoading ? "…" : "GPS"}
          </button>
        </div>
      </div>

      <div className="seismic-calc__grid">
        <div className="seismic-calc__cell">
          <span className="seismic-calc__label">Jarak</span>
          <strong className="seismic-calc__val mono">
            {fmtNumber(metrics.surfaceKm)} <small>km</small>
          </strong>
        </div>
        <div className="seismic-calc__cell">
          <span className="seismic-calc__label">Gelombang P / S</span>
          <strong className="seismic-calc__val mono">
            {`${formatCompactSec(metrics.pWaveSec)} / ${formatCompactSec(metrics.sWaveSec)}`}
          </strong>
        </div>
        <div className="seismic-calc__cell">
          <span className="seismic-calc__label">Selisih S–P</span>
          <strong className="seismic-calc__val mono">
            {`+${formatCompactSec(metrics.deltaPS)}`}
          </strong>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Reference Image Top-Left Motif: Horizontal Staggered Capsule Timeline
 * Uses 5 clean, breathable capsules with solid full-color category magnitude badges.
 */
export function SeismicCapsuleTimeline({
  events,
  activeId,
  onSelect,
}: {
  events: RoneRealtimeEvent[];
  activeId?: string;
  onSelect: (ev: RoneRealtimeEvent) => void;
}) {
  const items = events.slice(0, 4);
  if (!items.length) return null;

  const offsets = [0, 6, 12, 4];

  return (
    <div className="capsule-timeline" aria-label="Kronologi deteksi terbaru">
      <div className="capsule-timeline__rows">
        {items.map((ev, idx) => {
          const timeLabel = fmtClockWib(new Date(ev.origin_time)).replace(".", ":");
          const isSelected = ev.event_id === activeId;
          const bucket = magBucket(ev.magnitude);
          const isHigh = ev.magnitude >= 5.0;
          const tone = isHigh
            ? "obsidian"
            : ev.magnitude >= 3.5
              ? "charcoal"
              : idx === 3 || idx === 4
                ? "ivory"
                : "obsidian";
          const offsetLeft = offsets[idx % offsets.length];

          return (
            <div
              key={ev.event_id}
              className="capsule-timeline__row"
            >
              <span className="capsule-timeline__time mono">{timeLabel}</span>
              <div className="capsule-timeline__track">
                <button
                  type="button"
                  className={`capsule-bar capsule-bar--${tone}${
                    isSelected ? " is-selected" : ""
                  }${isHigh ? " is-high-mag" : ""}`}
                  style={{ marginLeft: `${offsetLeft}%` }}
                  onClick={() => onSelect(ev)}
                  title={`M ${fmtMag(ev.magnitude)} · ${ev.region} (${fmtDepth(
                    ev.depth_km
                  )})`}
                >
                  <span className="capsule-bar__label">{ev.region}</span>
                  <MagBadge magnitude={ev.magnitude} size="sm" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="capsule-timeline__legend">
        <span>
          <i className="dot" style={{ background: "var(--m-5)" }} /> M 5,0+ Tinggi
        </span>
        <span>
          <i className="dot" style={{ background: "var(--m-4)" }} /> M 4,0–4,9
        </span>
        <span>
          <i className="dot" style={{ background: "var(--m-3)" }} /> M &lt; 4,0
        </span>
      </div>
    </div>
  );
}

/**
 * Reference Image Top-Center Motif ("Kurva Magnitudo")
 * Categorizes frequency by Magnitude tiers (distinguishing high M 5,0+ events)
 * and colors spline nodes using the 6-tier Magnitude palette.
 */
export function SeismicMagnitudeSplineCard({
  events,
  activeQuake,
  refreshCycle,
  onSelectQuake,
}: {
  events: RoneRealtimeEvent[];
  activeQuake: InspectableQuake | null;
  refreshCycle: number;
  onSelectQuake: (ev: RoneRealtimeEvent) => void;
}) {
  const [windowSize, setWindowSize] = useState<12 | 20 | 32>(20);

  const series = useMemo(() => {
    return events.slice(0, windowSize).reverse();
  }, [events, windowSize]);

  const magCategoryBreakdown = useMemo(() => {
    const total = Math.max(1, events.length);
    const highList = events.filter((e) => e.magnitude >= 5.0);
    const midList = events.filter((e) => e.magnitude >= 4.0 && e.magnitude < 5.0);
    const lowList = events.filter((e) => e.magnitude < 4.0);

    return [
      {
        key: "high",
        label: "M 5,0+ (Kuat)",
        bucket: "5" as const,
        count: highList.length,
        pct: Math.round((highList.length / total) * 100),
      },
      {
        key: "mid",
        label: "M 4,0–4,9 (Sedang)",
        bucket: "4" as const,
        count: midList.length,
        pct: Math.round((midList.length / total) * 100),
      },
      {
        key: "low",
        label: "M < 4,0 (Ringan)",
        bucket: "3" as const,
        count: lowList.length,
        pct: Math.max(
          0,
          100 -
            Math.round((highList.length / total) * 100) -
            Math.round((midList.length / total) * 100)
        ),
      },
    ];
  }, [events]);

  if (series.length < 3) return null;

  const width = 340;
  const height = 118;
  const padL = 10;
  const padR = 10;
  const padT = 18;
  const padB = 14;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const minMag = 1.5;
  const maxMag = Math.max(6.2, ...series.map((e) => e.magnitude + 0.4));

  const points = series.map((ev, idx) => {
    const x = Number(
      (padL + (idx / Math.max(1, series.length - 1)) * plotW).toFixed(1)
    );
    const ratio = Math.max(0, Math.min(1, (ev.magnitude - minMag) / (maxMag - minMag)));
    const y = Number((padT + (1 - ratio) * plotH).toFixed(1));
    const depthRatio = Math.max(0, Math.min(1, ev.depth_km / 220));
    const y2 = Number((padT + (0.25 + depthRatio * 0.65) * plotH).toFixed(1));
    return { x, y, y2, ev, bucket: magBucket(ev.magnitude) };
  });

  const buildSmoothPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx = Number(((p0.x + p1.x) / 2).toFixed(1));
      d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const primaryWave = buildSmoothPath(points.map((p) => ({ x: p.x, y: p.y })));
  const secondaryWave = buildSmoothPath(points.map((p) => ({ x: p.x, y: p.y2 })));

  const activePt =
    points.find((p) => p.ev.event_id === activeQuake?.event_id) ||
    points.reduce(
      (best, cur) => (cur.ev.magnitude >= best.ev.magnitude ? cur : best),
      points[0]
    );

  const avgMag =
    series.reduce((acc, cur) => acc + cur.magnitude, 0) / Math.max(1, series.length);

  return (
    <motion.div
      key={`spline-${refreshCycle}-${windowSize}`}
      initial={refreshCycle > 0 ? { opacity: 0.84, y: 4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className="spline-widget"
    >
      <div className="spline-widget__head">
        <span className="spline-widget__eyebrow">Frekuensi Magnitudo</span>
        <div
          className="spline-widget__tabs"
          role="group"
          aria-label="Rentang sampel kurva"
        >
          {([12, 20, 32] as const).map((cnt) => (
            <button
              key={cnt}
              type="button"
              className={`spline-tab${windowSize === cnt ? " is-active" : ""}`}
              onClick={() => setWindowSize(cnt)}
            >
              {cnt}
            </button>
          ))}
        </div>
      </div>

      <div className="spline-widget__hero-val">
        <div className="spline-widget__hero-row">
          <MagBadge magnitude={activePt.ev.magnitude} />
          <div className="spline-widget__hero-copy">
            <strong className="spline-widget__big mono">
              M {fmtMag(activePt.ev.magnitude)}
            </strong>
            <span className="spline-widget__cat">
              Kategori {magCategory(activePt.ev.magnitude)}
            </span>
          </div>
        </div>
        <span className="spline-widget__sub">
          Rerata sampel M {fmtMag(avgMag)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="spline-widget__svg"
        role="img"
        aria-label="Kurva tren magnitudo deteksi sensor real-time"
      >
        <path
          d={secondaryWave}
          fill="none"
          stroke="var(--ink-3)"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <motion.path
          d={primaryWave}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.4"
          strokeLinecap="round"
          initial={refreshCycle > 0 ? { pathLength: 0.25, opacity: 0.5 } : false}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        />

        {points.map((pt) => {
          const isCurrent = pt.ev.event_id === activePt.ev.event_id;
          const isHigh = pt.ev.magnitude >= 5.0;
          return (
            <g
              key={pt.ev.event_id}
              onClick={() => onSelectQuake(pt.ev)}
              style={{ cursor: "pointer" }}
            >
              <title>{`M ${fmtMag(pt.ev.magnitude)} · ${pt.ev.region} (${fmtDepth(
                pt.ev.depth_km
              )})`}</title>
              {isCurrent || isHigh ? (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isCurrent ? "9" : "7"}
                  fill={`var(--m-${pt.bucket})`}
                  fillOpacity="0.24"
                  className="spline-pulse-ring"
                />
              ) : null}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isCurrent ? "5" : isHigh ? "4" : "2.8"}
                fill={`var(--m-${pt.bucket})`}
                stroke="var(--bg-card)"
                strokeWidth="1.5"
              />
            </g>
          );
        })}
      </svg>

      <ul className="spline-widget__breakdown" aria-label="Kategori frekuensi magnitudo">
        {magCategoryBreakdown.map((item) => (
          <li key={item.key} className="spline-widget__row">
            <span className="spline-widget__row-label">
              <i
                className="dot"
                style={{ background: `var(--m-${item.bucket})` }}
              />
              {item.label}
            </span>
            <span
              className="mag mag--sm"
              data-m={item.bucket}
            >
              <span className="mag__num">
                {item.count} ({item.pct}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

/**
 * Priority Quakes Spotlight inside the Obsidian Right Column Card
 * Clean, uncluttered cards with solid full-color magnitude category badges.
 */
export function StackedQuickQuakesDeck({
  realtimeTop,
  feltTop,
  significantTop,
  activeId,
  refreshCycle,
  onPickRealtime,
  onPickFelt,
  onPickSignificant,
  onOpenDetail,
}: {
  realtimeTop: RoneRealtimeEvent | null;
  feltTop: RoneEarthquake | null;
  significantTop: RoneEarthquake | null;
  activeId?: string;
  refreshCycle: number;
  onPickRealtime: (ev: RoneRealtimeEvent) => void;
  onPickFelt: (ev: RoneEarthquake) => void;
  onPickSignificant: (ev: RoneEarthquake) => void;
  onOpenDetail: () => void;
}) {
  const cards = [
    realtimeTop
      ? {
          id: `rt-${realtimeTop.event_id}`,
          eventId: realtimeTop.event_id,
          badge: "REALTIME",
          title: realtimeTop.region,
          mag: realtimeTop.magnitude,
          depth: realtimeTop.depth_km,
          time: realtimeTop.origin_time,
          onClick: () => onPickRealtime(realtimeTop),
        }
      : null,
    feltTop
      ? {
          id: `felt-${feltTop.event_id}`,
          eventId: feltTop.event_id,
          badge: "DIRASAKAN",
          title: feltTop.region,
          mag: feltTop.magnitude,
          depth: feltTop.depth_km,
          time: feltTop.origin_time,
          onClick: () => onPickFelt(feltTop),
        }
      : null,
    significantTop
      ? {
          id: `sig-${significantTop.event_id}`,
          eventId: significantTop.event_id,
          badge: "M 5+",
          title: significantTop.region,
          mag: significantTop.magnitude,
          depth: significantTop.depth_km,
          time: significantTop.origin_time,
          onClick: () => onPickSignificant(significantTop),
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string;
    eventId: string;
    badge: string;
    title: string;
    mag: number;
    depth: number;
    time: string;
    onClick: () => void;
  }>;

  if (!cards.length) return null;

  return (
    <motion.div
      key={`deck-${refreshCycle}`}
      initial={refreshCycle > 0 ? { opacity: 0.85, y: 4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className="quake-deck"
      aria-label="Kartu pantauan cepat gempa utama"
    >
      <div className="quake-deck__head">
        <span className="quake-deck__title">Kanal Prioritas</span>
        <span className="quake-deck__pill">BMKG</span>
      </div>

      <div className="quake-deck__stack">
        {cards.map((c, idx) => {
          const isCurrent = c.eventId === activeId || (idx === 0 && !activeId);
          return (
            <button
              key={c.id}
              type="button"
              className={`quake-deck__card quake-deck__card--${idx}${
                isCurrent ? " is-active" : ""
              }`}
              onClick={c.onClick}
            >
              <div className="quake-deck__row2">
                <div className="quake-deck__info">
                  <span className="quake-deck__badge">
                    {c.badge} · {fmtDepth(c.depth)}
                  </span>
                  <span className="quake-deck__region">{c.title}</span>
                </div>
                <MagBadge magnitude={c.mag} size="sm" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="quake-deck__actions">
        <button
          type="button"
          className="quake-deck__btn quake-deck__btn--secondary"
          onClick={() => cards[0]?.onClick()}
        >
          ↙ Fokus Realtime
        </button>
        <button
          type="button"
          className="quake-deck__btn quake-deck__btn--primary"
          onClick={onOpenDetail}
        >
          ↗ Detail Gempa
        </button>
      </div>
    </motion.div>
  );
}

export function HypocenterDepthCrossSection({
  activeQuake,
  recentQuakes,
  nowMs,
  refreshCycle = 0,
  onSelectQuake,
  onOpenDetail,
}: {
  activeQuake: InspectableQuake | null;
  recentQuakes: RoneRealtimeEvent[];
  nowMs: number;
  refreshCycle?: number;
  onSelectQuake: (ev: RoneRealtimeEvent) => void;
  onOpenDetail: (ev: InspectableQuake) => void;
}) {
  const target = activeQuake || recentQuakes[0] || null;

  const profilePoints = useMemo(() => {
    return recentQuakes.slice(0, 36);
  }, [recentQuakes]);

  if (!target) return null;

  const maxDepthInSample = Math.max(
    target.depth_km,
    ...profilePoints.map((q) => q.depth_km),
    120
  );
  const maxDepthScale =
    maxDepthInSample <= 100 ? 120 : maxDepthInSample <= 300 ? 320 : 650;

  const lonToX = (lon: number) => {
    const clamped = Math.max(94, Math.min(142, lon));
    return Number((48 + ((clamped - 94) / (142 - 94)) * 532).toFixed(1));
  };

  const depthToY = (depth: number) => {
    const clamped = Math.max(0, Math.min(maxDepthScale, depth));
    return Number((40 + (clamped / maxDepthScale) * 168).toFixed(1));
  };

  const targetX = lonToX(target.longitude);
  const targetY = depthToY(target.depth_km);
  const shallowBoundaryY = depthToY(Math.min(60, maxDepthScale));
  const interBoundaryY = depthToY(Math.min(300, maxDepthScale));
  const depthInfo = depthCategoryLabel(target.depth_km);
  const hypoLabelY = Number(
    (targetY < 58 ? targetY + 18 : targetY + 4).toFixed(1)
  );
  const targetBucket = magBucket(target.magnitude);

  return (
    <motion.section
      key={`depth-sec-${refreshCycle}`}
      initial={refreshCycle > 0 ? { opacity: 0.85, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className="card bento__depth"
      aria-labelledby="depth-cross-heading"
    >
      <div className="card__head">
        <div>
          <h2 id="depth-cross-heading">Penampang Kedalaman Hiposenter</h2>
          <p className="hint">
            Proyeksi Episenter (0 km) ke Hiposenter ({fmtDepth(target.depth_km)})
          </p>
        </div>
        <span className="pill">{`${depthInfo.tier} · ${fmtDepth(target.depth_km)}`}</span>
      </div>

      <div className="depth-stage">
        <svg
          viewBox="0 0 600 236"
          className="depth-svg"
          role="img"
          aria-label={`Diagram penampang kedalaman gempa ${target.region} pada kedalaman ${target.depth_km} km`}
        >
          <defs>
            <linearGradient id="crustGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--ink)" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="slabGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--ink-3)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--ink-3)" stopOpacity="0.03" />
            </linearGradient>
          </defs>

          <rect
            x="48"
            y="40"
            width="532"
            height={Math.max(12, Number((shallowBoundaryY - 40).toFixed(1)))}
            fill="url(#crustGrad)"
            rx="4"
          />
          {maxDepthScale > 60 ? (
            <rect
              x="48"
              y={shallowBoundaryY}
              width="532"
              height={Math.max(
                10,
                Number((interBoundaryY - shallowBoundaryY).toFixed(1))
              )}
              fill="url(#slabGrad)"
            />
          ) : null}

          <path
            d={`M 68 42 Q 240 ${depthToY(
              Math.min(110, maxDepthScale * 0.65)
            )} 475 ${depthToY(maxDepthScale * 0.92)}`}
            fill="none"
            stroke="var(--ink-3)"
            strokeWidth="10"
            strokeOpacity="0.15"
            strokeLinecap="round"
          />

          {[
            0,
            Math.round(maxDepthScale * 0.25),
            Math.round(maxDepthScale * 0.5),
            Math.round(maxDepthScale * 0.75),
            maxDepthScale,
          ].map((d) => {
            const y = depthToY(d);
            return (
              <g key={d}>
                <line
                  x1="48"
                  y1={y}
                  x2="580"
                  y2={y}
                  stroke="var(--rule)"
                  strokeDasharray={d === 0 ? undefined : "3 3"}
                  strokeWidth={d === 0 ? "1.5" : "1"}
                />
                <text
                  x="42"
                  y={Number((y + 3.5).toFixed(1))}
                  textAnchor="end"
                  className="depth-svg__axis mono"
                >
                  {`${d} km`}
                </text>
              </g>
            );
          })}

          {[
            { lon: 98, label: "Sumatera" },
            { lon: 108, label: "Jawa" },
            { lon: 117, label: "Bali–NTB" },
            { lon: 126, label: "NTT–Sulawesi" },
            { lon: 137, label: "Maluku–Papua" },
          ].map((reg) => {
            const x = lonToX(reg.lon);
            return (
              <text
                key={reg.label}
                x={x}
                y="16"
                textAnchor="middle"
                className="depth-svg__region"
              >
                {reg.label}
              </text>
            );
          })}

          <text
            x="574"
            y={Math.min(Number((shallowBoundaryY - 4).toFixed(1)), 56)}
            textAnchor="end"
            className="depth-svg__zone"
          >
            {"Dangkal (<60 km)"}
          </text>
          {maxDepthScale > 90 ? (
            <text
              x="574"
              y={Math.min(Number((interBoundaryY - 6).toFixed(1)), 136)}
              textAnchor="end"
              className="depth-svg__zone"
            >
              {"Menengah (60–300 km)"}
            </text>
          ) : null}

          {profilePoints.map((pt) => {
            const cx = lonToX(pt.longitude);
            const cy = depthToY(pt.depth_km);
            const isSelected = pt.event_id === target.event_id;
            const r = Number(
              Math.max(3.8, Math.min(9.5, (pt.magnitude - 1.5) * 2.1)).toFixed(1)
            );
            const bucket = magBucket(pt.magnitude);
            return (
              <g
                key={pt.event_id}
                className="depth-svg__point"
                onClick={() => onSelectQuake(pt)}
                style={{ cursor: "pointer" }}
              >
                <title>{`M ${fmtMag(pt.magnitude)} · ${pt.region} · ${fmtDepth(
                  pt.depth_km
                )}`}</title>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? Number((r + 3).toFixed(1)) : r}
                  fill={`var(--m-${bucket})`}
                  fillOpacity={isSelected ? 1 : 0.8}
                  stroke="var(--clay)"
                  strokeWidth={isSelected ? "2" : "1"}
                />
              </g>
            );
          })}

          <line
            x1={targetX}
            y1="40"
            x2={targetX}
            y2={targetY}
            stroke="var(--ink)"
            strokeWidth="1.75"
            strokeDasharray="3 3"
          />

          <circle
            cx={targetX}
            cy="40"
            r="4.5"
            fill="var(--clay)"
            stroke="var(--ink)"
            strokeWidth="2.5"
          />
          <text
            x={Math.min(535, Math.max(65, targetX))}
            y="31"
            textAnchor="middle"
            className="depth-svg__callout"
          >
            {"Episenter"}
          </text>

          <circle
            cx={targetX}
            cy={targetY}
            r="14"
            fill="none"
            stroke={`var(--m-${targetBucket})`}
            strokeWidth="1.6"
            strokeOpacity="0.65"
            className="depth-svg__wave"
          />
          <circle
            cx={targetX}
            cy={targetY}
            r="6.5"
            fill={`var(--m-${targetBucket})`}
            stroke="var(--clay)"
            strokeWidth="2"
          />
          <text
            x={targetX > 420 ? Number((targetX - 11).toFixed(1)) : Number((targetX + 11).toFixed(1))}
            y={hypoLabelY}
            textAnchor={targetX > 420 ? "end" : "start"}
            className="depth-svg__hypo mono"
          >
            {`M ${fmtMag(target.magnitude)} (${fmtDepth(target.depth_km)})`}
          </text>
        </svg>
      </div>

      <div className="depth-footer">
        <div className="depth-footer__active">
          <MagBadge magnitude={target.magnitude} />
          <strong>{target.region}</strong>
          <span className="muted xsmall">
            {fmtDateTime(target.origin_time)} · {fmtRelative(target.origin_time, nowMs)}
          </span>
          <button
            type="button"
            className="link-arrow xsmall"
            style={{ marginLeft: "auto" }}
            onClick={() => onOpenDetail(target)}
          >
            Detail →
          </button>
        </div>
      </div>
    </motion.section>
  );
}
