/** Inline SVG icons (24×24, stroke). Mirrors app/web/icons.py — keep the paths in sync. */

const PATHS = {
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  "arrow-left": "M19 12H5M11 6l-6 6 6 6",
  "chevron-down": "m6 9 6 6 6-6",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  layers: "m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5",
  check: "m5 12 5 5 9-10",
  "chevron-left": "m15 6-6 6 6 6",
  "chevron-right": "m9 6 6 6-6 6",
  "zoom-in": "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-3.5-3.5M11 8v6M8 11h6",
  "zoom-out": "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-3.5-3.5M8 11h6",
  "expand": "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7",
  "share": "M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13",
  "external": "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
};

const NS = "http://www.w3.org/2000/svg";

/** SVG element for DOM building. */
export function icon(name, cls = "icon") {
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({
    class: cls, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2",
    "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false",
  })) svg.setAttribute(k, v);
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", PATHS[name]);
  svg.append(path);
  return svg;
}

/** Same icon as an HTML string, for Leaflet options that only accept strings. */
export function iconHTML(name, cls = "icon") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${PATHS[name]}"/></svg>`;
}
