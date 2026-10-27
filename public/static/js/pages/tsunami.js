/** Tsunami: one card per earthquake with bulletin timeline, warning zones, observations, maps. */

import { every, getJSON } from "../lib/api.js";
import { $, h, replace } from "../lib/dom.js";
import {
  fmtClock, fmtCoords, fmtDateTime, fmtDepth, fmtLong, fmtMeters, fmtNumber, fmtRelative,
} from "../lib/format.js";
import { initialData } from "../lib/initial.js";
import { empty, errorNote, facts, levelPill, magBadge, pill } from "../lib/ui.js";
import { mediaViewer } from "../lib/viewer.js";

const LEVELS = [
  ["AWAS", "--lv-awas"],
  ["SIAGA", "--lv-siaga"],
  ["WASPADA", "--lv-waspada"],
];

/** Zones from the latest bulletin that has any (PD-4 "ended" bulletins carry none). */
const latestWithZones = (ev) => ev.bulletins.find((b) => b.warning_zones.length);

/** Observations accumulate across PD-3.x bulletins; the latest one with data is the most complete. */
const latestWithObservations = (ev) => ev.bulletins.find((b) => b.observations.length);

function levelBars(zones) {
  const total = zones.length || 1;
  return h(
    "div",
    { class: "level-bars" },
    LEVELS.map(([level, color]) => {
      const n = zones.filter((z) => z.level === level).length;
      return h(
        "div",
        { class: "level-bar" },
        levelPill(level),
        h("span", { class: "level-bar__track" }, h("span", { class: "level-bar__fill", style: { width: `${(n / total) * 100}%`, "--c": `var(${color})` } })),
        h("span", { class: "mono small", style: { textAlign: "right" } }, fmtNumber(n)),
      );
    }),
  );
}

function zonesTable(zones) {
  const order = { AWAS: 0, SIAGA: 1, WASPADA: 2 };
  const sorted = [...zones].sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9) || a.province.localeCompare(b.province));
  return h(
    "div",
    { class: "table-wrap" },
    h(
      "table",
      { class: "table" },
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Status"), h("th", { scope: "col" }, "Wilayah"), h("th", { scope: "col" }, "Provinsi"), h("th", { scope: "col", class: "num" }, "Perkiraan tiba"))),
      h("tbody", {}, sorted.map((z) => h("tr", {}, h("td", {}, levelPill(z.level)), h("td", {}, z.district), h("td", {}, z.province), h("td", { class: "num mono" }, z.estimated_arrival ? fmtClock(z.estimated_arrival) : "–")))),
    ),
  );
}

function observationsTable(observations) {
  const sorted = [...observations].sort((a, b) => (b.height_m ?? 0) - (a.height_m ?? 0));
  return h(
    "div",
    { class: "table-wrap" },
    h(
      "table",
      { class: "table" },
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Lokasi"), h("th", { scope: "col", class: "num" }, "Tinggi"), h("th", { scope: "col", class: "num" }, "Waktu (WIB)"))),
      h("tbody", {}, sorted.map((o) => h("tr", {}, h("td", {}, o.location), h("td", { class: "num mono" }, fmtMeters(o.height_m)), h("td", { class: "num mono" }, o.observed_at ? fmtClock(o.observed_at) : "–")))),
    ),
  );
}

function bulletinLabel(code) {
  if (code === "PD-1") return "Peringatan dini";
  if (code === "PD-2") return "Pemutakhiran";
  if (code.startsWith("PD-3")) return "Tsunami teramati";
  if (code === "PD-4") return "Peringatan berakhir";
  return "";
}

