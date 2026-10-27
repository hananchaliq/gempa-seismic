/** Site-wide behaviour: theme toggle, live indicator, active-tsunami banner, relative times. */

import { getJSON } from "./lib/api.js";
import { $, $$, h, replace } from "./lib/dom.js";
import { icon } from "./lib/icons.js";
import { fmtClock, fmtMag, fmtRelative } from "./lib/format.js";

/* ---------- Theme ---------- */

const root = document.documentElement;

/**
 * Apply a theme. Listeners of "gempa:theme" may push promises into `detail.waits`
 * (e.g. maps waiting for re-themed tiles) so the transition captures a finished page.
 */
async function applyTheme(theme) {
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#23201c" : "#e7e1d8");
  const waits = [];
  document.dispatchEvent(new CustomEvent("gempa:theme", { detail: { theme, waits } }));
  await Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, 450))]);
}

function setTheme(theme) {
  try { localStorage.setItem("theme", theme); } catch {}
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // One snapshot cross-fade of the whole page: every surface changes together, and
  // nothing re-animates element by element (which lagged and looked staggered).
  if (document.startViewTransition && !reduce) document.startViewTransition(() => applyTheme(theme));
  else applyTheme(theme);
}

$("#theme-toggle")?.addEventListener("click", () => setTheme(root.dataset.theme === "dark" ? "light" : "dark"));

/* ---------- Page scrollbar: visible only while scrolling or near the right edge ---------- */

let scrollTimer;
const showScroll = (ms = 900) => {
  root.classList.add("show-scroll");
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => root.classList.remove("show-scroll"), ms);
};
window.addEventListener("scroll", () => showScroll(), { passive: true });
window.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse" && window.innerWidth - e.clientX < 24) showScroll(1500);
}, { passive: true });


// Entrance animations for lists/rows only run on first paint, not on every data refresh.
setTimeout(() => root.classList.add("settled"), 1200);

/* ---------- Live indicator ---------- */

const live = $("#live-status");
const liveLabel = $("#live-label");
let lastOk = null;

function paintLive(state) {
  if (!live) return;
  live.dataset.state = state;
  if (state === "error") liveLabel.textContent = "Gagal memuat";
  else if (lastOk) liveLabel.textContent = `Diperbarui ${fmtClock(lastOk)}`;
}

document.addEventListener("gempa:data", (e) => {
  if (e.detail.ok) {
    lastOk = e.detail.at;
    paintLive("ok");
  } else {
    paintLive("error");
  }
});

// Pages without live data still get a sensible label.
setTimeout(() => {
  if (!lastOk && live?.dataset.state === "ok") liveLabel.textContent = "Data BMKG";
}, 4000);

/* ---------- Relative times: any element with data-rel-time ---------- */

function refreshRelative() {
  $$("[data-rel-time]").forEach((el) => {
    el.textContent = fmtRelative(el.dataset.relTime);
  });
}
setInterval(refreshRelative, 30000);
document.addEventListener("gempa:rendered", refreshRelative);

/* ---------- Active tsunami warning banner ---------- */

const ACTIVE_WINDOW_MS = 24 * 3600 * 1000;

async function checkTsunami() {
  const banner = $("#tsunami-banner");
  if (!banner) return;
  try {
    const { data } = await getJSON("/api/v1/tsunami");
    const active = data.find((ev) => !ev.ended && Date.now() - new Date(ev.origin_time) < ACTIVE_WINDOW_MS);
    if (!active) {
      banner.hidden = true;
      return;
    }
    replace(
      banner,
      h(
        "div",
        { class: "container" },
        h("strong", {}, "Peringatan dini tsunami aktif"),
        h("span", {}, `M ${fmtMag(active.magnitude)} · ${active.region} · status tertinggi ${active.max_level || "-"}`),
        document.body.dataset.page === "tsunami" ? null : h("a", { class: "link-arrow", href: "/tsunami/" }, "Lihat detail", icon("arrow-right")),
      ),
    );
    banner.hidden = false;
  } catch {
    // The banner is best-effort; page content reports its own errors.
  }
}

checkTsunami();
setInterval(() => document.visibilityState === "visible" && checkTsunami(), 60000);
