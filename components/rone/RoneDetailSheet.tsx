"use client";

import React, { useEffect, useState } from "react";
import {
  distanceKm,
  fmtCoords,
  fmtDateTime,
  fmtDepth,
  fmtLong,
  fmtMag,
  fmtNumber,
  fmtRelative,
  fmtTime,
  parseFelt,
  RoneDamagingEvent,
  RoneEarthquake,
  RoneHistoryRecord,
  RoneRealtimeEvent,
} from "@/lib/rone/format";
import { FactsList, MagBadge, RoneIcon } from "./RoneIcons";

export type DetailTarget =
  | { kind: "felt"; data: RoneEarthquake }
  | { kind: "realtime"; data: RoneRealtimeEvent }
  | { kind: "damaging"; data: RoneDamagingEvent };

export interface MediaItem {
  label: string;
  caption: string;
  src: string;
}

export function resolveMediaUrl(src?: string | null): string | null {
  if (!src || typeof src !== "string") return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return `https://gempa.rone.dev${trimmed}`;
  }
  return `https://gempa.rone.dev/${trimmed}`;
}

function SeismicMediaFallback({
  label,
  caption,
  compact = false,
}: {
  label: string;
  caption?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span className="viewer__tab-fallback" aria-hidden="true">
        <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
          <rect width="36" height="36" rx="8" fill="#0B2B26" />
          <circle cx="18" cy="18" r="12" stroke="#8EB69B" strokeOpacity="0.28" strokeDasharray="2 2" />
          <circle cx="18" cy="18" r="7" stroke="#E87A3E" strokeOpacity="0.55" />
          <circle cx="18" cy="18" r="2.8" fill="#E87A3E" />
        </svg>
      </span>
    );
  }

  return (
    <div className="viewer__fallback" role="img" aria-label={caption || label}>
      <svg
        viewBox="0 0 640 360"
        className="viewer__fallback-svg"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="seismicGlow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#E87A3E" stopOpacity="0.28" />
            <stop offset="45%" stopColor="#235347" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#051F20" stopOpacity="0.95" />
          </radialGradient>
          <pattern id="seismicGrid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="#8EB69B"
              strokeWidth="0.6"
              strokeOpacity="0.14"
            />
          </pattern>
        </defs>
        <rect width="640" height="360" fill="#051F20" />
        <rect width="640" height="360" fill="url(#seismicGrid)" />
        <rect width="640" height="360" fill="url(#seismicGlow)" />
        {/* Stylized Archipelago & Isoseismal Contours */}
        <path
          d="M90 190 Q 155 215, 220 225 T 355 232 T 490 205 T 570 175"
          fill="none"
          stroke="#8EB69B"
          strokeWidth="1.5"
          strokeOpacity="0.35"
          strokeDasharray="6 4"
        />
        <circle
          cx="320"
          cy="170"
          r="125"
          fill="none"
          stroke="#8EB69B"
          strokeWidth="1"
          strokeOpacity="0.25"
          strokeDasharray="4 4"
        />
        <circle
          cx="320"
          cy="170"
          r="86"
          fill="none"
          stroke="#E8B84B"
          strokeWidth="1.2"
          strokeOpacity="0.4"
        />
        <circle
          cx="320"
          cy="170"
          r="48"
          fill="rgba(232, 122, 62, 0.12)"
          stroke="#E87A3E"
          strokeWidth="1.6"
          strokeOpacity="0.75"
        />
        <circle cx="320" cy="170" r="8" fill="#E87A3E" />
        <circle cx="320" cy="170" r="16" fill="none" stroke="#DAF1DE" strokeWidth="1.2" opacity="0.6" />
      </svg>
      <div className="viewer__fallback-content">
        <span className="viewer__fallback-badge">Visualisasi Telemetri BMKG</span>
        <strong>{label}</strong>
        {caption ? <span>{caption}</span> : null}
      </div>
    </div>
  );
}

