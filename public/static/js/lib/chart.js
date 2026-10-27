/**
 * Weekly activity bar chart (single series, one hue, HTML bars for crisp text).
 * Each bar has a hover/focus tooltip; the peak week is direct-labelled; a visually
 * hidden table carries the same data for screen readers.
 */

import { h, replace } from "./dom.js";
import { fmtMag, fmtNumber } from "./format.js";

const DAY = 86400000;
const WIB_OFFSET = 7 * 3600000;
const monthFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "short" });

/** Monday 00:00 WIB of the week containing `t`, as a UTC-shifted timestamp. */
function weekStart(t) {
  const local = new Date(t + WIB_OFFSET);
  const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - dow);
}

export function weeklyBuckets(events) {
  if (!events.length) return [];
  const times = events.map((e) => new Date(e.origin_time).getTime());
  const first = weekStart(Math.min(...times));
  const last = weekStart(Math.max(...times));
  const weeks = [];
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  for (let t = first; t <= last; t += 7 * DAY) {
    // A week is partial when the catalogue doesn't cover all 7 days of it.
    const partial = t - WIB_OFFSET < minT - DAY || t - WIB_OFFSET + 7 * DAY > maxT + DAY;
    weeks.push({ start: t, count: 0, max: null, partial });
  }
  events.forEach((e, i) => {
    const w = weeks[Math.round((weekStart(times[i]) - first) / (7 * DAY))];
    if (!w) return;
    w.count += 1;
    if (!w.max || e.magnitude > w.max.magnitude) w.max = e;
  });
  return weeks;
}

const label = (w) => `${monthFmt.format(w.start)} – ${monthFmt.format(w.start + 6 * DAY)}`;

export function renderWeeklyChart(container, events) {
  const weeks = weeklyBuckets(events);
  if (!weeks.length) return;
  const peak = weeks.reduce((a, b) => (b.count > a.count ? b : a));
  const step = peak.count > 50 ? 20 : 10;
  const top = Math.max(step, Math.ceil(peak.count / step) * step);
  const total = weeks.reduce((n, w) => n + w.count, 0);

  const bars = weeks.map((w, i) => {
    const tip = h(
      "span",
      { class: "chart__tip", role: "tooltip" },
      h("strong", {}, `${fmtNumber(w.count)} gempa`),
      h("span", {}, label(w)),
      w.partial ? h("em", {}, "Data sebagian minggu") : null,
      w.max ? h("span", {}, `Terbesar M${fmtMag(w.max.magnitude)} · ${w.max.region}`) : null,
    );
    return h(
      "button",
      {
        class: `chart__col${w === peak ? " is-peak" : ""}${w.partial ? " is-partial" : ""}`,
        type: "button",
        "aria-label": `${label(w)}: ${w.count} gempa`,
        style: { "--h": `${(w.count / top) * 100}%` },
      },
      w === peak ? h("span", { class: "chart__value mono" }, fmtNumber(w.count)) : null,
      h("span", { class: "chart__bar" }),
      tip,
      i % 2 === 0 || weeks.length < 8 ? h("span", { class: "chart__x" }, monthFmt.format(w.start)) : h("span", { class: "chart__x" }),
    );
  });

  replace(
    container,
    h(
      "div",
      { class: "chart__plot", "aria-hidden": "false" },
      h("div", { class: "chart__grid" }, [top, top / 2, 0].map((v) => h("span", { class: "chart__gridline" }, h("span", { class: "mono" }, fmtNumber(v))))),
      h("div", { class: "chart__cols" }, bars),
    ),
    weeks.some((w) => w.partial) ? h("p", { class: "chart__note" }, "Batang pucat: minggu yang datanya belum lengkap.") : null,
    h(
      "table",
      { class: "visually-hidden" },
      h("caption", {}, "Jumlah gempa M4,5+ per minggu"),
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Minggu"), h("th", { scope: "col" }, "Jumlah"))),
      h("tbody", {}, weeks.map((w) => h("tr", {}, h("td", {}, label(w)), h("td", {}, String(w.count))))),
    ),
  );
  return { total, weeks: weeks.length, average: total / weeks.length };
}
