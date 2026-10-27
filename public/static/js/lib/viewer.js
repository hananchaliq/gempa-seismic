/**
 * Image viewer for BMKG maps and analysis images.
 *
 * mediaViewer(items) — an in-place stage showing one image at a time, with thumbnail
 *   tabs to switch between them. Images BMKG doesn't have are dropped automatically.
 * openLightbox(items, index) — full-screen viewer with zoom (wheel, pinch, double-click,
 *   buttons, +/- keys), drag-to-pan, and prev/next (buttons or arrow keys).
 */

import { $, h } from "./dom.js";
import { icon } from "./icons.js";

/* ---------- In-place viewer ---------- */

/** items: [{ label, src, caption? }] (entries with a falsy src are ignored). */
export function mediaViewer(items, { title = "" } = {}) {
  let list = items.filter((it) => it.src);
  if (!list.length) return null;
  let active = 0;

  const img = h("img", { alt: "", decoding: "async" });
  const caption = h("span", { class: "viewer__caption" });
  const stage = h(
    "button",
    { class: "viewer__stage", type: "button", "aria-label": "Perbesar gambar", onclick: () => openLightbox(list, active) },
    img,
    h("span", { class: "viewer__hint" }, icon("expand"), "Perbesar"),
  );
  const tabs = h("div", { class: "viewer__tabs", role: "tablist", "aria-label": "Pilih gambar" });
  const root = h("section", { class: "viewer" }, title ? h("h3", {}, title) : null, stage, h("div", { class: "viewer__meta" }, caption), tabs);

  function show(index) {
    active = index;
    const item = list[index];
    root.classList.add("is-loading");
    img.onload = () => root.classList.remove("is-loading");
    img.src = item.src;
    img.alt = item.label;
    caption.textContent = item.caption || item.label;
    [...tabs.children].forEach((tab, i) => tab.setAttribute("aria-selected", String(i === index)));
  }

  function drop(item) {
    const i = list.indexOf(item);
    if (i < 0) return;
    list = list.filter((it) => it !== item);
    tabs.children[i]?.remove();
    if (!list.length) return root.remove();
    tabs.hidden = list.length < 2;
    if (active === i) show(Math.min(i, list.length - 1));
    else if (active > i) active -= 1;
  }

  list.forEach((item, i) => {
    const thumb = h("img", { src: item.src, alt: "", loading: "lazy", decoding: "async", onerror: () => drop(item) });
    tabs.append(
      h(
        "button",
        { class: "viewer__tab", type: "button", role: "tab", "aria-selected": String(i === 0), onclick: () => show(list.indexOf(item)) },
        thumb,
        h("span", {}, item.label),
      ),
    );
  });
  img.onerror = () => drop(list[active]);
  tabs.hidden = list.length < 2;
  show(0);
  return root;
}

/* ---------- Lightbox ---------- */

const MIN = 1;
const MAX = 5;
let state = null;

function el() {
  return $("#lightbox");
}

function apply() {
  const { img, s, tx, ty } = state;
  img.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  el().dataset.zoomed = String(s > 1);
  $("#lb-zoom-out").disabled = s <= MIN;
  $("#lb-zoom-in").disabled = s >= MAX;
}

function zoomAt(next, cx = 0, cy = 0) {
  const s = Math.min(MAX, Math.max(MIN, next));
  const k = s / state.s;
  // Keep the point under the cursor fixed while scaling.
  state.tx = cx - (cx - state.tx) * k;
  state.ty = cy - (cy - state.ty) * k;
  state.s = s;
  if (s === MIN) state.tx = state.ty = 0;
  apply();
}

function centerOffset(event) {
  const r = $("#lb-stage").getBoundingClientRect();
  return [event.clientX - (r.left + r.width / 2), event.clientY - (r.top + r.height / 2)];
}

function showItem(index) {
  const { items } = state;
  state.index = (index + items.length) % items.length;
  const item = items[state.index];
  state.s = 1;
  state.tx = state.ty = 0;
  state.img.classList.add("is-switching");
  state.img.onload = () => state.img.classList.remove("is-switching");
  state.img.src = item.src;
  state.img.alt = item.label;
  $("#lb-title").textContent = item.label;
  $("#lb-count").textContent = items.length > 1 ? `${state.index + 1} / ${items.length}` : "";
  $("#lb-open").href = item.src;
  el().dataset.multi = String(items.length > 1);
  apply();
}

export function openLightbox(items, index = 0) {
  const dialog = el();
  if (!dialog) return;
  if (!state) setup(dialog);
  state.items = items;
  showItem(index);
  if (!dialog.open) dialog.showModal();
}

function setup(dialog) {
  const img = $("#lb-img");
  state = { img, items: [], index: 0, s: 1, tx: 0, ty: 0 };
  const stage = $("#lb-stage");

  $("#lb-prev").addEventListener("click", () => showItem(state.index - 1));
  $("#lb-next").addEventListener("click", () => showItem(state.index + 1));
  $("#lb-zoom-in").addEventListener("click", () => zoomAt(state.s * 1.5));
  $("#lb-zoom-out").addEventListener("click", () => zoomAt(state.s / 1.5));
  dialog.addEventListener("click", (e) => { if (e.target.closest("[data-lb-close]")) dialog.close(); });
  dialog.addEventListener("close", () => { img.removeAttribute("src"); });

  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") showItem(state.index + 1);
    else if (e.key === "ArrowLeft") showItem(state.index - 1);
    else if (e.key === "+" || e.key === "=") zoomAt(state.s * 1.5);
    else if (e.key === "-") zoomAt(state.s / 1.5);
    else if (e.key === "0") zoomAt(1);
    else return;
    e.preventDefault();
  });

  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    const [cx, cy] = centerOffset(e);
    zoomAt(state.s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), cx, cy);
  }, { passive: false });

  stage.addEventListener("dblclick", (e) => {
    const [cx, cy] = centerOffset(e);
    zoomAt(state.s > 1 ? 1 : 2.5, cx, cy);
  });

  // Pointer handling: one pointer pans (when zoomed), two pointers pinch-zoom.
  const pointers = new Map();
  let last = null;
  let pinch = null;
  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return; // prev/next buttons live inside the stage
    pointers.set(e.pointerId, e);
    stage.dataset.dragging = "";
    stage.setPointerCapture(e.pointerId);
    last = { x: e.clientX, y: e.clientY };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), s: state.s };
    }
  });
  stage.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e);
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const mid = { clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 };
      const [cx, cy] = centerOffset(mid);
      zoomAt((pinch.s * d) / pinch.d, cx, cy);
    } else if (state.s > 1 && last) {
      state.tx += e.clientX - last.x;
      state.ty += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      apply();
    }
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (!pointers.size) delete stage.dataset.dragging;
    if (pointers.size < 2) pinch = null;
    last = pointers.size ? { x: [...pointers.values()][0].clientX, y: [...pointers.values()][0].clientY } : null;
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
}