function eventCard(ev, index) {
  const zonesBulletin = latestWithZones(ev);
  const zones = zonesBulletin?.warning_zones ?? [];
  const obsBulletin = latestWithObservations(ev);
  const mediaBulletin = ev.bulletins.find((b) => b.media.warning_zones || b.media.sea_height) ?? ev.bulletins[0];
  const m = mediaBulletin?.media ?? {};

  return h(
    "article",
    { class: "card tsunami-event", "aria-labelledby": `ts-${index}` },
    h(
      "header",
      { class: "tsunami-event__head" },
      h(
        "div",
        { class: "tsunami-event__title-row" },
        magBadge(ev.magnitude, "lg"),
        h(
          "div",
          {},
          h("h2", { class: "tsunami-event__title", id: `ts-${index}` }, ev.region),
          h("p", { class: "small muted" }, fmtLong(ev.origin_time), " · ", h("span", { "data-rel-time": ev.origin_time }, fmtRelative(ev.origin_time))),
          h(
            "div",
            { class: "row mt-3" },
            ev.ended ? pill("Peringatan berakhir") : pill("Peringatan aktif", "signal"),
            ev.max_level ? h("span", { class: "row small muted" }, "Status tertinggi", levelPill(ev.max_level)) : null,
          ),
        ),
      ),
      facts([
        ["Tinggi teramati maks.", fmtMeters(ev.max_wave_height_m)],
        ["Kedalaman", fmtDepth(ev.depth_km)],
        ["Koordinat", fmtCoords(ev.latitude, ev.longitude)],
        ["Buletin", fmtNumber(ev.bulletins.length)],
      ], "facts--4"),
    ),
    h(
      "div",
      { class: "tsunami-event__grid" },
      h(
        "section",
        { "aria-label": "Kronologi buletin" },
        h("h3", {}, "Kronologi buletin"),
        h(
          "ol",
          { class: "timeline" },
          ev.bulletins.map((b) =>
            h(
              "li",
              {},
              h("span", { class: "timeline__code" }, b.code),
              h("span", { class: "timeline__time" }, b.issued_at ? fmtDateTime(b.issued_at) : ""),
              h("p", { class: "timeline__text" }, h("strong", {}, bulletinLabel(b.code)), bulletinLabel(b.code) ? " — " : "", `M${b.magnitude.toLocaleString("id-ID")}`),
            ),
          ),
        ),
      ),
      h(
        "section",
        {},
        zones.length
          ? [
              h("h3", {}, `Zona peringatan · ${fmtNumber(zones.length)} wilayah`),
              levelBars(zones),
              h("details", { class: "disclosure" }, h("summary", {}, "Daftar wilayah"), zonesTable(zones)),
            ]
          : h("p", { class: "small muted" }, "Tidak ada zona peringatan pada buletin ini."),
        obsBulletin
          ? h("details", { class: "disclosure", open: index === 0 }, h("summary", {}, `Pengamatan tsunami · ${fmtNumber(obsBulletin.observations.length)} lokasi`), observationsTable(obsBulletin.observations))
          : null,
        (() => {
          const viewer = mediaViewer(
            [
              { label: "Zona peringatan", caption: "Status peringatan per wilayah", src: m.warning_zones },
              { label: "Waktu tiba", caption: "Perkiraan waktu tiba gelombang", src: m.travel_time },
              { label: "Tinggi muka laut", caption: "Perkiraan tinggi muka laut maksimum", src: m.sea_height },
              { label: "Peta guncangan", caption: "Estimasi intensitas guncangan", src: m.shakemap },
            ],
            { title: "Peta BMKG" },
          );
          return viewer ? h("div", { class: "mt-5" }, viewer) : null;
        })(),
        ev.instructions.length
          ? h("details", { class: "disclosure" }, h("summary", {}, "Arahan BMKG"), h("ul", { class: "prose small", style: { padding: "0 var(--s-2) 0 var(--s-6)" } }, ev.instructions.map((t) => h("li", {}, t))))
          : null,
      ),
    ),
  );
}

function render(data) {
  replace($("#page-meta"), h("span", { class: "chip" }, `${fmtNumber(data.length)} kejadian terakhir`), h("span", { class: "chip" }, "InaTEWS BMKG"));
  replace($("#events"), data.length ? data.map(eventCard) : empty("Belum ada peringatan tsunami", "BMKG tidak mengeluarkan peringatan tsunami baru-baru ini."));
  document.dispatchEvent(new Event("gempa:rendered"));
}

async function load() {
  try {
    const { data } = await getJSON("/api/v1/tsunami");
    render(data);
  } catch (err) {
    if (!$("#events .tsunami-event")) replace($("#events"), errorNote(err.message));
  }
}

const initial = initialData();
if (initial) render(initial.events);
else load();
every(60000, load);
