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
const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ESRI = "Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors";
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
        maxZoom: 16,
        worldCopyJump: true,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        preferCanvas: true,
        scrollWheelZoom,
        zoomControl: false,
        attributionControl: true,
      });

      const labelsPane = map.createPane("labels");
      labelsPane.style.zIndex = "350";
      labelsPane.style.pointerEvents = "none";

      const darkNow = document.documentElement.dataset.theme === "dark";
      const canvasBase = L.tileLayer(canvasUrl(darkNow, "Base"), {
        attribution: ESRI,
        maxZoom: 16,
      });
      const canvasLabels = L.tileLayer(canvasUrl(darkNow, "Reference"), {
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
          thumb: () =>
            `${ESRI_ROOT}/Canvas/World_${
              document.documentElement.dataset.theme === "dark" ? "Dark" : "Light"
            }_Gray_Base/MapServer/tile/4/8/13`,
        },
        {
          key: "streets",
          label: "Jalan",
          layer: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: OSM,
            maxZoom: 19,
          }),
          thumb: () => "https://tile.openstreetmap.org/4/13/8.png",
        },
        {
          key: "satellite",
          label: "Satelit",
          layer: L.tileLayer(`${ESRI_ROOT}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, {
            attribution: "Tiles &copy; Esri",
            maxZoom: 18,
          }),
          thumb: () => `${ESRI_ROOT}/World_Imagery/MapServer/tile/4/8/13`,
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

      // Custom BasemapControl identical to ridwaanhall/gempa
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
            opt.innerHTML = `<img src="${item.thumb()}" alt="" loading="lazy" width="44" height="44" referrerpolicy="no-referrer" /><span>${item.label}</span>${iconHTML("check", "icon basemap__check")}`;
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
          document.addEventListener("click", (e) => {
            if (!wrap.contains(e.target as Node)) setOpen(false);
          });
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

      if (fitArchipelago) {
        map.fitBounds(INDONESIA_BOUNDS, { animate: false });
      }

      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(el);
      setMapReady(true);
    }

    init();

    return () => {
      cancelled = true;
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
    if (containerRef.current) {
      const img = containerRef.current.querySelector('[data-base="neutral"] img');
      if (img) {
        img.setAttribute(
          "src",
          `${ESRI_ROOT}/Canvas/World_${isDark ? "Dark" : "Light"}_Gray_Base/MapServer/tile/4/8/13`
        );
      }
    }
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
      const divIcon = L.divIcon({
        className: "epicenter",
        html: `<div style="--c: ${color}; width: 80px; height: 80px; position: relative;"><span class="epicenter__ring"></span><span class="epicenter__ring"></span><span class="epicenter__ring"></span><span class="epicenter__core"></span></div>`,
        iconSize: [80, 80],
        iconAnchor: [40, 40],
      });

      const marker = L.marker([latestEvent.latitude, latestEvent.longitude], {
        icon: divIcon,
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
      Math.max(map.getZoom(), 6),
      { duration: reduce ? 0 : 0.6 }
    );
  }, [selectedEvent, latestEvent, isDark, mapReady]);

  return (
    <div
      ref={containerRef}
      id={id}
      className={className}
      role="region"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