export function MediaViewerSection({
  items,
  title = "Peta & analisis BMKG",
  onOpenLightbox,
}: {
  items: Array<{ label: string; caption: string; src?: string | null }>;
  title?: string;
  onOpenLightbox: (validItems: MediaItem[], index: number) => void;
}) {
  const valid: MediaItem[] = items
    .map((i) => {
      const resolved = resolveMediaUrl(i.src);
      return resolved ? { label: i.label, caption: i.caption, src: resolved } : null;
    })
    .filter((i): i is MediaItem => Boolean(i));

  const [activeIdx, setActiveIdx] = useState(0);
  const [failedMap, setFailedMap] = useState<Record<string, boolean>>({});

  if (!valid.length) return null;
  const safeIdx = Math.min(activeIdx, valid.length - 1);
  const current = valid[safeIdx];
  const isCurrentFailed = Boolean(failedMap[current.src]);

  return (
    <section className="viewer-section">
      <h3>{title}</h3>
      <div className="viewer">
        <button
          className="viewer__stage"
          type="button"
          onClick={() => onOpenLightbox(valid, safeIdx)}
          aria-label={`Perbesar ${current.label}`}
        >
          {isCurrentFailed ? (
            <SeismicMediaFallback label={current.label} caption={current.caption} />
          ) : (
            <img
              src={current.src}
              alt={current.caption || current.label}
              referrerPolicy="no-referrer"
              onError={() =>
                setFailedMap((prev) => ({
                  ...prev,
                  [current.src]: true,
                }))
              }
            />
          )}
          <span className="viewer__hint">
            <RoneIcon name="expand" />
            Perbesar
          </span>
        </button>
        <p className="viewer__meta">{current.caption}</p>
        {valid.length > 1 ? (
          <div className="viewer__tabs" role="tablist" aria-label={title}>
            {valid.map((item, idx) => {
              const isTabFailed = Boolean(failedMap[item.src]);
              return (
                <button
                  key={item.label}
                  className="viewer__tab"
                  type="button"
                  role="tab"
                  aria-selected={idx === safeIdx ? "true" : "false"}
                  onClick={() => setActiveIdx(idx)}
                >
                  {isTabFailed ? (
                    <SeismicMediaFallback label={item.label} compact />
                  ) : (
                    <img
                      src={item.src}
                      alt=""
                      loading="lazy"
                      width={36}
                      height={36}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedMap((prev) => ({
                          ...prev,
                          [item.src]: true,
                        }))
                      }
                    />
                  )}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function RoneDetailSheet({
  target,
  realtimePool,
  nowMs,
  onClose,
  onPickRealtime,
  onShare,
  onOpenLightbox,
}: {
  target: DetailTarget | null;
  realtimePool: RoneRealtimeEvent[];
  nowMs: number;
  onClose: () => void;
  onPickRealtime: (ev: RoneRealtimeEvent) => void;
  onShare: (eventId: string) => void;
  onOpenLightbox: (items: MediaItem[], index: number) => void;
}) {
  const [narrativeHtml, setNarrativeHtml] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<RoneHistoryRecord[] | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);

  useEffect(() => {
    if (!target) return;
    setNarrativeHtml(null);
    setHistoryRecords(null);

    if (target.kind === "felt" && target.data.has_narrative) {
      setLoadingExtra(true);
      fetch(`/api/v1/earthquakes/${target.data.event_id}/narrative`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.html) setNarrativeHtml(d.html);
        })
        .catch(() => {})
        .finally(() => setLoadingExtra(false));
    } else if (target.kind === "realtime") {
      setLoadingExtra(true);
      fetch(`/api/v1/earthquakes/realtime/${target.data.event_id}/history`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (Array.isArray(d?.records)) setHistoryRecords(d.records);
          else setHistoryRecords([]);
        })
        .catch(() => setHistoryRecords([]))
        .finally(() => setLoadingExtra(false));
    }
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  if (!target) return null;

  const ev = target.data;
  const originMs = new Date(ev.origin_time).getTime();
  const nearby =
    target.kind === "damaging"
      ? []
      : realtimePool
          .map((item) => ({ item, km: distanceKm(ev, item) }))
          .filter(({ item, km }) => {
            if (km > 150 || item.event_id === ev.event_id) return false;
            const sameShock =
              Math.abs(new Date(item.origin_time).getTime() - originMs) < 120_000 && km < 30;
            return !sameShock;
          })
          .slice(0, 6);

  const oldestRealtime = realtimePool.at(-1);

  let title = "";
  let sub = "";
  if (target.kind === "felt") {
    title = target.data.region;
    sub = [
      fmtDateTime(target.data.origin_time),
      " · ",
      fmtRelative(target.data.origin_time, nowMs),
      target.data.tsunami_potential ? " · Berpotensi tsunami" : "",
    ].join("");
  } else if (target.kind === "realtime") {
    title = target.data.region;
    sub = `${fmtDateTime(target.data.origin_time)} · ${fmtRelative(target.data.origin_time, nowMs)}`;
  } else {
    title = target.data.epicenter
      ? target.data.epicenter.replace(/^di /, "Di ")
      : target.data.province;
    sub = `${target.data.province} · ${new Date(target.data.origin_time).getUTCFullYear()}`;
  }

  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sheet"
        id="detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <div className="sheet__head">
          <span id="detail-badge">
            <MagBadge magnitude={ev.magnitude} size="lg" />
          </span>
          <div className="sheet__heading">
            <h2 className="sheet__title" id="detail-title" tabIndex={-1}>
              {title}
            </h2>
            <p className="sheet__sub" id="detail-sub">
              {sub}
            </p>
          </div>
          <div className="sheet__actions">
            <button
              className="icon-btn"
              type="button"
              id="detail-share"
              aria-label="Bagikan tautan kejadian ini"
              onClick={() => onShare(ev.event_id)}
            >
              <RoneIcon name="share" />
            </button>
            <button
              className="icon-btn"
              type="button"
              data-close
              aria-label="Tutup"
              onClick={onClose}
            >
              <RoneIcon name="close" />
            </button>
          </div>
        </div>

        <div className="sheet__body" id="detail-body">
          {target.kind === "felt" ? (
            <>
              <FactsList
                rows={[
                  ["Waktu", fmtLong(target.data.origin_time)],
                  ["Kedalaman", fmtDepth(target.data.depth_km)],
                  ["Koordinat", fmtCoords(target.data.latitude, target.data.longitude)],
                  ["Potensi", target.data.potential || "–"],
                ]}
              />
              {(() => {
                const feltItems = parseFelt(target.data.felt);
                return feltItems.length ? (
                  <section>
                    <h3>Dirasakan (skala MMI)</h3>
                    <ul className="felt-list">
                      {feltItems.map((f, idx) => (
                        <li key={`${f.place}-${idx}`} className="mmi">
                          <b>{f.intensity}</b>
                          <span>{f.place}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null;
              })()}
              <MediaViewerSection
                items={[
                  {
                    label: "Peta guncangan",
                    caption: "Estimasi intensitas guncangan (shakemap)",
                    src: target.data.media?.shakemap,
                  },
                  {
                    label: "Dampak per kecamatan",
                    caption: "Perkiraan dampak per kecamatan",
                    src: target.data.media?.impact,
                  },
                  {
                    label: "PGA & MMI stasiun",
                    caption: "Percepatan tanah maksimum dan MMI per stasiun",
                    src: target.data.media?.station_intensity,
                  },
                  {
                    label: "Sebaran akselerometer",
                    caption: "Sebaran stasiun akselerometer",
                    src: target.data.media?.location_map,
                  },
                  {
                    label: "Intensitas",
                    caption: "Ringkasan intensitas",
                    src: target.data.media?.intensity,
                  },
                ]}
                onOpenLightbox={onOpenLightbox}
              />
              {target.data.has_narrative ? (
                <section>
                  <h3>Narasi BMKG</h3>
                  {loadingExtra ? (
                    <div className="prose small">
                      <span className="skeleton skeleton--line" />
                      <span className="skeleton skeleton--line" />
                    </div>
                  ) : narrativeHtml ? (
                    <div
                      className="prose small"
                      dangerouslySetInnerHTML={{ __html: narrativeHtml }}
                    />
                  ) : null}
                </section>
              ) : null}
              {target.data.instruction ? (
                <p className="small muted">{target.data.instruction}</p>
              ) : null}
            </>
          ) : null}

          {target.kind === "realtime" ? (
            <>
              <FactsList
                rows={[
                  ["Waktu", fmtLong(target.data.origin_time)],
                  ["Kedalaman", fmtDepth(target.data.depth_km)],
                  ["Koordinat", fmtCoords(target.data.latitude, target.data.longitude)],
                  [
                    "Status",
                    <span className="row" key="status">
                      <span className="pill pill--ok">
                        {target.data.status === "confirmed" ? "Terkonfirmasi" : target.data.status}
                      </span>
                      {target.data.has_focal_mechanism ? (
                        <span className="pill">Mekanisme fokal</span>
                      ) : null}
                    </span>,
                  ],
                ]}
              />
              <section>
                <h3>Riwayat pemutakhiran</h3>
                {loadingExtra || historyRecords === null ? (
                  <>
                    <span className="skeleton skeleton--line" />
                    <span className="skeleton skeleton--line" />
                  </>
                ) : historyRecords.length === 0 ? (
                  <div className="empty">
                    <strong>Belum ada riwayat</strong>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const mags = historyRecords
                        .map((r) => r.magnitude)
                        .filter((m): m is number => m != null);
                      if (mags.length < 2) return null;
                      const first = mags[0];
                      const last = mags[mags.length - 1];
                      const span = historyRecords[historyRecords.length - 1]?.minutes_after_origin;
                      return (
                        <p className="small" style={{ marginBottom: "var(--s-3)" }}>
                          Direvisi {fmtNumber(historyRecords.length)} kali
                          {span != null
                            ? ` dalam ${span.toLocaleString("id-ID", {
                                maximumFractionDigits: 1,
                              })} menit`
                            : ""}
                          : magnitudo {fmtMag(first)} menjadi {fmtMag(last)}.
                        </p>
                      );
                    })()}
                    <div className="table-wrap table-wrap--inset">
                      <table className="table">
                        <thead>
                          <tr>
                            <th scope="col">Waktu (WIB)</th>
                            <th scope="col" className="num">
                              + Menit
                            </th>
                            <th scope="col" className="num">
                              Mag
                            </th>
                            <th scope="col">Tipe</th>
                            <th scope="col" className="num">
                              Kedalaman
                            </th>
                            <th scope="col" className="num">
                              Fase
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyRecords.map((r, i) => (
                            <tr key={`${r.timestamp}-${i}`}>
                              <td className="mono nowrap">
                                {fmtTime(r.timestamp).replace(" WIB", "")}
                              </td>
                              <td className="num">
                                {r.minutes_after_origin == null
                                  ? "–"
                                  : r.minutes_after_origin.toLocaleString("id-ID", {
                                      minimumFractionDigits: 1,
                                      maximumFractionDigits: 1,
                                    })}
                              </td>
                              <td className="num">{fmtMag(r.magnitude)}</td>
                              <td className="mono">{r.magnitude_type || "–"}</td>
                              <td className="num">{fmtDepth(r.depth_km)}</td>
                              <td className="num">{r.phase_count ?? "–"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            </>
          ) : null}

          {target.kind === "damaging" ? (
            <>
              <FactsList
                rows={[
                  ["Waktu", fmtLong(target.data.origin_time)],
                  ["Kedalaman", fmtDepth(target.data.depth_km)],
                  ["Koordinat", fmtCoords(target.data.latitude, target.data.longitude)],
                  ["Tsunami", target.data.tsunami ? "Ya" : "Tidak"],
                ]}
              />
              <section>
                <h3>Korban &amp; kerusakan</h3>
                <p className="prose">{target.data.impact || "Tidak ada rincian."}</p>
              </section>
              {target.data.felt?.length ? (
                <section>
                  <h3>Dirasakan (skala MMI)</h3>
                  <ul className="felt-list">
                    {target.data.felt.map((f, idx) => (
                      <li key={`${f.place}-${idx}`} className="mmi">
                        <b>{f.intensity}</b>
                        <span>{f.place}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <p className="xsmall muted">Sumber: {target.data.source || "BMKG"}</p>
            </>
          ) : null}

          {nearby.length > 0 ? (
            <section>
              <h3>Aktivitas di sekitar (≤ 150 km)</h3>
              <ul className="nearby">
                {nearby.map(({ item, km }) => (
                  <li key={item.event_id}>
                    <button
                      className="nearby__item"
                      type="button"
                      onClick={() => onPickRealtime(item)}
                    >
                      <MagBadge magnitude={item.magnitude} size="sm" />
                      <span className="nearby__body">
                        <strong>{item.region}</strong>
                        <span>{fmtDateTime(item.origin_time)}</span>
                      </span>
                      <span className="nearby__km mono">{fmtNumber(Math.round(km))} km</span>
                    </button>
                  </li>
                ))}
              </ul>
              {oldestRealtime ? (
                <p className="xsmall muted mt-2">
                  Dari deteksi realtime sejak {fmtDateTime(oldestRealtime.origin_time)}.
                </p>
              ) : null}
            </section>
          ) : null}

          {target.kind === "realtime" ? (
            <p className="xsmall muted">
              Deteksi otomatis; parameter dapat berubah setelah ditinjau analis BMKG.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function RoneLightbox({
  state,
  onClose,
}: {
  state: { items: MediaItem[]; index: number } | null;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [failedMap, setFailedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (state) {
      setIdx(state.index);
      setZoom(1);
    }
  }, [state]);

  if (!state || !state.items.length) return null;
  const current = state.items[idx] || state.items[0];
  const multi = state.items.length > 1;
  const isCurrentFailed = Boolean(failedMap[current.src]);

  return (
    <div
      className="lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lb-title"
    >
      <div className="lightbox__bar">
        <div className="lightbox__heading">
          <h2 className="lightbox__title" id="lb-title">
            {current.label}
          </h2>
          {multi ? (
            <span className="lightbox__count">
              {idx + 1} / {state.items.length}
            </span>
          ) : null}
        </div>
        <div className="lightbox__tools">
          <button
            className="icon-btn"
            type="button"
            aria-label="Perkecil"
            disabled={zoom <= 1}
            onClick={() => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
          >
            <RoneIcon name="zoom-out" />
          </button>
          <button
            className="icon-btn"
            type="button"
            aria-label="Perbesar"
            disabled={zoom >= 3}
            onClick={() => setZoom((z) => Math.min(3, Number((z + 0.5).toFixed(1))))}
          >
            <RoneIcon name="zoom-in" />
          </button>
          <button
            className="icon-btn"
            type="button"
            aria-label="Tutup"
            onClick={onClose}
          >
            <RoneIcon name="close" />
          </button>
        </div>
      </div>

      <div
        className="lightbox__stage"
        onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
      >
        {isCurrentFailed ? (
          <SeismicMediaFallback label={current.label} caption={current.caption} />
        ) : (
          <img
            src={current.src}
            alt={current.caption || current.label}
            style={{ transform: `scale(${zoom})` }}
            referrerPolicy="no-referrer"
            onError={() =>
              setFailedMap((prev) => ({
                ...prev,
                [current.src]: true,
              }))
            }
          />
        )}
        {multi ? (
          <>
            <button
              className="lightbox__nav lightbox__nav--prev icon-btn"
              type="button"
              aria-label="Gambar sebelumnya"
              onClick={() => {
                setZoom(1);
                setIdx((i) => (i - 1 + state.items.length) % state.items.length);
              }}
            >
              <RoneIcon name="chevron-left" />
            </button>
            <button
              className="lightbox__nav lightbox__nav--next icon-btn"
              type="button"
              aria-label="Gambar berikutnya"
              onClick={() => {
                setZoom(1);
                setIdx((i) => (i + 1) % state.items.length);
              }}
            >
              <RoneIcon name="chevron-right" />
            </button>
          </>
        ) : null}
      </div>
      <p className="lightbox__hint">
        Klik dua kali untuk memperbesar atau reset · gunakan tombol atas untuk kontrol zoom
      </p>
    </div>
  );
}
