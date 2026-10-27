/**
 * Leaflet wrapper. Leaflet (global `L`) is loaded as a classic deferred script
 * before these modules run.
 */

import { h } from "./dom.js";
import { icon, iconHTML } from "./icons.js";
import { cssVar, fmtDateTime, fmtDepth, fmtMag, magColor } from "./format.js";

const L = window.L;

export const INDONESIA = { center: [-2.6, 118.0], zoom: 5 };

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ESRI = "Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors";
const ESRI_ROOT = "https://server.arcgisonline.com/ArcGIS/rest/services";
const canvasUrl = (dark, kind) =>
  `${ESRI_ROOT}/Canvas/World_${dark ? "Dark" : "Light"}_Gray_${kind}/MapServer/tile/{z}/{y}/{x}`;

const isDark = () => document.documentElement.dataset.theme === "dark";

/** Basemap switcher: raised round button that opens a small menu of thumbnails. */
const BasemapControl = L.Control.extend({
  onAdd(map) {
    const { base } = this.options;
    let current = base[0];
    const wrap = h("div", { class: "leaflet-control basemap" });
    const button = h(
      "button",
      { class: "map-btn", type: "button", "aria-label": "Pilih peta dasar", "aria-expanded": "false", "aria-haspopup": "menu", title: "Peta dasar" },
      icon("layers"),
    );
    const setOpen = (open) => {
      wrap.dataset.open = String(open);
      button.setAttribute("aria-expanded", String(open));
    };
    const options = base.map((item) =>
      h(
        "button",
        {
          class: "basemap__opt", type: "button", role: "menuitemradio", "data-base": item.key,
          "aria-checked": String(item === current),
          onclick: () => {
            if (item !== current) {
              map.removeLayer(current.layer);
              item.layer.addTo(map);
              current = item;
              options.forEach((o) => o.setAttribute("aria-checked", String(o.dataset.base === item.key)));
            }
            setOpen(false);
            button.focus();
          },
        },
        h("img", { src: item.thumb(), alt: "", loading: "lazy", width: 44, height: 44 }),
        h("span", {}, item.label),
        icon("check", "icon basemap__check"),
      ),
    );
    const menu = h("div", { class: "basemap__menu", role: "menu", "aria-label": "Peta dasar" }, options);
    wrap.append(button, menu);
    setOpen(false);

    button.addEventListener("click", () => setOpen(wrap.dataset.open !== "true"));
    document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) setOpen(false); });
    wrap.addEventListener("keydown", (e) => { if (e.key === "Escape") { setOpen(false); button.focus(); } });
    L.DomEvent.disableClickPropagation(wrap);
    L.DomEvent.disableScrollPropagation(wrap);
    return wrap;
  },
});

