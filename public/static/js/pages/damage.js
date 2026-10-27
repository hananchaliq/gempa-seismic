/** Damaging earthquakes catalogue: stats, map, filterable + paginated table. */

import { getJSON } from "../lib/api.js";
import { showDamaging } from "../lib/detail.js";
import { $, debounce, h, matches, replace } from "../lib/dom.js";
import { fmtDepth, fmtMag, fmtNumber, fmtUtcDate } from "../lib/format.js";
import { icon } from "../lib/icons.js";
import { createMap, fitIndonesia, latestMarker, quakeMarker, selection } from "../lib/map.js";
import { empty, errorNote, linkedId, magBadge, pill, sortable } from "../lib/ui.js";

const L = window.L;
const PAGE_SIZE = 25;
const map = createMap($("#map"), { scrollWheelZoom: false });
const layer = L.layerGroup().addTo(map);
const pick = selection(map);

function open(ev) {
  pick.show(ev, { zoom: 6 });
  showDamaging(ev);
}
let latest = null;
const newest = (list) => list.reduce((a, b) => (!a || b.origin_time > a.origin_time ? b : a), null);
const state = { events: [], query: "", period: "", tsunami: false, page: 0, fitted: false };
const table = sortable($("#table"), { key: "origin_time", dir: "desc", onChange: () => { state.page = 0; render(); } });

const year = (ev) => new Date(ev.origin_time).getUTCFullYear();

function stat(label, value, note) {
  return h("div", { class: "stat" }, h("p", { class: "stat__label" }, label), h("p", { class: "stat__value" }, value), h("p", { class: "stat__note" }, note || " "));
}

function filtered() {
  return state.events.filter((ev) => {
    if (state.tsunami && !ev.tsunami) return false;
    if (state.period) {
      const decade = Number(state.period);
      if (year(ev) < decade || year(ev) >= decade + 10) return false;
    }
    return matches(`${ev.province} ${ev.epicenter} ${ev.impact ?? ""}`, state.query);
  });
}

function renderPager(total) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  state.page = Math.min(state.page, pages - 1);
  const go = (p) => { state.page = p; render(); $("#table").scrollIntoView({ block: "start", behavior: "smooth" }); };
  replace(
    $("#pager"),
    h("span", {}, total ? `${fmtNumber(state.page * PAGE_SIZE + 1)}–${fmtNumber(Math.min(total, (state.page + 1) * PAGE_SIZE))} dari ${fmtNumber(total)}` : ""),
    pages > 1
      ? h(
          "span",
          { class: "pager__btns" },
          h("button", { class: "btn btn--sm", type: "button", disabled: state.page === 0, onclick: () => go(state.page - 1) }, icon("arrow-left"), "Sebelumnya"),
          h("button", { class: "btn btn--sm", type: "button", disabled: state.page >= pages - 1, onclick: () => go(state.page + 1) }, "Berikutnya", icon("arrow-right")),
        )
      : null,
  );
}

function render() {
  const rows = table.sort(filtered());
  $("#count").textContent = `${fmtNumber(rows.length)} kejadian`;
  renderPager(rows.length);
  const page = rows.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);

  replace(
    $("#rows"),
    page.length
      ? page.map((ev) =>
          h(
            "tr",
            { "data-id": ev.event_id, tabindex: "0", onclick: () => open(ev),
              onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(ev); } } },
            h("td", { class: "num" }, magBadge(ev.magnitude, "sm")),
            h("td", { class: "nowrap mono" }, fmtUtcDate(ev.origin_time)),
            h("td", {}, h("strong", {}, ev.province), h("div", { class: "xsmall muted" }, ev.epicenter), ev.tsunami ? h("div", { class: "mt-2" }, pill("Tsunami", "signal")) : null),
            h("td", { class: "wrap small" }, ev.impact ? (ev.impact.length > 140 ? `${ev.impact.slice(0, 140)}…` : ev.impact) : h("span", { class: "muted" }, "–")),
            h("td", { class: "num mono" }, fmtDepth(ev.depth_km)),
          ),
        )
      : h("tr", {}, h("td", { colspan: 5 }, empty("Tidak ada kejadian", "Ubah filter atau kata kunci pencarian."))),
  );

  layer.clearLayers();
  [...rows].sort((a, b) => a.magnitude - b.magnitude).forEach((ev) => {
    quakeMarker(ev, { popup: false, scale: 0.6 }).on("click", () => open(ev)).addTo(layer);
  });
  latest?.remove();
  const last = newest(rows);
  if (last) latest = latestMarker(last, { onClick: () => open(last) }).addTo(map);
  if (!state.fitted && rows.length) {
    fitIndonesia(map);
    state.fitted = true;
  }
}

function renderSummary(events) {
  const years = events.map(year);
  const biggest = events.reduce((a, b) => (b.magnitude > a.magnitude ? b : a), events[0]);
  const withTsunami = events.filter((e) => e.tsunami).length;
  replace(
    $("#summary"),
    stat("Kejadian", fmtNumber(events.length), "gempa merusak tercatat"),
    stat("Memicu tsunami", fmtNumber(withTsunami), `${Math.round((withTsunami / events.length) * 100)}% dari seluruh kejadian`),
    stat("Magnitudo terbesar", fmtMag(biggest.magnitude), `${biggest.province}, ${year(biggest)}`),
    stat("Rentang tahun", `${Math.min(...years)}–${Math.max(...years)}`, "berdasarkan waktu UTC"),
  );

  const decades = [...new Set(years.map((y) => Math.floor(y / 10) * 10))].sort((a, b) => b - a);
  const select = $("#period");
  decades.forEach((d) => select.append(h("option", { value: d }, `${d}–${d + 9}`)));
}

$("#search").addEventListener("input", debounce((e) => { state.query = e.target.value.trim(); state.page = 0; render(); }, 150));
$("#period").addEventListener("change", (e) => { state.period = e.target.value; state.page = 0; render(); });
$("#only-tsunami").addEventListener("change", (e) => { state.tsunami = e.target.checked; state.page = 0; render(); });

try {
  const { data } = await getJSON("/api/v1/earthquakes/damaging");
  state.events = data;
  if (data.length) renderSummary(data);
  render();
  const linked = linkedId() && data.find((e) => e.event_id === linkedId());
  if (linked) open(linked);
} catch (err) {
  replace($("#rows"), h("tr", {}, h("td", { colspan: 5 }, errorNote(err.message))));
}
