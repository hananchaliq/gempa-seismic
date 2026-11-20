"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ImageOff, RefreshCw } from "lucide-react";
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
import {
  PILL_SPRING,
  playUiSound,
  SHEET_SPRING,
  TAIMO_EASE,
} from "@/lib/rone/motionSystem";
import { FactsList, MagBadge, MagDial, RoneIcon } from "./RoneIcons";

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
  // Route gempa.rone.dev media paths through our resilient multi-mirror /api/v1/media proxy
  const roneMediaMatch = trimmed.match(
    /^https?:\/\/gempa\.rone\.dev(\/api\/v1\/media\/.+)$/i
  );
  if (roneMediaMatch) {
    return roneMediaMatch[1];
  }
  if (trimmed.startsWith("/api/v1/media/")) {
    return trimmed;
  }
  if (trimmed.startsWith("/media/")) {
    return `/api/v1${trimmed}`;
  }
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
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
  onRetry,
}: {
  label: string;
  caption?: string;
  compact?: boolean;
  onRetry?: () => void;
}) {
  if (compact) {
    return (
      <span className="viewer__tab-fallback" aria-hidden="true">
        <ImageOff size={15} strokeWidth={2} />
      </span>
    );
  }

  return (
    <div className="viewer__fallback" role="img" aria-label={caption || label}>
      <div className="viewer__fallback-content">
        <span className="viewer__fallback-icon" aria-hidden="true">
          <ImageOff size={20} strokeWidth={1.9} />
        </span>
        <span className="viewer__fallback-badge">Citra BMKG Belum Tersedia</span>
        <strong className="viewer__fallback-title">{label}</strong>
        {caption ? <span className="viewer__fallback-sub">{caption}</span> : null}
        {onRetry ? (
          <button
            type="button"
            className="viewer__fallback-retry"
            onClick={(e) => {
              e.stopPropagation();
              playUiSound("click");
              onRetry();
            }}
          >
            <RefreshCw size={13} strokeWidth={2.2} />
            <span>Muat Ulang</span>
          </button>
        ) : null}
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
  const valid: MediaItem[] = useMemo(
    () =>
      items
        .map((i) => {
          const resolved = resolveMediaUrl(i.src);
          return resolved ? { label: i.label, caption: i.caption, src: resolved } : null;
        })
        .filter((i): i is MediaItem => Boolean(i)),
    [items]
  );

  const itemsSignature = useMemo(() => valid.map((v) => v.src).join("|"), [valid]);
  const [selectedBySig, setSelectedBySig] = useState<Record<string, string>>({});
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [failedBySig, setFailedBySig] = useState<Record<string, Record<string, boolean>>>({});
  const [retryBySig, setRetryBySig] = useState<Record<string, number>>({});
  const swipeRef = React.useRef<{
    startX: number;
    startY: number;
    swiped: boolean;
    active: boolean;
  } | null>(null);

  const failedMap = useMemo(
    () => failedBySig[itemsSignature] || {},
    [failedBySig, itemsSignature]
  );
  const retryNonce = retryBySig[itemsSignature] || 0;

  // Filter out any of the 5 images that BMKG did not publish (404 / broken) whenever at least 1 valid image exists
  const availableItems = useMemo(() => {
    const working = valid.filter((item) => !failedMap[item.src]);
    return working.length > 0 ? working : valid;
  }, [valid, failedMap]);

  const unavailableCount = useMemo(
    () => valid.filter((item) => failedMap[item.src]).length,
    [valid, failedMap]
  );

  const allFailed = valid.length > 0 && unavailableCount === valid.length;

  if (!valid.length) return null;

  const preferredSrc = selectedBySig[itemsSignature] || valid[0]?.src || "";
  const effectiveIdx = availableItems.findIndex((item) => item.src === preferredSrc);
  const safeIdx = effectiveIdx >= 0 ? effectiveIdx : 0;
  const current = availableItems[safeIdx] || availableItems[0];
  const isCurrentFailed = Boolean(failedMap[current.src]);
  const multi = availableItems.length > 1;

  const setActiveSrc = (src: string) => {
    setSelectedBySig((prev) => ({ ...prev, [itemsSignature]: src }));
  };

  const withNonce = (url: string) => {
    if (!retryNonce) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}r=${retryNonce}`;
  };

  const markFailed = (src: string) => {
    setFailedBySig((prev) => {
      const currentMap = prev[itemsSignature] || {};
      if (currentMap[src]) return prev;
      return {
        ...prev,
        [itemsSignature]: { ...currentMap, [src]: true },
      };
    });
  };

  const handleRetryAll = () => {
    setFailedBySig((prev) => ({ ...prev, [itemsSignature]: {} }));
    setRetryBySig((prev) => ({
      ...prev,
      [itemsSignature]: (prev[itemsSignature] || 0) + 1,
    }));
    setActiveSrc(valid[0]?.src || "");
  };

  const goPrev = () => {
    playUiSound("slide");
    setDragOffsetX(0);
    const nextIdx = (safeIdx - 1 + availableItems.length) % availableItems.length;
    setActiveSrc(availableItems[nextIdx].src);
  };
  const goNext = () => {
    playUiSound("slide");
    setDragOffsetX(0);
    const nextIdx = (safeIdx + 1) % availableItems.length;
    setActiveSrc(availableItems[nextIdx].src);
  };

  return (
    <section className="viewer-section">
      <h3>{title}</h3>
      <div className="viewer">
        <div
          className="viewer__stage"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!allFailed) onOpenLightbox(availableItems, safeIdx);
            }
          }}
          onClick={() => {
            if (swipeRef.current?.swiped) {
              swipeRef.current.swiped = false;
              return;
            }
            if (allFailed) return;
            playUiSound("pop");
            onOpenLightbox(availableItems, safeIdx);
          }}
          onTouchStart={(e) => {
            if (!multi || e.touches.length !== 1) return;
            swipeRef.current = {
              startX: e.touches[0].clientX,
              startY: e.touches[0].clientY,
              swiped: false,
              active: true,
            };
          }}
          onTouchMove={(e) => {
            if (!multi || !swipeRef.current?.active || e.touches.length !== 1) return;
            const dx = e.touches[0].clientX - swipeRef.current.startX;
            const dy = e.touches[0].clientY - swipeRef.current.startY;
            if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
              setDragOffsetX(Math.max(-90, Math.min(90, dx * 0.45)));
            }
          }}
          onTouchEnd={(e) => {
            if (!multi || !swipeRef.current?.active) return;
            const endX = e.changedTouches[0]?.clientX ?? swipeRef.current.startX;
            const endY = e.changedTouches[0]?.clientY ?? swipeRef.current.startY;
            const dx = endX - swipeRef.current.startX;
            const dy = endY - swipeRef.current.startY;
            swipeRef.current.active = false;
            setDragOffsetX(0);
            if (Math.abs(dx) >= 38 && Math.abs(dx) > Math.abs(dy)) {
              swipeRef.current.swiped = true;
              if (dx < 0) goNext();
              else goPrev();
            }
          }}
          onPointerDown={(e) => {
            if (!multi || e.pointerType === "touch") return;
            swipeRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              swiped: false,
              active: true,
            };
          }}
          onPointerMove={(e) => {
            if (!multi || e.pointerType === "touch" || !swipeRef.current?.active) return;
            const dx = e.clientX - swipeRef.current.startX;
            const dy = e.clientY - swipeRef.current.startY;
            if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
              setDragOffsetX(Math.max(-90, Math.min(90, dx * 0.45)));
            }
          }}
          onPointerUp={(e) => {
            if (!multi || e.pointerType === "touch" || !swipeRef.current?.active) return;
            const dx = e.clientX - swipeRef.current.startX;
            const dy = e.clientY - swipeRef.current.startY;
            swipeRef.current.active = false;
            setDragOffsetX(0);
            if (Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy)) {
              swipeRef.current.swiped = true;
              if (dx < 0) goNext();
              else goPrev();
            }
          }}
          aria-label={`Perbesar ${current.label}`}
        >
          <AnimatePresence mode="wait">
            {isCurrentFailed ? (
              <motion.div
                key={`fallback-${current.src}-${retryNonce}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.22, ease: TAIMO_EASE }}
                className="viewer__stage-motion"
              >
                <SeismicMediaFallback
                  label={current.label}
                  caption={current.caption}
                  onRetry={handleRetryAll}
                />
              </motion.div>
            ) : (
              <motion.img
                key={`img-${current.src}-${retryNonce}`}
                src={withNonce(current.src)}
                alt={current.caption || current.label}
                draggable={false}
                initial={{ opacity: 0.35, filter: "blur(4px)" }}
                animate={{
                  opacity: 1,
                  filter: "blur(0px)",
                  x: dragOffsetX,
                }}
                exit={{ opacity: 0.35 }}
                transition={{ duration: 0.24, ease: TAIMO_EASE }}
                referrerPolicy="no-referrer"
                onError={() => markFailed(current.src)}
              />
            )}
          </AnimatePresence>
          {!isCurrentFailed ? (
            <span className="viewer__hint">
              <RoneIcon name="expand" />
              Perbesar
            </span>
          ) : null}
        </div>

        <p className="viewer__meta">
          {current.caption}
          {multi ? ` · (${safeIdx + 1}/${availableItems.length} · Geser foto)` : ""}
          {!allFailed && unavailableCount > 0
            ? ` · ${unavailableCount} citra belum diterbitkan BMKG`
            : ""}
        </p>

        {availableItems.length > 1 && !allFailed ? (
          <div className="viewer__tabs" role="tablist" aria-label={title}>
            {availableItems.map((item, idx) => {
              const isSelected = idx === safeIdx;
              return (
                <motion.button
                  key={item.src}
                  className="viewer__tab"
                  type="button"
                  role="tab"
                  aria-selected={isSelected ? "true" : "false"}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    playUiSound("tab");
                    setActiveSrc(item.src);
                  }}
                >
                  {isSelected ? (
                    <motion.span
                      layoutId={`viewer-tab-pill-${itemsSignature}`}
                      className="viewer__tab-pill"
                      transition={PILL_SPRING}
                    />
                  ) : null}
                  <img
                    src={withNonce(item.src)}
                    alt=""
                    loading="eager"
                    width={34}
                    height={34}
                    referrerPolicy="no-referrer"
                    onError={() => markFailed(item.src)}
                  />
                  <span className="viewer__tab-label">{item.label}</span>
                </motion.button>
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
  const [extraByEvent, setExtraByEvent] = useState<{
    eventId: string;
    narrativeHtml: string | null;
    historyRecords: RoneHistoryRecord[] | null;
    done: boolean;
  } | null>(null);

  const activeEventId = target?.data.event_id ?? null;
  const narrativeHtml =
    extraByEvent?.eventId === activeEventId ? extraByEvent.narrativeHtml : null;
  const historyRecords =
    extraByEvent?.eventId === activeEventId ? extraByEvent.historyRecords : null;
  const needsExtra =
    (target?.kind === "felt" && Boolean(target.data.has_narrative)) ||
    target?.kind === "realtime";
  const loadingExtra = Boolean(
    needsExtra && (!extraByEvent || extraByEvent.eventId !== activeEventId || !extraByEvent.done)
  );

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const eventId = target.data.event_id;

    if (target.kind === "felt" && target.data.has_narrative) {
      fetch(`/api/v1/earthquakes/${eventId}/narrative`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          setExtraByEvent({
            eventId,
            narrativeHtml: d?.html || null,
            historyRecords: null,
            done: true,
          });
        })
        .catch(() => {
          if (cancelled) return;
          setExtraByEvent({
            eventId,
            narrativeHtml: null,
            historyRecords: null,
            done: true,
          });
        });
    } else if (target.kind === "realtime") {
      fetch(`/api/v1/earthquakes/realtime/${eventId}/history`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          setExtraByEvent({
            eventId,
            narrativeHtml: null,
            historyRecords: Array.isArray(d?.records) ? d.records : [],
            done: true,
          });
        })
        .catch(() => {
          if (cancelled) return;
          setExtraByEvent({
            eventId,
            narrativeHtml: null,
            historyRecords: [],
            done: true,
          });
        });
    }

    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  return (
    <AnimatePresence>
      {target ? (() => {
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
                    Math.abs(new Date(item.origin_time).getTime() - originMs) < 120_000 &&
                    km < 30;
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
          sub = `${fmtDateTime(target.data.origin_time)} · ${fmtRelative(
            target.data.origin_time,
            nowMs
          )}`;
        } else {
          title = target.data.epicenter
            ? target.data.epicenter.replace(/^di /, "Di ")
            : target.data.province;
          sub = `${target.data.province} · ${new Date(target.data.origin_time).getUTCFullYear()}`;
        }

        return (
          <motion.div
            key="detail-sheet-backdrop"
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            <motion.div
              key={`sheet-${ev.event_id}`}
              className="sheet"
              id="detail"
              role="dialog"
              aria-modal="true"
              aria-labelledby="detail-title"
              initial={{ x: "100%", opacity: 0.7 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.6 }}
              transition={SHEET_SPRING}
            >
              <div className="sheet__head">
                <span id="detail-badge">
                  <MagDial magnitude={ev.magnitude} size="compact" />
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
                                {fmtDateTime(r.timestamp)}
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
      </motion.div>
    </motion.div>
        );
      })() : null}
    </AnimatePresence>
  );
}

