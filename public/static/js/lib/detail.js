/** Detail sheets for each kind of event. */

import { getJSON } from "./api.js";
import { h, replace } from "./dom.js";
import {
  fmtCoords, fmtDateTime, fmtDepth, fmtLong, fmtMag, fmtNumber, fmtRelative, fmtTime, parseFelt,
} from "./format.js";
import { empty, errorNote, facts, feltList, magBadge, openSheet, pill } from "./ui.js";
import { mediaViewer } from "./viewer.js";

const NEARBY_KM = 150;

/** Great-circle distance in km. */
export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}

/**
 * "Aktivitas di sekitar": other realtime detections within NEARBY_KM of this event
 * (foreshocks/aftershocks context). The event itself is excluded by id or by being
 * the same origin (within 2 minutes and 30 km).
 */
function nearbySection(event, onPick) {
  const slot = h("section", {}, h("h3", {}, `Aktivitas di sekitar (≤ ${NEARBY_KM} km)`), h("span", { class: "skeleton skeleton--line" }));
  getJSON("/api/v1/earthquakes/realtime?limit=500")
    .then(({ data }) => {
      const origin = new Date(event.origin_time).getTime();
      const items = data
        .map((ev) => ({ ev, km: distanceKm(event, ev) }))
        .filter(({ ev, km }) => {
          if (km > NEARBY_KM || ev.event_id === event.event_id) return false;
          const sameShock = Math.abs(new Date(ev.origin_time).getTime() - origin) < 120000 && km < 30;
          return !sameShock;
        })
        .slice(0, 6);
      if (!items.length) {
        slot.remove();
        return;
      }
      const oldest = data.at(-1);
      replace(
        slot,
        h("h3", {}, `Aktivitas di sekitar (≤ ${NEARBY_KM} km)`),
        h(
          "ul",
          { class: "nearby" },
          items.map(({ ev, km }) =>
            h(
              "li",
              {},
              h(
                "button",
                { class: "nearby__item", type: "button", onclick: () => onPick(ev) },
                magBadge(ev.magnitude, "sm"),
                h("span", { class: "nearby__body" }, h("strong", {}, ev.region), h("span", {}, fmtDateTime(ev.origin_time))),
                h("span", { class: "nearby__km mono" }, `${fmtNumber(Math.round(km))} km`),
              ),
            ),
          ),
        ),
        oldest ? h("p", { class: "xsmall muted" }, `Dari deteksi realtime sejak ${fmtDateTime(oldest.origin_time)}.`) : null,
      );
    })
    .catch(() => slot.remove());
  return slot;
}

/** Announced earthquake (latest / felt / M5+). */
export function showEarthquake(eq, { onPick = showRealtime } = {}) {
  const felt = parseFelt(eq.felt);
  const media = eq.media || {};
  const narrativeSlot = eq.has_narrative
    ? h("section", {}, h("h3", {}, "Narasi BMKG"), h("div", { class: "prose small" }, h("span", { class: "skeleton skeleton--line" }), h("span", { class: "skeleton skeleton--line" })))
    : null;

  const viewer = mediaViewer(
    [
      { label: "Peta guncangan", caption: "Estimasi intensitas guncangan (shakemap)", src: media.shakemap },
      { label: "Dampak per kecamatan", caption: "Perkiraan dampak per kecamatan", src: media.impact },
      { label: "PGA & MMI stasiun", caption: "Percepatan tanah maksimum dan MMI per stasiun", src: media.station_intensity },
      { label: "Sebaran akselerometer", caption: "Sebaran stasiun akselerometer", src: media.location_map },
      { label: "Intensitas", caption: "Ringkasan intensitas", src: media.intensity },
    ],
    { title: "Peta & analisis BMKG" },
  );

  openSheet({
    id: eq.event_id,
    badge: magBadge(eq.magnitude, "lg"),
    title: eq.region,
    sub: [fmtDateTime(eq.origin_time), " · ", fmtRelative(eq.origin_time), eq.tsunami_potential ? " · Berpotensi tsunami" : ""].join(""),
    body: [
      facts([
        ["Waktu", fmtLong(eq.origin_time)],
        ["Kedalaman", fmtDepth(eq.depth_km)],
        ["Koordinat", fmtCoords(eq.latitude, eq.longitude)],
        ["Potensi", eq.potential || "–"],
      ]),
      felt.length ? h("section", {}, h("h3", {}, "Dirasakan (skala MMI)"), feltList(felt)) : null,
      viewer,
      narrativeSlot,
      nearbySection(eq, onPick),
      eq.instruction ? h("p", { class: "small muted" }, eq.instruction) : null,
    ],
  });

  if (narrativeSlot) {
    getJSON(`/api/v1/earthquakes/${eq.event_id}/narrative`)
      .then((n) => {
        narrativeSlot.querySelector(".prose").innerHTML = n.html; // sanitised server-side (nh3 allow-list)
      })
      .catch(() => narrativeSlot.remove());
  }
}

