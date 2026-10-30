"use client";

import React, { useEffect, useRef, useState } from "react";
import type LType from "leaflet";
import {
  fmtDateTime,
  fmtDepth,
  fmtMag,
  magColorHex,
  RoneStation,
} from "@/lib/rone/format";
import { iconHTML } from "./RoneIcons";

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

const INDONESIA = { center: [-2.6, 118.0] as [number, number], zoom: 5 };
const INDONESIA_BOUNDS: [[number, number], [number, number]] = [
  [-11.5, 94.5],
  [6.5, 141.5],
];
const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';
const ESRI = "&copy; Esri, OSM";
const ESRI_ROOT = "https://server.arcgisonline.com/ArcGIS/rest/services";

const canvasUrl = (dark: boolean, kind: "Base" | "Reference") =>
  `${ESRI_ROOT}/Canvas/World_${dark ? "Dark" : "Light"}_Gray_${kind}/MapServer/tile/{z}/{y}/{x}`;

export const magRadius = (m: number) => Math.max(3, 2.5 + (m - 2) * 2.4);

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
  // Optional extra layers for the full /map/ seismicity explorer
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
  const quakesGroupRef = useRef<LType.LayerGroup | null>(null);
  const extraGroupRef = useRef<LType.LayerGroup | null>(null);
  const latestMarkerRef = useRef<LType.Marker | null>(null);
  const pickedMarkerRef = useRef<LType.Marker | null>(null);
  const canvasBaseRef = useRef<LType.TileLayer | null>(null);
  const canvasLabelsRef = useRef<LType.TileLayer | null>(null);
  const hasCenteredRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const onSelectEventRef = useRef(onSelectEvent);
  const onSelectLatestRef = useRef(onSelectLatest);
  useEffect(() => {
    onSelectEventRef.current = onSelectEvent;
    onSelectLatestRef.current = onSelectLatest;
  }, [onSelectEvent, onSelectLatest]);

  // Initialize Leaflet map once
  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let settleTimer1: ReturnType<typeof setTimeout> | null = null;
    let settleTimer2: ReturnType<typeof setTimeout> | null = null;
    let docClickHandler: ((e: MouseEvent) => void) | null = null;

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
          ? Math.round(latestZoom)
          : narrow
            ? INDONESIA.zoom - 1
            : INDONESIA.zoom;

      // IMPORTANT: Use integer zoomSnap: 1 so fitBounds and zoom controls never land on
      // fractional zoom levels (e.g. 4.5), which would cause 404s on XYZ tile servers.
      const map = L.map(el, {
        center: initialCenter,
        zoom: initialZoom,
        minZoom: 2,
        maxZoom: 16,
        worldCopyJump: true,
        zoomSnap: 1,
        zoomDelta: 1,
        preferCanvas: true,
        scrollWheelZoom,
        zoomControl: false,
        attributionControl: true,
      });

      const labelsPane = map.createPane("labels");
      labelsPane.style.zIndex = "350";
      labelsPane.style.pointerEvents = "none";

      const createCanvasTileLayer = (
        urlTemplate: string,
        opts: LType.GridLayerOptions & { maxZoom?: number } = {}
      ) => {
        let currentUrl = urlTemplate;
        const CanvasTileLayer = L.GridLayer.extend({
          createTile(coords: LType.Coords, done: LType.DoneCallback) {
            const tile = document.createElement("canvas");
            tile.width = 256;
            tile.height = 256;
            tile.className = "leaflet-tile";
            const ctx = tile.getContext("2d");
            const img = new Image();
            img.referrerPolicy = "no-referrer";
            img.decoding = "async";
            img.onload = () => {
              if (ctx) {
                ctx.drawImage(img, 0, 0, 256, 256);
              }
              done(undefined, tile);
            };
            img.onerror = (err) => {
              done(err instanceof Error ? err : new Error("Tile error"), tile);
            };
            const intZ = Math.max(0, Math.round(coords.z));
            img.src = L.Util.template(currentUrl, {
              r: "",
              s: "a",
              x: Math.round(coords.x),
              y: Math.round(coords.y),
              z: intZ,
            });
            return tile;
          },
          setUrl(newUrl: string) {
            if (currentUrl === newUrl) {
              return this;
            }
            currentUrl = newUrl;
            this.redraw();
            return this;
          },
        });
        return new (CanvasTileLayer as unknown as new (
          o?: LType.GridLayerOptions
        ) => LType.TileLayer)({
          ...opts,
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 2,
        });
      };

      const darkNow = document.documentElement.dataset.theme === "dark";
      const canvasBase = createCanvasTileLayer(canvasUrl(darkNow, "Base"), {
        attribution: ESRI,
        maxZoom: 16,
      });
      const canvasLabels = createCanvasTileLayer(canvasUrl(darkNow, "Reference"), {
        maxZoom: 16,
        pane: "labels",
      });
      canvasBaseRef.current = canvasBase;
      canvasLabelsRef.current = canvasLabels;

      const base = [
        {
          key: "neutral",
          label: "Netral",
          layer: L.layerGroup([canvasBase, canvasLabels]),
          swatch: `<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" style="border-radius:8px;flex-shrink:0"><rect width="36" height="36" rx="8" fill="#1f232a"/><path d="M5 24 Q14 16 22 20 T32 12" fill="none" stroke="#64748b" stroke-width="2"/><circle cx="18" cy="18" r="3.5" fill="#f97316"/></svg>`,
        },
        {
          key: "streets",
          label: "Jalan",
          layer: createCanvasTileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: OSM,
            maxZoom: 19,
          }),
          swatch: `<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" style="border-radius:8px;flex-shrink:0"><rect width="36" height="36" rx="8" fill="#e2e8f0"/><path d="M0 14 L36 22 M14 0 L22 36" stroke="#94a3b8" stroke-width="2.5"/><path d="M4 28 L32 8" stroke="#f59e0b" stroke-width="2"/></svg>`,
        },
        {
          key: "satellite",
          label: "Satelit",
          layer: createCanvasTileLayer(`${ESRI_ROOT}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, {
            attribution: "Tiles &copy; Esri",
            maxZoom: 18,
          }),
          swatch: `<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" style="border-radius:8px;flex-shrink:0"><rect width="36" height="36" rx="8" fill="#0c2d3a"/><path d="M6 22 Q16 12 28 18 T34 26 L36 36 L0 36 Z" fill="#14532d"/><circle cx="24" cy="12" r="3" fill="#38bdf8" fill-opacity="0.6"/></svg>`,
        },
      ];

      base[0].layer.addTo(map);

      L.control
        .zoom({
          position: zoomPosition,
          zoomInText: iconHTML("plus"),
          zoomOutText: iconHTML("minus"),
          zoomInTitle: "Perbesar",
          zoomOutTitle: "Perkecil",
        })
        .addTo(map);

      // Custom BasemapControl
      const BasemapControl = L.Control.extend({
        onAdd() {
          let current = base[0];
          const wrap = document.createElement("div");
          wrap.className = "leaflet-control basemap";
          wrap.dataset.open = "false";

          const button = document.createElement("button");
          button.className = "map-btn";
          button.type = "button";
          button.setAttribute("aria-label", "Pilih peta dasar");
          button.setAttribute("aria-expanded", "false");
          button.setAttribute("aria-haspopup", "menu");
          button.title = "Peta dasar";
          button.innerHTML = iconHTML("layers");

          const menu = document.createElement("div");
          menu.className = "basemap__menu";
          menu.setAttribute("role", "menu");
          menu.setAttribute("aria-label", "Peta dasar");

          const setOpen = (open: boolean) => {
            wrap.dataset.open = String(open);
            button.setAttribute("aria-expanded", String(open));
          };

          const optionBtns: HTMLButtonElement[] = base.map((item) => {
            const opt = document.createElement("button");
            opt.className = "basemap__opt";
            opt.type = "button";
            opt.setAttribute("role", "menuitemradio");
            opt.dataset.base = item.key;
            opt.setAttribute("aria-checked", String(item === current));
            opt.innerHTML = `${item.swatch}<span>${item.label}</span>${iconHTML("check", "icon basemap__check")}`;
            opt.addEventListener("click", () => {
              if (item !== current) {
                map.removeLayer(current.layer);
                item.layer.addTo(map);
                current = item;
                optionBtns.forEach((o) =>
                  o.setAttribute("aria-checked", String(o.dataset.base === item.key))
                );
              }
              setOpen(false);
              button.focus();
            });
            menu.appendChild(opt);
            return opt;
          });

          wrap.append(button, menu);
          button.addEventListener("click", (e) => {
            e.stopPropagation();
            setOpen(wrap.dataset.open !== "true");
          });
          docClickHandler = (e: MouseEvent) => {
            if (!wrap.contains(e.target as Node)) setOpen(false);
          };
          document.addEventListener("click", docClickHandler);
          L.DomEvent.disableClickPropagation(wrap);
          L.DomEvent.disableScrollPropagation(wrap);
          return wrap;
        },
      });

      new BasemapControl({ position: "topright" }).addTo(map);
      map.attributionControl.setPrefix(false);

      const extraGroup = L.layerGroup().addTo(map);
      const quakesGroup = L.layerGroup().addTo(map);
      extraGroupRef.current = extraGroup;
      quakesGroupRef.current = quakesGroup;
      mapRef.current = map;

      const applyArchipelagoFit = () => {
        if (!mapRef.current) return;
        mapRef.current.invalidateSize({ pan: false });
        if (fitArchipelago) {
          mapRef.current.fitBounds(INDONESIA_BOUNDS, {
            animate: false,
            maxZoom: 5,
          });
        }
      };

      applyArchipelagoFit();

      // Ensure tiles and bounds are synced after tab transition / initial layout
      settleTimer1 = setTimeout(applyArchipelagoFit, 80);
      settleTimer2 = setTimeout(() => {
        if (!mapRef.current) return;
        mapRef.current.invalidateSize({ pan: false });
      }, 280);

      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize({ pan: false });
        }
      });
      resizeObserver.observe(el);
      setMapReady(true);
    }

    init();

    return () => {
      cancelled = true;
      if (settleTimer1) clearTimeout(settleTimer1);
      if (settleTimer2) clearTimeout(settleTimer2);
      if (docClickHandler) document.removeEventListener("click", docClickHandler);
      resizeObserver?.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync basemap tiles when theme changes
  useEffect(() => {
    if (!mapReady || !canvasBaseRef.current || !canvasLabelsRef.current) return;
    canvasBaseRef.current.setUrl(canvasUrl(isDark, "Base"));
    canvasLabelsRef.current.setUrl(canvasUrl(isDark, "Reference"));
  }, [isDark, mapReady]);

  // Render extra layers (for Peta /map/ page)
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const extraGroup = extraGroupRef.current;
    if (!mapReady || !L || !map || !extraGroup) return;

    extraGroup.clearLayers();
    if (!extraLayers) return;

    const accentColor = isDark ? "#f07a3c" : "#c2410c";
    const stationColor = isDark ? "#c4baaa" : "#4f463b";

    if (extraLayers.faultsGlobal) {
      L.geoJSON(extraLayers.faultsGlobal, {
        interactive: false,
        style: { color: accentColor, weight: 1, opacity: 0.65 },
      }).addTo(extraGroup);
    }

    if (extraLayers.faultsIndonesia) {
      L.geoJSON(extraLayers.faultsIndonesia, {
        interactive: false,
        style: { color: accentColor, weight: 1.3, opacity: 0.75 },
      }).addTo(extraGroup);
    }

    const renderStations = (stations?: RoneStation[]) => {
      if (!stations?.length) return;
      stations.forEach((s) => {
        L.circleMarker([s.latitude, s.longitude], {
          radius: 3,
          weight: 1,
          color: stationColor,
          fillColor: stationColor,
          fillOpacity: 0.35,
        })
          .bindPopup(
            `<div><p class="popup__title">${s.code}</p><p class="popup__meta">${s.name} · ${s.network}</p></div>`
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
            color: isDark ? "rgba(0,0,0,.6)" : "rgba(255,255,255,.9)",
            weight: 1,
            fillColor: color,
            fillOpacity: 0.45,
          })
            .bindPopup(
              `<div><p class="popup__title">M ${fmtMag(ev.magnitude)} · ${
                ev.region || ev.province || ""
              }</p><p class="popup__meta">${fmtDateTime(ev.origin_time)}</p><p class="popup__meta">Kedalaman ${fmtDepth(ev.depth_km)}</p></div>`,
              { maxWidth: 260 }
            )
            .addTo(extraGroup);
        });
    };

    renderArchive(extraLayers.archive5y, 0.6);
    renderArchive(extraLayers.archive3m, 0.7);
  }, [extraLayers, isDark, mapReady]);

  // Render earthquake circle markers + latest epicenter pulsing marker
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const quakesGroup = quakesGroupRef.current;
    if (!mapReady || !L || !map || !quakesGroup) return;

    quakesGroup.clearLayers();

    [...events]
      .sort((a, b) => a.magnitude - b.magnitude)
      .forEach((ev) => {
        const color = magColorHex(ev.magnitude, isDark);
        const marker = L.circleMarker([ev.latitude, ev.longitude], {
          radius: magRadius(ev.magnitude) * markerScale,
          color: isDark ? "rgba(0,0,0,.6)" : "rgba(255,255,255,.9)",
          weight: 1,
          fillColor: color,
          fillOpacity: faintMarkers ? 0.45 : 0.85,
        });

        if (onSelectEventRef.current) {
          marker.on("click", () => onSelectEventRef.current?.(ev));
        } else {
          marker.bindPopup(
            `<div><p class="popup__title">M ${fmtMag(ev.magnitude)} · ${
              ev.region || ev.province || ""
            }</p><p class="popup__meta">${fmtDateTime(ev.origin_time)}</p><p class="popup__meta">Kedalaman ${fmtDepth(ev.depth_km)}</p></div>`,
            { maxWidth: 260 }
          );
        }
        marker.addTo(quakesGroup);
      });

    // Latest marker with 3 pulsing rings + permanent dark "Terbaru · M4,9" callout
    latestMarkerRef.current?.remove();
    latestMarkerRef.current = null;

    if (latestEvent && (!selectedEvent || selectedEvent.event_id !== latestEvent.event_id)) {
      const color = magColorHex(latestEvent.magnitude, isDark);
      const accessibleLabel = `Episenter gempa terbaru M ${fmtMag(latestEvent.magnitude)} ${
        latestEvent.region || latestEvent.province || ""
      }`.trim();
      const divIcon = L.divIcon({
        className: "epicenter",
        html: `<div style="--c: ${color}; width: 80px; height: 80px; position: relative;"><span class="visually-hidden">${accessibleLabel}</span><span class="epicenter__ring"></span><span class="epicenter__ring"></span><span class="epicenter__ring"></span><span class="epicenter__core"></span></div>`,
        iconSize: [80, 80],
        iconAnchor: [40, 40],
      });

      const marker = L.marker([latestEvent.latitude, latestEvent.longitude], {
        icon: divIcon,
        title: accessibleLabel,
        alt: accessibleLabel,
        zIndexOffset: 1000,
      }).bindTooltip(`Terbaru · M${fmtMag(latestEvent.magnitude)}`, {
        permanent: true,
        direction: "top",
        offset: [0, -14],
        className: "latest-tip",
      });

      marker.on("click", () => {
        if (onSelectLatestRef.current) onSelectLatestRef.current(latestEvent);
        else if (onSelectEventRef.current) onSelectEventRef.current(latestEvent);
      });

      marker.addTo(map);
      const markerEl = marker.getElement();
      if (markerEl) {
        markerEl.setAttribute("aria-label", accessibleLabel);
      }
      latestMarkerRef.current = marker;

      if (centerOnLatest && hasCenteredRef.current !== latestEvent.event_id) {
        map.setView(
          [latestEvent.latitude, latestEvent.longitude],
          Math.round(latestZoom),
          { animate: false }
        );
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

  // Render picked event selection ring + flyTo
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;

    pickedMarkerRef.current?.remove();
    pickedMarkerRef.current = null;

    if (!selectedEvent) return;

    const isLatest = latestEvent?.event_id === selectedEvent.event_id;
    const color = magColorHex(selectedEvent.magnitude, isDark);
    const label = `${isLatest ? "Terbaru · " : ""}M${fmtMag(selectedEvent.magnitude)} · ${
      selectedEvent.region || selectedEvent.province || ""
    }`;

    const marker = L.marker([selectedEvent.latitude, selectedEvent.longitude], {
      icon: L.divIcon({
        className: "picked is-new",
        html: `<div style="--c: ${color}; width: 44px; height: 44px; position: relative;"><span class="picked__ring"></span><span class="picked__dot"></span></div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      }),
      keyboard: false,
      interactive: false,
      zIndexOffset: 2000,
    }).bindTooltip(label, {
      permanent: true,
      direction: "top",
      offset: [0, -20],
      className: "picked-tip",
    });

    marker.addTo(map);
    pickedMarkerRef.current = marker;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo(
      [selectedEvent.latitude, selectedEvent.longitude],
      Math.max(Math.round(map.getZoom()), 6),
      { duration: reduce ? 0 : 0.6 }
    );
  }, [selectedEvent, latestEvent, isDark, mapReady]);

  return (
    <div
      id={id}
      className={`${className} map-host`}
      role="region"
      aria-label={ariaLabel}
    >
      <div ref={containerRef} className="map-canvas" />
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
