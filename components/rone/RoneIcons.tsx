"use client";

import React from "react";
import {
  fmtDateTime,
  fmtDepth,
  fmtMag,
  fmtRelative,
  magBucket,
  magCategory,
} from "@/lib/rone/format";

function useAnimatedMagnitude(target: number): string {
  return fmtMag(target);
}

export const ICON_PATHS: Record<string, string> = {
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  "arrow-left": "M19 12H5M11 6l-6 6 6 6",
  "arrow-up-right": "M7 17 17 7M9 7h8v8",
  "chevron-down": "m6 9 6 6 6-6",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  layers: "m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5",
  check: "m5 12 5 5 9-10",
  "chevron-left": "m15 6-6 6 6 6",
  "chevron-right": "m9 6 6 6-6 6",
  "zoom-in": "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-3.5-3.5M11 8v6M8 11h6",
  "zoom-out": "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-3.5-3.5M8 11h6",
  expand: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7",
  share: "M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-3.5-3.5",
  wave: "M2 16c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M2 20c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M6 11c0-3.5 3-6 6.5-6 1.5 0 3 .5 4 1.5",
  pulse: "M2 12h4l2-6 4 12 3-9 2 3h5",
  code: "m8 7-5 5 5 5M16 7l5 5-5 5",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4",
  home: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  table: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm0 5h18M9 10v11",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  compass: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm4.24-14.24-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-14v4m0 4h.01",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a1.94 1.94 0 0 0 3.4 0",
  refresh: "M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8m0-5v5h5m-5 4a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16m-5 5h5v-5",
  pin: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
};

export function RoneIcon({
  name,
  className = "icon",
}: {
  name: keyof typeof ICON_PATHS;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name] || ""} />
    </svg>
  );
}

export function iconHTML(name: keyof typeof ICON_PATHS, cls = "icon"): string {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${ICON_PATHS[name] || ""}"/></svg>`;
}

/**
 * Compact Circular Radial Arc Gauge (Matches Reference Image 1: "5,4" inside dark recessed ring)
 * Applied simultaneously across all cards, tables, and lists in all menus.
 */
export function MagBadge({
  magnitude,
  size = "",
  labelOverride,
}: {
  magnitude: number;
  size?: "" | "sm" | "lg";
  labelOverride?: string;
}) {
  const bucket = magBucket(magnitude);
  const category = magCategory(magnitude);
  const isHigh = magnitude >= 5.0;
  const animatedNum = useAnimatedMagnitude(magnitude);
  // 270-degree track is 75% of 100 pathLength; scale magnitude [1.5..8.8] across [10..74]
  const arcFill = Number(
    Math.max(10, Math.min(74, ((magnitude - 0.8) / 8.0) * 74)).toFixed(1)
  );

  return (
    <span
      className={`mag-gauge${size ? ` mag-gauge--${size}` : ""}${
        isHigh ? " mag-gauge--high" : ""
      }`}
      data-m={bucket}
      data-high={isHigh ? "true" : "false"}
      style={
        {
          "--v": magnitude,
          "--arc-fill": arcFill,
        } as React.CSSProperties
      }
      title={`Magnitudo M ${fmtMag(magnitude)} (${category})`}
    >
      <span className="mag-gauge__ring">
        <svg viewBox="0 0 100 100" className="mag-gauge__svg" aria-hidden="true">
          {/* Recessed dark 270° groove track */}
          <circle
            className="mag-gauge__track"
            cx="50"
            cy="50"
            r="39"
            pathLength={100}
          />
          {/* Animated sweeping colored arc */}
          <circle
            className="mag-gauge__arc"
            cx="50"
            cy="50"
            r="39"
            pathLength={100}
            style={{ strokeDasharray: `${arcFill} 100` }}
          />
        </svg>
        <span className="mag-gauge__well">
          <span className="visually-hidden">M </span>
          <span className="mag-gauge__num">{animatedNum}</span>
        </span>
      </span>
      {labelOverride ? (
        <span className="mag-gauge__override">{labelOverride}</span>
      ) : null}
    </span>
  );
}

/**
 * Large Circular Radial Arc Gauge (Matches Reference Image 2: "3,4" + Indonesian Seismic Strength Category)
 * Used in Hero Terkini, Realtime Spotlight, and Detail Sheet.
 */
