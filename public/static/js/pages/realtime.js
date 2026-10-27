/** Realtime: filterable, sortable table of detections linked to the map. */

import { every, getJSON } from "../lib/api.js";
import { showRealtime } from "../lib/detail.js";
import { $, $$, debounce, h, matches, replace } from "../lib/dom.js";
import { fmtDateTime, fmtDepth, fmtNumber, fmtRelative } from "../lib/format.js";
import { initialData } from "../lib/initial.js";
import { createMap, latestMarker, quakeMarker, selection } from "../lib/map.js";
import { empty, errorNote, linkedId, magBadge, sortable } from "../lib/ui.js";

const L = window.L;
const map = createMap($("#map"));
const layer = L.layerGroup().addTo(map);
const markers = new Map();
const pick = selection(map);
let latest = null;
const newest = (list) => list.reduce((a, b) => (!a || b.origin_time > a.origin_time ? b : a), null);

const state = { events: [], min: 0, query: "", selected: null, centered: false };
const table = sortable($("#table"), { key: "origin_time", dir: "desc", onChange: render });

function visible() {
  return table.sort(state.events.filter((e) => e.magnitude >= state.min && matches(e.region, state.query)));
}

function select(ev, { open = true } = {}) {
  state.selected = ev.event_id;
  $$("#rows tr[aria-selected]").forEach((tr) => tr.setAttribute("aria-selected", String(tr.dataset.id === ev.event_id)));
  pick.show(ev);
  state.centered = true;
  if (open) showRealtime(ev, { onPick: (other) => select(other) });
}

function render() {
  const rows = visible();
  $("#count").textContent = `${fmtNumber(rows.length)} dari ${fmtNumber(state.events.length)} kejadian`;

  replace(
    $("#rows"),
    rows.length
      ? rows.map((ev) =>
          h(
            "tr",
            { "data-id": ev.event_id, "aria-selected": String(ev.event_id === state.selected), tabindex: "0",
              onclick: () => select(ev),
              onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(ev); } } },
            h("td", { class: "num" }, magBadge(ev.magnitude, "sm")),
            h("td", { class: "nowrap" }, h("span", { class: "mono" }, fmtDateTime(ev.origin_time).replace(" WIB", "")), h("div", { class: "xsmall muted" }, h("time", { datetime: ev.origin_time, "data-rel-time": ev.origin_time }, fmtRelative(ev.origin_time)))),
            h("td", { class: "wrap" }, ev.region),
            h("td", { class: "num mono" }, fmtDepth(ev.depth_km)),
          ),
        )
      : h("tr", {}, h("td", { colspan: 4 }, empty("Tidak ada kejadian", "Ubah filter atau kata kunci pencarian."))),
  );

  layer.clearLayers();
  markers.clear();
  // Draw small first so bigger events stay on top.
  [...rows].sort((a, b) => a.magnitude - b.magnitude).forEach((ev) => {
    const marker = quakeMarker(ev, { popup: false }).addTo(layer);
    marker.on("click", () => select(ev));
    markers.set(ev.event_id, marker);
  });
  // The most recent detection gets a pulsing, labelled marker; centre on it on first load.
  latest?.remove();
  const last = newest(rows);
  if (last) {
    latest = latestMarker(last, { onClick: () => select(last) }).addTo(map);
    if (!state.centered) {
      map.setView([last.latitude, last.longitude], 5, { animate: false });
      state.centered = true;
    }
  }
  document.dispatchEvent(new Event("gempa:rendered"));
}

$$("#mag-filter button").forEach((btn) =>
  btn.addEventListener("click", () => {
    state.min = Number(btn.dataset.min);
    $$("#mag-filter button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    render();
  }),
);
$("#search").addEventListener("input", debounce((e) => { state.query = e.target.value.trim(); render(); }, 150));

function setEvents(data) {
  state.events = data;
  const oldest = data.at(-1);
  replace(
    $("#page-meta"),
    h("span", { class: "chip" }, `${fmtNumber(data.length)} deteksi`),
    oldest ? h("span", { class: "chip" }, `sejak ${fmtDateTime(oldest.origin_time)}`) : null,
  );
  render();
  openLinked();
}

/** Open the event named in the URL (#e=<id>) once, e.g. from a shared link. */
let linkHandled = false;
function openLinked() {
  if (linkHandled) return;
  linkHandled = true;
  const id = linkedId();
  const ev = id && state.events.find((e) => e.event_id === id);
  if (ev) select(ev);
}

async function load() {
  try {
    const { data } = await getJSON("/api/v1/earthquakes/realtime?limit=500");
    setEvents(data);
  } catch (err) {
    if (!state.events.length) replace($("#rows"), h("tr", {}, h("td", { colspan: 4 }, errorNote(err.message))));
  }
}

const initial = initialData();
if (initial) setEvents(initial.events);
else load();
every(60000, load);