export function createMap(element, { center = INDONESIA.center, zoom, scrollWheelZoom = true, zoomPosition = "topleft" } = {}) {
  const narrow = window.matchMedia("(max-width: 639px)").matches;
  const map = L.map(element, {
    center,
    zoom: zoom ?? (narrow ? INDONESIA.zoom - 1 : INDONESIA.zoom),
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

  // Place labels sit above tiles but below data.
  const labelsPane = map.createPane("labels");
  labelsPane.style.zIndex = "350";
  labelsPane.style.pointerEvents = "none";

  // Neutral grey canvas (+ labels) that follows the site theme; no API key needed.
  const canvasBase = L.tileLayer(canvasUrl(isDark(), "Base"), { attribution: ESRI, maxZoom: 16 });
  const canvasLabels = L.tileLayer(canvasUrl(isDark(), "Reference"), { maxZoom: 16, pane: "labels" });
  const base = [
    { key: "neutral", label: "Netral", layer: L.layerGroup([canvasBase, canvasLabels]),
      thumb: () => `${ESRI_ROOT}/Canvas/World_${isDark() ? "Dark" : "Light"}_Gray_Base/MapServer/tile/4/8/13` },
    { key: "streets", label: "Jalan", layer: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: OSM, maxZoom: 19 }),
      thumb: () => "https://tile.openstreetmap.org/4/13/8.png" },
    { key: "satellite", label: "Satelit", layer: L.tileLayer(`${ESRI_ROOT}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, { attribution: "Tiles &copy; Esri", maxZoom: 18 }),
      thumb: () => `${ESRI_ROOT}/World_Imagery/MapServer/tile/4/8/13` },
  ];  // fmt: skip
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
  new BasemapControl({ position: "topright", base }).addTo(map);
  map.attributionControl.setPrefix(false);

  // Keep the neutral basemap in sync with the site theme.
  document.addEventListener("gempa:theme", (e) => {
    // Let the theme transition wait for the re-themed tiles (bounded in app.js).
    if (map.hasLayer(canvasBase)) e.detail?.waits?.push(new Promise((r) => canvasBase.once("load", r)));
    canvasBase.setUrl(canvasUrl(isDark(), "Base"));
    element.querySelector('[data-base="neutral"] img')?.setAttribute("src", base[0].thumb());
    canvasLabels.setUrl(canvasUrl(isDark(), "Reference"));
  });

  // Maps inside hidden/resized containers need a nudge.
  new ResizeObserver(() => map.invalidateSize()).observe(element);
  return map;
}

export const magRadius = (m) => Math.max(3, 2.5 + (m - 2) * 2.4);

/** Circle marker coloured and sized by magnitude. */
export function quakeMarker(event, { popup = true, faint = false, scale = 1 } = {}) {
  const color = magColor(event.magnitude);
  const marker = L.circleMarker([event.latitude, event.longitude], {
    radius: magRadius(event.magnitude) * scale,
    color: isDark() ? "rgba(0,0,0,.6)" : "rgba(255,255,255,.9)",
    weight: 1,
    fillColor: color,
    fillOpacity: faint ? 0.45 : 0.85,
  });
  if (popup) marker.bindPopup(() => quakePopup(event), { maxWidth: 260 });
  return marker;
}

export function quakePopup(event, { action } = {}) {
  return h(
    "div",
    {},
    h("p", { class: "popup__title" }, `M ${fmtMag(event.magnitude)} · ${event.region || event.province || ""}`),
    h("p", { class: "popup__meta" }, fmtDateTime(event.origin_time)),
    h("p", { class: "popup__meta" }, `Kedalaman ${fmtDepth(event.depth_km)}`),
    action ? h("a", { href: "#", class: "popup__link", onclick: (e) => { e.preventDefault(); action(); } }, "Lihat detail", icon("arrow-right")) : null,
  );
}

/** Pulsing epicentre marker for the single most important event. */
export function epicenterMarker(lat, lon, magnitude) {
  const icon = L.divIcon({
    className: "epicenter",
    html: '<span class="epicenter__ring"></span><span class="epicenter__ring"></span><span class="epicenter__ring"></span><span class="epicenter__core"></span>',
    iconSize: [80, 80],
    iconAnchor: [40, 40],
  });
  const marker = L.marker([lat, lon], { icon, keyboard: false, zIndexOffset: 1000 });
  marker.on("add", () => marker.getElement()?.style.setProperty("--c", magColor(magnitude)));
  return marker;
}

/**
 * Highlight the most recent event: pulsing epicentre + a permanent "Terbaru" label.
 * Returns the marker so pages can replace it when data refreshes.
 */
export function latestMarker(event, { onClick } = {}) {
  const marker = epicenterMarker(event.latitude, event.longitude, event.magnitude);
  marker.bindTooltip(`Terbaru · M${fmtMag(event.magnitude)}`, {
    permanent: true, direction: "top", offset: [0, -14], className: "latest-tip",
  });
  if (onClick) marker.on("click", onClick);
  else marker.bindPopup(() => quakePopup(event), { maxWidth: 260, offset: [0, -8] });
  // Register as this map's "latest" so a selection of the same event can stand in for it
  // (one marker, not two). Pages recreate this marker on refresh, so check on every add.
  marker.eventId = event.event_id;
  marker.on("add", () => {
    const map = marker._map;
    map._latestMarker = marker;
    if (map._pickedId === event.event_id) setTimeout(() => marker.remove());
  });
  return marker;
}

/**
 * Highlight the event the user picked from a list: a ring + label that moves to it,
 * with a smooth fly-to. One controller per map.
 */
export function selection(map) {
  let marker = null;
  // After the detail sheet closes, bring the map back into view so the pick is visible
  // (on phones the map sits above a long list).
  document.addEventListener("gempa:sheet-closed", () => {
    if (!marker || !map.hasLayer(marker)) return;
    const r = map.getContainer().getBoundingClientRect();
    if (r.bottom < 80 || r.top > window.innerHeight - 80) {
      map.getContainer().scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
  return {
    show(event, { zoom = 6, fly = true } = {}) {
      const latlng = [event.latitude, event.longitude];
      // If the pick is the latest event, the pick replaces the "Terbaru" marker and says so.
      const latest = map._latestMarker;
      const isLatest = latest?.eventId === event.event_id;
      map._pickedId = event.event_id;
      if (isLatest) latest.remove();
      else if (latest && !map.hasLayer(latest)) latest.addTo(map);
      const label = `${isLatest ? "Terbaru · " : ""}M${fmtMag(event.magnitude)} · ${event.region || event.province || ""}`;
      if (!marker) {
        marker = L.marker(latlng, {
          icon: L.divIcon({ className: "picked", html: '<span class="picked__ring"></span><span class="picked__dot"></span>', iconSize: [44, 44], iconAnchor: [22, 22] }),
          keyboard: false,
          interactive: false,
          zIndexOffset: 2000,
        }).bindTooltip("", { permanent: true, direction: "top", offset: [0, -20], className: "picked-tip" });
      }
      marker.setLatLng(latlng).setTooltipContent(label);
      if (!map.hasLayer(marker)) marker.addTo(map);
      marker.getElement()?.style.setProperty("--c", magColor(event.magnitude));
      // Re-trigger the "landing" animation on every pick.
      const el = marker.getElement();
      if (el) { el.classList.remove("is-new"); void el.offsetWidth; el.classList.add("is-new"); }
      if (fly) {
        const target = Math.max(map.getZoom(), zoom);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        map.flyTo(latlng, target, { duration: reduce ? 0 : 0.8 });
      }
    },
    clear() {
      marker?.remove();
      map._pickedId = null;
      const latest = map._latestMarker;
      if (latest && !map.hasLayer(latest)) latest.addTo(map);
    },
  };
}

/** Re-apply a style when the site theme changes (colours come from CSS tokens). */
function followTheme(layer, style) {
  document.addEventListener("gempa:theme", () => layer.setStyle(style()));
  return layer;
}

export function faultLayer(geojson, { weight = 1.2 } = {}) {
  const style = () => ({ color: cssVar("--accent"), weight, opacity: 0.7 });
  return followTheme(L.geoJSON(geojson, { interactive: false, style: style() }), style);
}

export function stationLayer(stations) {
  const style = () => {
    const color = cssVar("--ink-2");
    return { radius: 3, weight: 1, color, fillColor: color, fillOpacity: 0.35 };
  };
  const group = L.featureGroup(
    stations.map((s) =>
      L.circleMarker([s.latitude, s.longitude], style()).bindPopup(() =>
        h("div", {}, h("p", { class: "popup__title" }, s.code), h("p", { class: "popup__meta" }, `${s.name} · ${s.network}`)),
      ),
    ),
  );
  return followTheme(group, style);
}

/** Fit to markers but never zoom in so far the context is lost. */
export function fitTo(map, latlngs, maxZoom = 7) {
  if (!latlngs.length) return;
  const bounds = L.latLngBounds(latlngs);
  map.fitBounds(bounds.pad(0.15), { maxZoom, animate: false });
}

/** Frame the Indonesian archipelago (lists here are Indonesian events; far outliers are ignored). */
export const INDONESIA_BOUNDS = [[-11.5, 94.5], [6.5, 141.5]];

export function fitIndonesia(map) {
  map.fitBounds(INDONESIA_BOUNDS, { animate: false });
}
