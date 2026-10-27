/** Reusable UI pieces: magnitude badge, pills, facts grid, states, detail sheet, sortable table. */

import { $, h, replace } from "./dom.js";
import { fmtDateTime, fmtDepth, fmtMag, fmtRelative, magBucket, magLabel } from "./format.js";

/** Circular magnitude gauge (mini version of the home dial). Mirrors the `mag_badge` macro. */
export function magBadge(m, size = "") {
  return h(
    "span",
    { class: size ? `mag mag--${size}` : "mag", "data-m": magBucket(m), style: { "--v": String(m ?? 0) }, title: `Magnitudo ${fmtMag(m)}` },
    h("span", { class: "mag__num" }, fmtMag(m)),
  );
}

export const pill = (text, variant = "") => h("span", { class: variant ? `pill pill--${variant}` : "pill" }, text);

export function levelPill(level) {
  const lv = (level || "").toLowerCase();
  return pill(level, ["awas", "siaga", "waspada"].includes(lv) ? lv : "");
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Magnitude gauge: a 270° arc filled to magnitude / 9, coloured by the magnitude ramp. */
export function dial(m) {
  const arc = Math.min(75, (m / 9) * 75).toFixed(1);
  const ring = svg("svg", { viewBox: "0 0 100 100", "aria-hidden": "true" });
  ring.append(
    svg("circle", { class: "dial__track", cx: 50, cy: 50, r: 46, pathLength: 100 }),
    svg("circle", { class: "dial__arc", cx: 50, cy: 50, r: 46, pathLength: 100, style: `stroke-dasharray: ${arc} 100` }),
  );
  return h(
    "div",
    { class: "dial", "data-m": magBucket(m), role: "img", "aria-label": `Magnitudo ${fmtMag(m)}` },
    ring,
    h("span", { class: "dial__value" }, h("span", { class: "dial__num" }, fmtMag(m)), h("span", { class: "dial__label" }, magLabel(m))),
  );
}

/** List row for an event; mirrors the `event_item` Jinja macro. */
export function eventItem(ev, { note = "", flag = "", onClick, current = false } = {}) {
  return h(
    "li",
    {},
    h(
      "button",
      { class: "event", type: "button", "data-id": ev.event_id, "data-m": magBucket(ev.magnitude), "aria-current": current ? "true" : false, onclick: onClick },
      magBadge(ev.magnitude),
      h(
        "span",
        { class: "event__body" },
        h("span", { class: "event__title" }, ev.region),
        h("span", { class: "event__meta" }, h("span", {}, fmtDateTime(ev.origin_time)), h("span", {}, fmtDepth(ev.depth_km))),
        note ? h("span", { class: "event__note" }, note) : null,
      ),
      h(
        "span",
        { class: "event__side" },
        h("time", { datetime: ev.origin_time, "data-rel-time": ev.origin_time, title: fmtDateTime(ev.origin_time) }, fmtRelative(ev.origin_time)),
        flag ? pill(flag, "signal") : null,
      ),
    ),
  );
}

/** facts([["Waktu", "…"], ["Kedalaman", "…"]]) → <dl class="facts"> */
export function facts(rows, extraClass = "") {
  return h(
    "dl",
    { class: `facts ${extraClass}` },
    rows.filter(Boolean).map(([label, value]) => h("div", {}, h("dt", {}, label), h("dd", {}, value))),
  );
}

export function feltList(reports) {
  return h(
    "ul",
    { class: "felt-list" },
    reports.map((r) => h("li", { class: "mmi" }, h("b", {}, r.intensity), r.place)),
  );
}

export const empty = (title, text = "") => h("div", { class: "empty" }, h("strong", {}, title), text);
export const errorNote = (message) => h("p", { class: "error-note", role: "alert" }, message);

/* ---------- Detail sheet (<dialog>) ---------- */

const sheet = () => $("#detail");

/**
 * Open the detail sheet. `id` makes the event linkable: the URL gets `#e=<id>` while the
 * sheet is open (so it can be shared), and pages reopen it on load via `linkedId()`.
 */
export function openSheet({ badge, title, sub, body, id }) {
  const dialog = sheet();
  replace($("#detail-badge"), badge || "");
  replace($("#detail-title"), title || "");
  replace($("#detail-sub"), sub || "");
  replace($("#detail-body"), body || "");
  const share = $("#detail-share");
  share.hidden = !id;
  share.onclick = () => shareLink(title);
  if (id) history.replaceState(null, "", `#e=${encodeURIComponent(id)}`);
  if (!dialog.open) dialog.showModal();
  $("#detail-title").focus({ preventScroll: true });
  $("#detail-body").scrollTop = 0;
  return $("#detail-body");
}

export function closeSheet() {
  if (sheet()?.open) sheet().close();
}

/** Event id from the URL hash (`#e=<id>`), if any. */
export function linkedId() {
  const match = location.hash.match(/^#e=(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

document.addEventListener("click", (event) => {
  const dialog = sheet();
  if (!dialog?.open) return;
  if (event.target.closest("[data-close]") || event.target === dialog) dialog.close();
});

sheet()?.addEventListener("close", () => {
  if (location.hash.startsWith("#e=")) history.replaceState(null, "", location.pathname + location.search);
  document.dispatchEvent(new Event("gempa:sheet-closed"));
});

async function shareLink(title) {
  const url = location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: `${title} · Gempa`, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast("Tautan disalin");
  } catch (err) {
    if (err?.name !== "AbortError") toast("Tidak dapat membagikan tautan");
  }
}

let toastTimer;
export function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.dataset.show = "true";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.dataset.show = "false"; }, 2200);
}

/* ---------- Sortable table state ---------- */

export function sortable(table, { key, dir = "desc", onChange }) {
  const state = { key, dir };
  const headers = [...table.querySelectorAll("th[data-key]")];
  const paint = () =>
    headers.forEach((th) => {
      if (th.dataset.key === state.key) th.setAttribute("aria-sort", state.dir === "asc" ? "ascending" : "descending");
      else th.removeAttribute("aria-sort");
    });
  headers.forEach((th) =>
    th.querySelector("button")?.addEventListener("click", () => {
      const k = th.dataset.key;
      state.dir = state.key === k ? (state.dir === "asc" ? "desc" : "asc") : k === "region" || k === "province" ? "asc" : "desc";
      state.key = k;
      paint();
      onChange();
    }),
  );
  paint();
  return {
    state,
    sort(items) {
      const { key: k, dir: d } = state;
      const sign = d === "asc" ? 1 : -1;
      return [...items].sort((a, b) => {
        const x = a[k];
        const y = b[k];
        if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
        return String(x ?? "").localeCompare(String(y ?? ""), "id") * sign;
      });
    },
  };
}