export function RoneLightbox({
  state,
  onClose,
}: {
  state: { items: MediaItem[]; index: number } | null;
  onClose: () => void;
}) {
  const [idxState, setIdxState] = useState<{ stateRef: typeof state; idx: number }>({
    stateRef: state,
    idx: state?.index ?? 0,
  });
  const [zoom, setZoom] = useState(1);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [failedMap, setFailedMap] = useState<Record<string, boolean>>({});
  const swipeRef = React.useRef<{ startX: number; startY: number; active: boolean } | null>(
    null
  );

  const idx = idxState.stateRef === state ? idxState.idx : (state?.index ?? 0);
  const setIdx = (updater: number | ((prev: number) => number)) => {
    setIdxState((prev) => {
      const base = prev.stateRef === state ? prev.idx : (state?.index ?? 0);
      const next = typeof updater === "function" ? updater(base) : updater;
      return { stateRef: state, idx: next };
    });
  };

  useEffect(() => {
    if (!state || !state.items.length) return;
    const len = state.items.length;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && len > 1) {
        setZoom(1);
        setDragOffsetX(0);
        setIdx((i) => (i - 1 + len) % len);
      } else if (e.key === "ArrowRight" && len > 1) {
        setZoom(1);
        setDragOffsetX(0);
        setIdx((i) => (i + 1) % len);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  const goPrev = () => {
    if (!state?.items.length) return;
    playUiSound("slide");
    setZoom(1);
    setDragOffsetX(0);
    setIdx((i) => (i - 1 + state.items.length) % state.items.length);
  };
  const goNext = () => {
    if (!state?.items.length) return;
    playUiSound("slide");
    setZoom(1);
    setDragOffsetX(0);
    setIdx((i) => (i + 1) % state.items.length);
  };

  return (
    <AnimatePresence>
      {state && state.items.length > 0 ? (() => {
        const current = state.items[idx] || state.items[0];
        const multi = state.items.length > 1;
        const isCurrentFailed = Boolean(failedMap[current.src]);

        return (
          <motion.div
            key="lightbox-backdrop"
            className="lightbox-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lb-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: TAIMO_EASE }}
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            <div className="lightbox__bar">
              <div className="lightbox__heading">
                <h2 className="lightbox__title" id="lb-title">
                  {current.label}
                </h2>
                {multi ? (
                  <span className="lightbox__count mono">
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
                  onClick={() => {
                    playUiSound("click");
                    setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))));
                  }}
                >
                  <RoneIcon name="zoom-out" />
                </button>
                <button
                  className="icon-btn"
                  type="button"
                  aria-label="Perbesar"
                  disabled={zoom >= 3}
                  onClick={() => {
                    playUiSound("click");
                    setZoom((z) => Math.min(3, Number((z + 0.5).toFixed(1))));
                  }}
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
              onTouchStart={(e) => {
                if (!multi || zoom > 1 || e.touches.length !== 1) return;
                swipeRef.current = {
                  startX: e.touches[0].clientX,
                  startY: e.touches[0].clientY,
                  active: true,
                };
              }}
              onTouchMove={(e) => {
                if (!multi || zoom > 1 || !swipeRef.current?.active || e.touches.length !== 1)
                  return;
                const dx = e.touches[0].clientX - swipeRef.current.startX;
                const dy = e.touches[0].clientY - swipeRef.current.startY;
                if (Math.abs(dx) > Math.abs(dy)) {
                  setDragOffsetX(Math.max(-140, Math.min(140, dx * 0.6)));
                }
              }}
              onTouchEnd={(e) => {
                if (!multi || zoom > 1 || !swipeRef.current?.active) return;
                const endX = e.changedTouches[0]?.clientX ?? swipeRef.current.startX;
                const dx = endX - swipeRef.current.startX;
                swipeRef.current = null;
                setDragOffsetX(0);
                if (Math.abs(dx) >= 42) {
                  if (dx < 0) goNext();
                  else goPrev();
                }
              }}
              onPointerDown={(e) => {
                if (!multi || zoom > 1 || e.pointerType === "touch") return;
                swipeRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  active: true,
                };
              }}
              onPointerMove={(e) => {
                if (!multi || zoom > 1 || e.pointerType === "touch" || !swipeRef.current?.active)
                  return;
                const dx = e.clientX - swipeRef.current.startX;
                setDragOffsetX(Math.max(-140, Math.min(140, dx * 0.6)));
              }}
              onPointerUp={(e) => {
                if (!multi || zoom > 1 || e.pointerType === "touch" || !swipeRef.current?.active)
                  return;
                const dx = e.clientX - swipeRef.current.startX;
                swipeRef.current = null;
                setDragOffsetX(0);
                if (Math.abs(dx) >= 46) {
                  if (dx < 0) goNext();
                  else goPrev();
                }
              }}
            >
              {isCurrentFailed ? (
                <SeismicMediaFallback label={current.label} caption={current.caption} />
              ) : (
                <motion.img
                  key={`lb-img-${current.src}`}
                  src={current.src}
                  alt={current.caption || current.label}
                  draggable={false}
                  initial={{ opacity: 0.4, scale: 0.96 }}
                  animate={{ opacity: 1, scale: zoom, x: dragOffsetX }}
                  transition={{ duration: 0.24, ease: TAIMO_EASE }}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setFailedMap((prev) => ({
                      ...prev,
                      [current.src]: true,
                    }))
                  }
                />
              )}
            </div>
            <div className="lightbox__footer">
              {multi ? (
                <div className="lightbox__pills" role="tablist" aria-label="Pilih foto">
                  {state.items.map((item, i) => (
                    <button
                      key={item.label}
                      type="button"
                      role="tab"
                      aria-selected={i === idx ? "true" : "false"}
                      className={`lightbox__pill${i === idx ? " is-active" : ""}`}
                      onClick={() => {
                        playUiSound("tab");
                        setZoom(1);
                        setDragOffsetX(0);
                        setIdx(i);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="lightbox__hint">
                {multi
                  ? "Geser foto kiri/kanan untuk berpindah · Ketuk 2× untuk memperbesar"
                  : "Ketuk 2× untuk memperbesar atau reset · gunakan tombol atas untuk kontrol zoom"}
              </p>
            </div>
          </motion.div>
        );
      })() : null}
    </AnimatePresence>
  );
}