export function MagDial({
  magnitude,
  size = "default",
}: {
  magnitude: number;
  size?: "default" | "xl" | "compact";
}) {
  const bucket = magBucket(magnitude);
  const strengthLabel = magCategory(magnitude);
  const isHigh = magnitude >= 5.0;
  const animatedNum = useAnimatedMagnitude(magnitude);
  const fill = Number(
    Math.max(11, Math.min(74, ((magnitude - 0.8) / 8.0) * 74)).toFixed(1)
  );

  return (
    <div
      className={`dial dial--${size}${isHigh ? " dial--high" : ""}`}
      data-m={bucket}
      data-high={isHigh ? "true" : "false"}
      role="img"
      aria-label={`Magnitudo M ${fmtMag(magnitude)} — Kategori ${strengthLabel}`}
      style={{ "--arc-fill": fill } as React.CSSProperties}
    >
      <svg viewBox="0 0 100 100" className="dial__svg" aria-hidden="true">
        {/* 270° Recessed Dark Groove Track starting at bottom-left (135deg) */}
        <circle
          className="dial__track"
          cx="50"
          cy="50"
          r="40"
          pathLength={100}
        />
        {/* 270° Animated Colored Sweep Arc */}
        <circle
          className="dial__arc"
          cx="50"
          cy="50"
          r="40"
          pathLength={100}
          style={{ strokeDasharray: `${fill} 100` }}
        />
      </svg>
      <span className="dial__well">
        <span className="dial__num">{animatedNum}</span>
        <span className="dial__label">{strengthLabel}</span>
      </span>
    </div>
  );
}

export function MagLegend() {
  return (
    <div className="legend" role="region" aria-label="Legenda kekuatan magnitudo">
      <span>Skala Kekuatan Magnitudo</span>
      <span className="legend__item">
        <span className="legend__swatch" style={{ "--c": "var(--m-0)" } as React.CSSProperties} />
        M &lt;3 · Mikro
      </span>
      <span className="legend__item">
        <span className="legend__swatch" style={{ "--c": "var(--m-3)" } as React.CSSProperties} />
        M 3 · Ringan
      </span>
      <span className="legend__item">
        <span className="legend__swatch" style={{ "--c": "var(--m-4)" } as React.CSSProperties} />
        M 4 · Sedang
      </span>
      <span className="legend__item">
        <span className="legend__swatch" style={{ "--c": "var(--m-5)" } as React.CSSProperties} />
        M 5 · Kuat
      </span>
      <span className="legend__item">
        <span className="legend__swatch" style={{ "--c": "var(--m-6)" } as React.CSSProperties} />
        M 6 · Besar
      </span>
      <span className="legend__item">
        <span className="legend__swatch" style={{ "--c": "var(--m-7)" } as React.CSSProperties} />
        M 7+ · Dahsyat
      </span>
    </div>
  );
}

export function FactsList({
  rows,
  extraClass = "",
}: {
  rows: Array<[string, React.ReactNode]>;
  extraClass?: string;
}) {
  return (
    <dl className={`facts${extraClass ? ` ${extraClass}` : ""}`}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EventListItem({
  event,
  note,
  flag,
  current,
  nowMs,
  onClick,
}: {
  event: {
    event_id: string;
    magnitude: number;
    region: string;
    origin_time: string;
    depth_km: number;
  };
  note?: string | null;
  flag?: string;
  current?: boolean;
  nowMs: number;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        className="event"
        type="button"
        data-id={event.event_id}
        data-m={magBucket(event.magnitude)}
        aria-current={current ? "true" : undefined}
        onClick={onClick}
      >
        <MagBadge magnitude={event.magnitude} />
        <span className="event__body">
          <span className="event__title">{event.region}</span>
          <span className="event__meta">
            <span>{fmtDateTime(event.origin_time)}</span>
            <span>{fmtDepth(event.depth_km)}</span>
          </span>
          {note ? <span className="event__note">{note}</span> : null}
        </span>
        <span className="event__side">
          <time dateTime={event.origin_time}>{fmtRelative(event.origin_time, nowMs)}</time>
          {flag ? <span className="pill pill--signal">{flag}</span> : null}
        </span>
      </button>
    </li>
  );
}
