import React from "react";
import {
  fmtDateTime,
  fmtDepth,
  fmtMag,
  fmtRelative,
  magBucket,
  magCategory,
} from "@/lib/rone/format";

export const ICON_PATHS: Record<string, string> = {
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  "arrow-left": "M19 12H5M11 6l-6 6 6 6",
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
  const text = labelOverride ?? fmtMag(magnitude);
  return (
    <span
      className={`mag${size ? ` mag--${size}` : ""}`}
      data-m={bucket}
      style={{ "--v": magnitude } as React.CSSProperties}
      title={`Magnitudo ${fmtMag(magnitude)}`}
    >
      <span className="mag__num">{text}</span>
    </span>
  );
}

export function MagDial({ magnitude }: { magnitude: number }) {
  const bucket = magBucket(magnitude);
  const fill = Math.min((magnitude / 9) * 75, 75).toFixed(1);
  return (
    <div
      className="dial"
      data-m={bucket}
      role="img"
      aria-label={`Magnitudo ${fmtMag(magnitude)}, ${magCategory(magnitude)}`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="dial__track" cx="50" cy="50" r="46" pathLength={100} />
        <circle
          className="dial__arc"
          cx="50"
          cy="50"
          r="46"
          pathLength={100}
          style={{ strokeDasharray: `${fill} 100` }}
        />
      </svg>
      <span className="dial__value">
        <span className="dial__num">{fmtMag(magnitude)}</span>
        <span className="dial__label">{magCategory(magnitude)}</span>
      </span>
    </div>
  );
}

export function MagLegend() {
  return (
    <div className="legend" aria-label="Legenda magnitudo">
      <span>Magnitudo</span>
      <span className="legend__item">
        <span className="legend__swatch" style={{ "--c": "var(--m-0)" } as React.CSSProperties} />
        &lt;3
      </span>
      <span className="legend__item">
        <span className="legend__swatch" style={{ "--c": "var(--m-3)" } as React.CSSProperties} />
        3
      </span>
      <span className="legend__item">
        <span className="legend__swatch" style={{ "--c": "var(--m-4)" } as React.CSSProperties} />
        4
      </span>
      <span className="legend__item">
        <span className="legend__swatch" style={{ "--c": "var(--m-5)" } as React.CSSProperties} />
        5
      </span>
      <span className="legend__item">
        <span className="legend__swatch" style={{ "--c": "var(--m-6)" } as React.CSSProperties} />
        6
      </span>
      <span className="legend__item">
        <span className="legend__swatch" style={{ "--c": "var(--m-7)" } as React.CSSProperties} />
        7+
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