function revisionSummary(records) {
  const mags = records.map((r) => r.magnitude).filter((m) => m != null);
  if (mags.length < 2) return null;
  const first = mags[0];
  const last = mags.at(-1);
  const span = records.at(-1).minutes_after_origin;
  return h(
    "p",
    { class: "small" },
    `Direvisi ${fmtNumber(records.length)} kali`,
    span != null ? ` dalam ${span.toLocaleString("id-ID", { maximumFractionDigits: 1 })} menit` : "",
    `: magnitudo ${fmtMag(first)} menjadi ${fmtMag(last)}.`,
  );
}

/** Automatic real-time detection, with its revision history. */
export function showRealtime(ev, { onPick = showRealtime } = {}) {
  const historySlot = h("section", {}, h("h3", {}, "Riwayat pemutakhiran"), h("span", { class: "skeleton skeleton--line" }), h("span", { class: "skeleton skeleton--line" }));
  openSheet({
    id: ev.event_id,
    badge: magBadge(ev.magnitude, "lg"),
    title: ev.region,
    sub: `${fmtDateTime(ev.origin_time)} · ${fmtRelative(ev.origin_time)}`,
    body: [
      facts([
        ["Waktu", fmtLong(ev.origin_time)],
        ["Kedalaman", fmtDepth(ev.depth_km)],
        ["Koordinat", fmtCoords(ev.latitude, ev.longitude)],
        ["Status", h("span", { class: "row" }, pill(ev.status === "confirmed" ? "Terkonfirmasi" : ev.status, "ok"), ev.has_focal_mechanism ? pill("Mekanisme fokal") : null)],
      ]),
      historySlot,
      nearbySection(ev, onPick),
      h("p", { class: "xsmall muted" }, "Deteksi otomatis; parameter dapat berubah setelah ditinjau analis BMKG."),
    ],
  });

  getJSON(`/api/v1/earthquakes/realtime/${ev.event_id}/history`)
    .then(({ records }) => {
      if (!records.length) {
        replace(historySlot, h("h3", {}, "Riwayat pemutakhiran"), empty("Belum ada riwayat"));
        return;
      }
      replace(
        historySlot,
        h("h3", {}, "Riwayat pemutakhiran"),
        revisionSummary(records),
        h(
          "div",
          { class: "table-wrap table-wrap--inset" },
          h(
            "table",
            { class: "table" },
            h("thead", {}, h("tr", {}, ["Waktu (WIB)", "+ Menit", "Mag", "Tipe", "Kedalaman", "Fase"].map((t, i) => h("th", { scope: "col", class: i === 0 || i === 3 ? "" : "num" }, t)))),
            h(
              "tbody",
              {},
              records.map((r) =>
                h(
                  "tr",
                  {},
                  h("td", { class: "mono nowrap" }, fmtTime(r.timestamp).replace(" WIB", "")),
                  h("td", { class: "num" }, r.minutes_after_origin == null ? "–" : r.minutes_after_origin.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })),
                  h("td", { class: "num" }, fmtMag(r.magnitude)),
                  h("td", { class: "mono" }, r.magnitude_type || "–"),
                  h("td", { class: "num" }, fmtDepth(r.depth_km)),
                  h("td", { class: "num" }, r.phase_count ?? "–"),
                ),
              ),
            ),
          ),
        ),
      );
    })
    .catch((err) => replace(historySlot, h("h3", {}, "Riwayat pemutakhiran"), errorNote(err.message)));
}

/** Historical damaging earthquake. */
export function showDamaging(ev) {
  openSheet({
    id: ev.event_id,
    badge: magBadge(ev.magnitude, "lg"),
    title: ev.epicenter ? ev.epicenter.replace(/^di /, "Di ") : ev.province,
    sub: `${ev.province} · ${new Date(ev.origin_time).getUTCFullYear()}`,
    body: [
      facts([
        ["Waktu", fmtLong(ev.origin_time)],
        ["Kedalaman", fmtDepth(ev.depth_km)],
        ["Koordinat", fmtCoords(ev.latitude, ev.longitude)],
        ["Tsunami", ev.tsunami ? "Ya" : "Tidak"],
      ]),
      h("section", {}, h("h3", {}, "Korban & kerusakan"), h("p", { class: "prose" }, ev.impact || "Tidak ada rincian.")),
      ev.felt.length ? h("section", {}, h("h3", {}, "Dirasakan (skala MMI)"), feltList(ev.felt)) : null,
      h("p", { class: "xsmall muted" }, `Sumber: ${ev.source || "BMKG"}`),
    ],
  });
}
