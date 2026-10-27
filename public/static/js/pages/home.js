/** Home: latest felt earthquake (dial) + map + realtime summary + recent detections. */

import { every, getJSON } from "../lib/api.js";
import { showEarthquake, showRealtime } from "../lib/detail.js";
import { $, h, replace } from "../lib/dom.js";
import { fmtCoords, fmtDepth, fmtLong, fmtMag, fmtNumber, fmtRelative, parseFelt } from "../lib/format.js";
import { renderWeeklyChart } from "../lib/chart.js";
import { initialData } from "../lib/initial.js";
import { createMap, latestMarker, quakeMarker, selection } from "../lib/map.js";
import { dial, errorNote, eventItem, facts } from "../lib/ui.js";

const L = window.L;
const DAY = 86400000;
const map = createMap($("#latest-map"), { scrollWheelZoom: false });
const recentLayer = L.layerGroup().addTo(map);
let epicenter = null;
const pick = selection(map);

/** Highlight a detection on the home map and open its detail. */
function openRealtime(ev) {
  pick.show(ev, { zoom: 5 });
  showRealtime(ev, { onPick: openRealtime });
}

const openFelt = (eq) => {
  pick.clear();
  map.flyTo([eq.latitude, eq.longitude], Math.max(map.getZoom(), 6), { duration: 0.8 });
  showEarthquake(eq, { onPick: openRealtime });
};
let shownEventId = null;

/* ---------- Latest felt earthquake ---------- */

function renderLatest(eq) {
  replace($("#latest-dial"), dial(eq.magnitude));
  replace($("#latest-title"), eq.region);
  replace($("#latest-time"), fmtLong(eq.origin_time), " · ", h("span", { "data-rel-time": eq.origin_time }, fmtRelative(eq.origin_time)));

  const felt = parseFelt(eq.felt);
  replace(
    $("#latest-facts"),
    facts([
      ["Kedalaman", fmtDepth(eq.depth_km)],
      ["Koordinat", fmtCoords(eq.latitude, eq.longitude)],
      ["Potensi tsunami", eq.tsunami_potential ? h("strong", { style: { color: "var(--accent-ink)" } }, "Berpotensi tsunami") : "Tidak berpotensi"],
      ["Dirasakan", felt.length ? felt.map((f) => `${f.intensity} ${f.place}`).join(", ") : "–"],
    ]),
  );

  replace(
    $("#latest-actions"),
    h("button", { class: "btn btn--accent", type: "button", onclick: () => openFelt(eq) }, "Detail & peta guncangan"),
    h("a", { class: "btn", href: "/felt/" }, "Gempa dirasakan lainnya"),
  );

  if (shownEventId !== eq.event_id) {
    epicenter?.remove();
    epicenter = latestMarker(eq, { onClick: () => openFelt(eq) }).addTo(map);
    map.setView([eq.latitude, eq.longitude], 6, { animate: false });
    shownEventId = eq.event_id;
  }
}

/* ---------- Summary tiles ---------- */

function stat(label, value, note) {
  return h("div", { class: "stat" }, h("p", { class: "stat__label" }, label), h("p", { class: "stat__value" }, value), h("p", { class: "stat__note" }, note || " "));
}

function renderSummary(realtime, significant, tsunami) {
  const now = Date.now();
  const day = realtime.filter((e) => now - new Date(e.origin_time) < DAY);
  const strongest = day.reduce((a, b) => (!a || b.magnitude > a.magnitude ? b : a), null);
  const m5week = significant ? significant.filter((e) => now - new Date(e.origin_time) < 7 * DAY) : null;
  const active = tsunami?.find((e) => !e.ended && now - new Date(e.origin_time) < DAY);
  const lastTsunami = tsunami?.[0];

  replace(
    $("#summary"),
    stat("Gempa 24 jam", fmtNumber(day.length), "terdeteksi otomatis"),
    stat("Terkuat 24 jam", strongest ? fmtMag(strongest.magnitude) : "–", strongest?.region),
    stat("M5+ 7 hari", m5week ? fmtNumber(m5week.length) : "–", m5week?.[0] ? `terakhir ${fmtRelative(m5week[0].origin_time)}` : "di wilayah Indonesia"),
    stat(
      "Status tsunami",
      tsunami ? (active ? h("span", { style: { color: "var(--accent-ink)" } }, "Aktif") : "Aman") : "–",
      active ? active.region : lastTsunami ? `peringatan terakhir ${fmtRelative(lastTsunami.origin_time)}` : "",
    ),
  );
}

/* ---------- Recent detections ---------- */

function renderRecent(realtime) {
  replace(
    $("#recent-list"),
    realtime.slice(0, 8).map((ev) => eventItem(ev, { flag: ev.magnitude >= 5 ? "M5+" : "", onClick: () => openRealtime(ev) })),
  );
  recentLayer.clearLayers();
  realtime
    .filter((e) => Date.now() - new Date(e.origin_time) < 2 * DAY)
    .sort((a, b) => a.magnitude - b.magnitude)
    .forEach((ev) => quakeMarker(ev, { faint: true }).addTo(recentLayer));
}

/* ---------- Loading ---------- */

async function loadLatest() {
  try {
    const { data } = await getJSON("/api/v1/earthquakes/latest");
    renderLatest(data);
  } catch (err) {
    if (!shownEventId) replace($("#latest-time"), errorNote(err.message));
  }
}

async function loadRealtime() {
  const [rt, sig, ts] = await Promise.allSettled([
    getJSON("/api/v1/earthquakes/realtime"),
    getJSON("/api/v1/earthquakes/significant"),
    getJSON("/api/v1/tsunami"),
  ]);
  if (rt.status !== "fulfilled") {
    if (!$("#recent-list").children.length) replace($("#recent-list"), h("li", {}, errorNote(rt.reason.message)));
    return;
  }
  renderSummary(rt.value.data, sig.value?.data, ts.value?.data);
  renderRecent(rt.value.data);
  document.dispatchEvent(new Event("gempa:rendered"));
}

const initial = initialData();
if (initial) {
  renderLatest(initial.latest);
  renderRecent(initial.realtime);
  document.dispatchEvent(new Event("gempa:rendered"));
} else {
  loadLatest();
}
loadRealtime();

async function loadChart() {
  try {
    const { data } = await getJSON("/api/v1/earthquakes/archive/3m");
    const stats = renderWeeklyChart($("#weekly-chart"), data);
    if (stats) {
      $("#chart-hint").textContent = `${fmtNumber(stats.total)} gempa M4,5+ · rata-rata ${fmtNumber(Math.round(stats.average))} per minggu`;
    }
  } catch (err) {
    replace($("#weekly-chart"), errorNote(err.message));
  }
}
loadChart();
every(60000, () => Promise.all([loadLatest(), loadRealtime()]));
