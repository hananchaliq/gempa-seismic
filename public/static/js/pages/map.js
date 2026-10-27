/** Seismicity map: toggleable layers, each fetched lazily the first time it is enabled. */

import { getJSON } from "../lib/api.js";
import { $, $$ } from "../lib/dom.js";
import { fmtNumber } from "../lib/format.js";
import { createMap, faultLayer, fitIndonesia, latestMarker, quakeMarker, stationLayer } from "../lib/map.js";

const L = window.L;
const map = createMap($("#map"), { zoomPosition: "bottomright" });
fitIndonesia(map);

// Keep map gestures from leaking into the panel on touch devices.
L.DomEvent.disableClickPropagation($("#layers"));
L.DomEvent.disableScrollPropagation($("#layers"));
if (window.matchMedia("(max-width: 639px)").matches) $("#layers").open = false;

const quakes = (events, faint, scale = 1) => {
  const group = L.layerGroup();
  [...events].sort((a, b) => a.magnitude - b.magnitude).forEach((ev) => quakeMarker(ev, { faint, scale }).addTo(group));
  return group;
};

const LAYERS = {
  realtime: async () => {
    const { data } = await getJSON("/api/v1/earthquakes/realtime?limit=500");
    const group = quakes(data);
    if (data[0]) latestMarker(data[0]).addTo(group); // feed is sorted newest first
    return [group, data.length];
  },
  archive3m: async () => {
    const { data } = await getJSON("/api/v1/earthquakes/archive/3m");
    return [quakes(data, true, 0.7), data.length];
  },
  archive5y: async () => {
    const { data } = await getJSON("/api/v1/earthquakes/archive/5y");
    return [quakes(data, true, 0.6), data.length];
  },
  faultsIndonesia: async () => {
    const geojson = await getJSON("/api/v1/faults/indonesia");
    return [faultLayer(geojson), geojson.features.length];
  },
  faultsGlobal: async () => {
    const geojson = await getJSON("/api/v1/faults/global");
    return [faultLayer(geojson, { weight: 1 }), geojson.features.length];
  },
  stationsIndonesia: async () => {
    const { data } = await getJSON("/api/v1/stations/indonesia");
    return [stationLayer(data), data.length];
  },
  stationsGlobal: async () => {
    const { data } = await getJSON("/api/v1/stations/global");
    return [stationLayer(data), data.length];
  },
};

// Draw order: faults under stations under quakes.
const Z = { faultsGlobal: 1, faultsIndonesia: 2, stationsGlobal: 3, stationsIndonesia: 4, archive5y: 5, archive3m: 6, realtime: 7 };
const loaded = new Map();
const status = $("#layer-status");

async function toggle(name, on) {
  if (!on) {
    loaded.get(name)?.remove();
    return;
  }
  if (!loaded.has(name)) {
    status.textContent = "Memuat lapisan…";
    try {
      const [layer, count] = await LAYERS[name]();
      loaded.set(name, layer);
      $(`[data-count="${name}"]`).textContent = fmtNumber(count);
      status.textContent = "";
    } catch (err) {
      status.textContent = err.message;
      $(`[data-layer="${name}"]`).checked = false;
      return;
    }
  }
  if (!$(`[data-layer="${name}"]`).checked) return; // unticked while loading
  loaded.get(name).addTo(map);
  // Re-add higher layers so they stay on top.
  Object.keys(Z)
    .filter((k) => Z[k] > Z[name] && loaded.has(k) && $(`[data-layer="${k}"]`).checked)
    .sort((a, b) => Z[a] - Z[b])
    .forEach((k) => loaded.get(k).remove().addTo(map));
}

const countActive = () => {
  $("#active-count").textContent = $$("[data-layer]").filter((i) => i.checked).length;
};

$$("[data-layer]").forEach((input) => {
  input.addEventListener("change", () => {
    countActive();
    toggle(input.dataset.layer, input.checked);
  });
  if (input.checked) toggle(input.dataset.layer, true);
});
