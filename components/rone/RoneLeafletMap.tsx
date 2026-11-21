"use client";

import React, { useEffect, useRef, useState } from "react";
import type LType from "leaflet";
import { AnimatePresence, motion } from "motion/react";
import { Check, Crosshair, Layers, Minus, Plus } from "lucide-react";
import {
  fmtDateTime,
  fmtDepth,
  fmtMag,
  magColorHex,
  RoneStation,
} from "@/lib/rone/format";
import { playUiSound, TAIMO_EASE } from "@/lib/rone/motionSystem";

export interface MapQuakePoint {
  event_id: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  depth_km: number;
  origin_time: string;
  region?: string;
  province?: string;
}

type AppleMapStyleMode = "explore" | "topo" | "satellite";

const INDONESIA = { center: [-2.6, 118.0] as [number, number], zoom: 5 };
const INDONESIA_BOUNDS: [[number, number], [number, number]] = [
  [-11.5, 94.5],
  [6.5, 141.5],
];

const ESRI_ATTR = "&copy; Esri, GEBCO, Garmin";
const ESRI_IMG_ATTR = "&copy; Esri, Maxar";
const ESRI_ROOT = "https://server.arcgisonline.com/ArcGIS/rest/services";

const exploreLightUrl = `${ESRI_ROOT}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`;
const exploreDarkBaseUrl = `${ESRI_ROOT}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
const exploreDarkLabelsUrl = `${ESRI_ROOT}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`;
const topoTileUrl = `${ESRI_ROOT}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`;
const satelliteTileUrl = `${ESRI_ROOT}/World_Imagery/MapServer/tile/{z}/{y}/{x}`;
const satelliteLabelsUrl = `${ESRI_ROOT}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`;

export const magRadius = (m: number) => Math.max(3.4, 2.7 + (m - 2) * 2.4);

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface RoneLeafletMapProps {
  id?: string;
  className?: string;
  ariaLabel?: string;
  events: MapQuakePoint[];
  latestEvent?: MapQuakePoint | null;
  selectedEvent?: MapQuakePoint | null;
  faintMarkers?: boolean;
  markerScale?: number;
  centerOnLatest?: boolean;
  latestZoom?: number;
  fitArchipelago?: boolean;
  scrollWheelZoom?: boolean;
  zoomPosition?: "topleft" | "topright" | "bottomleft" | "bottomright";
  isDark: boolean;
  onSelectEvent?: (ev: MapQuakePoint) => void;
  onSelectLatest?: (ev: MapQuakePoint) => void;
  extraLayers?: {
    archive3m?: MapQuakePoint[];
    archive5y?: MapQuakePoint[];
    faultsIndonesia?: GeoJSON.FeatureCollection | null;
    faultsGlobal?: GeoJSON.FeatureCollection | null;
    stationsIndonesia?: RoneStation[];
    stationsGlobal?: RoneStation[];
  };
  children?: React.ReactNode;
}

export function RoneLeafletMap({
  id = "latest-map",
  className = "map map--tall",
  ariaLabel = "Peta lokasi gempa terakhir dan deteksi 48 jam",
  events,
  latestEvent,
  selectedEvent,
  faintMarkers = false,
  markerScale = 1,
  centerOnLatest = false,
  latestZoom = 6,
  fitArchipelago = false,
  scrollWheelZoom = false,
  zoomPosition = "topleft",
  isDark,
  onSelectEvent,
  onSelectLatest,
  extraLayers,
  children,
}: RoneLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const LRef = useRef<typeof LType | null>(null);
  const baseLayerGroupRef = useRef<LType.LayerGroup | null>(null);
  const quakesGroupRef = useRef<LType.LayerGroup | null>(null);
  const extraGroupRef = useRef<LType.LayerGroup | null>(null);
  const latestMarkerRef = useRef<LType.Marker | null>(null);
  const pickedMarkerRef = useRef<LType.Marker | null>(null);
  const hasCenteredRef = useRef<string | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [styleMode, setStyleMode] = useState<AppleMapStyleMode>("explore");
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  const onSelectEventRef = useRef(onSelectEvent);
  const onSelectLatestRef = useRef(onSelectLatest);
  useEffect(() => {
    onSelectEventRef.current = onSelectEvent;
    onSelectLatestRef.current = onSelectLatest;
  }, [onSelectEvent, onSelectLatest]);

  // Initialize lightweight, ultra-reliable Leaflet map once
  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let settleTimer = 0;

    async function init() {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;

      const el = containerRef.current;
      const narrow = window.matchMedia("(max-width: 639px)").matches;
      const initialCenter =
        centerOnLatest && latestEvent
          ? ([latestEvent.latitude, latestEvent.longitude] as [number, number])
          : INDONESIA.center;
      const initialZoom =
        centerOnLatest && latestEvent
          ? latestZoom
          : narrow
            ? INDONESIA.zoom - 1
            : INDONESIA.zoom;

      const map = L.map(el, {
        center: initialCenter,
        zoom: initialZoom,
        minZoom: 2,
        maxZoom: 18,
        worldCopyJump: true,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        preferCanvas: true,
        fadeAnimation: true,
        zoomAnimation: true,
        scrollWheelZoom,
        zoomControl: false,
        attributionControl: true,
      });

      const labelsPane = map.createPane("labels");
      labelsPane.style.zIndex = "350";
      labelsPane.style.pointerEvents = "none";

      map.attributionControl.setPrefix(false);

      const baseGroup = L.layerGroup().addTo(map);
      const extraGroup = L.layerGroup().addTo(map);
      const quakesGroup = L.layerGroup().addTo(map);

      baseLayerGroupRef.current = baseGroup;
      extraGroupRef.current = extraGroup;
      quakesGroupRef.current = quakesGroup;
      mapRef.current = map;

      if (fitArchipelago) {
        map.fitBounds(INDONESIA_BOUNDS, { animate: false, padding: [18, 18] });
      }

      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize({ animate: false });
      });
      resizeObserver.observe(el);

      settleTimer = window.setTimeout(() => {
        if (!cancelled) {
          map.invalidateSize({ animate: false });
        }
      }, 160);

      setMapReady(true);
    }

    const rafId = window.requestAnimationFrame(() => {
      init();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(settleTimer);
      resizeObserver?.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch Apple-inspired Retina basemap tiles smoothly when styleMode or theme changes
  useEffect(() => {
    const L = LRef.current;
    const baseGroup = baseLayerGroupRef.current;
    if (!mapReady || !L || !baseGroup) return;

    baseGroup.clearLayers();

    if (styleMode === "explore") {
      if (isDark) {
        L.tileLayer(exploreDarkBaseUrl, {
          attribution: ESRI_ATTR,
          maxNativeZoom: 16,
          maxZoom: 18,
          keepBuffer: 3,
        }).addTo(baseGroup);
        L.tileLayer(exploreDarkLabelsUrl, {
          maxNativeZoom: 16,
          maxZoom: 18,
          pane: "labels",
          keepBuffer: 3,
        }).addTo(baseGroup);
      } else {
        L.tileLayer(exploreLightUrl, {
          attribution: ESRI_ATTR,
          maxNativeZoom: 18,
          maxZoom: 18,
          keepBuffer: 3,
        }).addTo(baseGroup);
      }
    } else if (styleMode === "topo") {
      L.tileLayer(topoTileUrl, {
        attribution: ESRI_ATTR,
        maxNativeZoom: 18,
        maxZoom: 18,
        keepBuffer: 3,
      }).addTo(baseGroup);
    } else {
      L.tileLayer(satelliteTileUrl, {
        attribution: ESRI_IMG_ATTR,
        maxNativeZoom: 17,
        maxZoom: 18,
        keepBuffer: 3,
      }).addTo(baseGroup);
      L.tileLayer(satelliteLabelsUrl, {
        maxNativeZoom: 16,
        maxZoom: 18,
        pane: "labels",
        keepBuffer: 3,
      }).addTo(baseGroup);
    }
  }, [styleMode, isDark, mapReady]);

  // Render extra layers (for Peta /map/ page)
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const extraGroup = extraGroupRef.current;
    if (!mapReady || !L || !map || !extraGroup) return;

    extraGroup.clearLayers();
    if (!extraLayers) return;

    const accentColor = isDark ? "#f07a3c" : "#c2410c";
    const stationColor = isDark ? "#cbd5e1" : "#475569";

    if (extraLayers.faultsGlobal) {
      L.geoJSON(extraLayers.faultsGlobal, {
        interactive: false,
        style: { color: accentColor, weight: 1.1, opacity: 0.6 },
      }).addTo(extraGroup);
    }

    if (extraLayers.faultsIndonesia) {
      L.geoJSON(extraLayers.faultsIndonesia, {
        interactive: false,
        style: { color: accentColor, weight: 1.4, opacity: 0.8 },
      }).addTo(extraGroup);
    }

    const renderStations = (stations?: RoneStation[]) => {
      if (!stations?.length) return;
      stations.forEach((s) => {
        L.circleMarker([s.latitude, s.longitude], {
          radius: 3.2,
          weight: 1,
          color: isDark ? "rgba(9,19,33,.8)" : "rgba(255,255,255,.92)",
          fillColor: stationColor,
          fillOpacity: 0.6,
        })
          .bindPopup(
            `<div><p class="am-popup__title">${escapeHtml(
              s.code
            )}</p><p class="am-popup__meta">${escapeHtml(s.name)} · ${escapeHtml(
              s.network
            )}</p></div>`,
            { maxWidth: 240 }
          )
          .addTo(extraGroup);
      });
    };

    renderStations(extraLayers.stationsGlobal);
    renderStations(extraLayers.stationsIndonesia);

    const renderArchive = (items: MapQuakePoint[] | undefined, scale: number) => {
      if (!items?.length) return;
      [...items]
        .sort((a, b) => a.magnitude - b.magnitude)
        .forEach((ev) => {
          const color = magColorHex(ev.magnitude, isDark);
          L.circleMarker([ev.latitude, ev.longitude], {
            radius: magRadius(ev.magnitude) * scale,
            color: isDark ? "rgba(10,16,28,.75)" : "rgba(255,255,255,.92)",
            weight: 1,
            fillColor: color,
            fillOpacity: 0.48,
          })
            .bindPopup(
              `<div><p class="am-popup__title">M ${fmtMag(ev.magnitude)} · ${escapeHtml(
                ev.region || ev.province || ""
              )}</p><p class="am-popup__meta">${escapeHtml(
                fmtDateTime(ev.origin_time)
              )}</p><p class="am-popup__meta">Kedalaman ${escapeHtml(
                fmtDepth(ev.depth_km)
              )}</p></div>`,
              { maxWidth: 260 }
            )
            .addTo(extraGroup);
        });
    };

    renderArchive(extraLayers.archive5y, 0.6);
    renderArchive(extraLayers.archive3m, 0.72);
  }, [extraLayers, isDark, mapReady]);

  // Render earthquake markers + latest epicenter pulsing ring & Apple frosted callout
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const quakesGroup = quakesGroupRef.current;
    if (!mapReady || !L || !map || !quakesGroup) return;

    quakesGroup.clearLayers();

    [...events]
      .sort((a, b) => a.magnitude - b.magnitude)
      .forEach((ev) => {
        if (!Number.isFinite(ev.latitude) || !Number.isFinite(ev.longitude)) return;
        const color = magColorHex(ev.magnitude, isDark);
        const radius = magRadius(ev.magnitude) * markerScale;

        // Subtle soft halo behind stronger earthquakes (M >= 5.0)
        if (ev.magnitude >= 5.0) {
          L.circleMarker([ev.latitude, ev.longitude], {
            radius: radius * 1.9,
            stroke: false,
            fillColor: color,
            fillOpacity: faintMarkers ? 0.12 : 0.2,
            interactive: false,
          }).addTo(quakesGroup);
        }

        const marker = L.circleMarker([ev.latitude, ev.longitude], {
          radius,
          color: isDark ? "rgba(10,16,28,.82)" : "rgba(255,255,255,.94)",
          weight: 1.25,
          fillColor: color,
          fillOpacity: faintMarkers ? 0.54 : 0.88,
        });

        if (onSelectEventRef.current) {
          marker.on("click", () => {
            playUiSound("click");
            onSelectEventRef.current?.(ev);
          });
        } else {
          marker.bindPopup(
            `<div><p class="am-popup__title">M ${fmtMag(ev.magnitude)} · ${escapeHtml(
              ev.region || ev.province || ""
            )}</p><p class="am-popup__meta">${escapeHtml(
              fmtDateTime(ev.origin_time)
            )}</p><p class="am-popup__meta">Kedalaman ${escapeHtml(
              fmtDepth(ev.depth_km)
            )}</p></div>`,
            { maxWidth: 260 }
          );
        }
        marker.addTo(quakesGroup);
      });

    latestMarkerRef.current?.remove();
    latestMarkerRef.current = null;

    if (
      latestEvent &&
      Number.isFinite(latestEvent.latitude) &&
      Number.isFinite(latestEvent.longitude) &&
      (!selectedEvent || selectedEvent.event_id !== latestEvent.event_id)
    ) {
      const color = magColorHex(latestEvent.magnitude, isDark);
      const divIcon = L.divIcon({
        className: "am-marker-wrap",
        html: `
          <div style="--c: ${color}; width: 76px; height: 76px; position: relative;">
            <div class="am-callout">
              <span class="am-callout__dot"></span>
              <span>Terbaru · M${fmtMag(latestEvent.magnitude)}</span>
            </div>
            <span class="epicenter__ring"></span>
            <span class="epicenter__ring"></span>
            <span class="epicenter__ring"></span>
            <span class="epicenter__core"></span>
          </div>
        `,
        iconSize: [76, 76],
        iconAnchor: [38, 38],
      });

      const marker = L.marker([latestEvent.latitude, latestEvent.longitude], {
        icon: divIcon,
        zIndexOffset: 1000,
      });

      marker.on("click", () => {
        playUiSound("click");
        if (onSelectLatestRef.current) onSelectLatestRef.current(latestEvent);
        else if (onSelectEventRef.current) onSelectEventRef.current(latestEvent);
      });

      marker.addTo(map);
      latestMarkerRef.current = marker;

      if (centerOnLatest && hasCenteredRef.current !== latestEvent.event_id) {
        map.setView([latestEvent.latitude, latestEvent.longitude], latestZoom, {
          animate: false,
        });
        hasCenteredRef.current = latestEvent.event_id;
      }
    }
  }, [
    events,
    latestEvent,
    selectedEvent,
    faintMarkers,
    markerScale,
    centerOnLatest,
    latestZoom,
    isDark,
    mapReady,
  ]);

  // Render picked event target ring + smooth flyTo glide
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;

    pickedMarkerRef.current?.remove();
    pickedMarkerRef.current = null;

    if (
      !selectedEvent ||
      !Number.isFinite(selectedEvent.latitude) ||
      !Number.isFinite(selectedEvent.longitude)
    ) {
      return;
    }

    const isLatest = latestEvent?.event_id === selectedEvent.event_id;
    const color = magColorHex(selectedEvent.magnitude, isDark);
    const label = `${isLatest ? "Terbaru · " : ""}M${fmtMag(selectedEvent.magnitude)} · ${
      selectedEvent.region || selectedEvent.province || ""
    }`;

    const marker = L.marker([selectedEvent.latitude, selectedEvent.longitude], {
      icon: L.divIcon({
        className: "am-marker-wrap",
        html: `
          <div style="--c: ${color}; width: 44px; height: 44px; position: relative;">
            <div class="am-callout">
              <span class="am-callout__dot"></span>
              <span>${escapeHtml(label)}</span>
            </div>
            <span class="picked__ring"></span>
            <span class="picked__dot"></span>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      }),
      keyboard: false,
      interactive: false,
      zIndexOffset: 2000,
    });

    marker.addTo(map);
    pickedMarkerRef.current = marker;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo(
      [selectedEvent.latitude, selectedEvent.longitude],
      Math.max(map.getZoom(), 6),
      { duration: reduce ? 0 : 0.65, easeLinearity: 0.25 }
    );
  }, [selectedEvent, latestEvent, isDark, mapReady]);

  // Close style picker when clicking outside, pressing Escape, or panning/zooming the map
  useEffect(() => {
    if (!styleMenuOpen) return;
    const closeMenu = () => setStyleMenuOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    const map = mapRef.current;
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", onKey);
    map?.on("movestart", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", onKey);
      map?.off("movestart", closeMenu);
    };
  }, [styleMenuOpen]);

  const handleZoomIn = () => {
    playUiSound("click");
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    playUiSound("click");
    mapRef.current?.zoomOut();
  };

  const handleRecenter = () => {
    playUiSound("click");
    const map = mapRef.current;
    if (!map) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (centerOnLatest && latestEvent) {
      map.flyTo([latestEvent.latitude, latestEvent.longitude], latestZoom, {
        duration: reduce ? 0 : 0.6,
      });
    } else if (fitArchipelago) {
      map.fitBounds(INDONESIA_BOUNDS, {
        animate: !reduce,
        padding: [18, 18],
      });
    } else {
      map.flyTo(INDONESIA.center, INDONESIA.zoom, {
        duration: reduce ? 0 : 0.6,
      });
    }
  };

  const styleOptions: Array<{
    key: AppleMapStyleMode;
    label: string;
    thumbClass: string;
  }> = [
    { key: "explore", label: "Eksplorasi", thumbClass: "am-style-card__thumb--explore" },
    { key: "topo", label: "Topografi", thumbClass: "am-style-card__thumb--topo" },
    { key: "satellite", label: "Satelit", thumbClass: "am-style-card__thumb--satellite" },
  ];

  return (
    <div
      id={id}
      className={`${className} map-host`}
      data-map-dark={isDark ? "true" : "false"}
      data-map-style={styleMode}
      role="region"
      aria-label={ariaLabel}
    >
      <div ref={containerRef} className="map-canvas" />
      <div className="am-vignette" aria-hidden="true" />

      {/* Top-Right Apple Maps Motion UI Style Switcher */}
      <div
        className="am-controls-tr"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <motion.div
          className="am-rail"
          role="toolbar"
          aria-label="Gaya peta"
          initial={{ opacity: 0, y: -6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.32, ease: TAIMO_EASE }}
        >
          <motion.button
            type="button"
            className="am-btn"
            aria-label="Pilih gaya peta"
            aria-expanded={styleMenuOpen}
            aria-haspopup="menu"
            aria-pressed={styleMenuOpen}
            title="Gaya peta"
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              playUiSound("click");
              setStyleMenuOpen((o) => !o);
            }}
          >
            <Layers size={16} strokeWidth={2.1} />
          </motion.button>
        </motion.div>

        <AnimatePresence>
          {styleMenuOpen ? (
            <motion.div
              className="am-style-sheet"
              role="menu"
              aria-label="Pilih gaya peta"
              initial={{ opacity: 0, scale: 0.92, y: -6, filter: "blur(6px)" }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.94, y: -4, filter: "blur(4px)" }}
              transition={{ duration: 0.22, ease: TAIMO_EASE }}
            >
              <p className="am-style-sheet__title">
                <span>Tampilan Peta</span>
              </p>
              <div className="am-style-grid">
                {styleOptions.map((opt) => {
                  const active = styleMode === opt.key;
                  return (
                    <motion.button
                      key={opt.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      className="am-style-card"
                      whileHover={{ y: -1.5 }}
                      whileTap={{ scale: 0.94 }}
                      transition={{ duration: 0.16, ease: TAIMO_EASE }}
                      onClick={() => {
                        playUiSound("tab");
                        setStyleMode(opt.key);
                        setStyleMenuOpen(false);
                      }}
                    >
                      <span className={`am-style-card__thumb ${opt.thumbClass}`}>
                        <AnimatePresence>
                          {active ? (
                            <motion.span
                              className="am-style-card__check"
                              initial={{ scale: 0.4, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.4, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 520, damping: 28 }}
                            >
                              <Check size={10} strokeWidth={3} />
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                      </span>
                      <span className="am-style-card__label">{opt.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Apple Maps Motion UI Zoom & Recenter Capsule */}
      <motion.div
        className="am-zoom-stack"
        data-pos={zoomPosition}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.34, delay: 0.04, ease: TAIMO_EASE }}
      >
        <div className="am-rail" role="group" aria-label="Kontrol zoom peta">
          <motion.button
            type="button"
            className="am-btn"
            aria-label="Perbesar peta"
            title="Perbesar"
            whileTap={{ scale: 0.9 }}
            onClick={handleZoomIn}
          >
            <Plus size={16} strokeWidth={2.2} />
          </motion.button>
          <motion.button
            type="button"
            className="am-btn"
            aria-label="Perkecil peta"
            title="Perkecil"
            whileTap={{ scale: 0.9 }}
            onClick={handleZoomOut}
          >
            <Minus size={16} strokeWidth={2.2} />
          </motion.button>
          <motion.button
            type="button"
            className="am-btn"
            aria-label="Pusatkan kembali peta"
            title="Pusatkan peta"
            whileTap={{ scale: 0.9 }}
            onClick={handleRecenter}
          >
            <Crosshair size={15} strokeWidth={2.1} />
          </motion.button>
        </div>
      </motion.div>

      {children ? (
        <div
          className="map-overlay-slot"
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
