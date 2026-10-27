/** Data the server embedded in the page (<script type="application/json" id="initial-data">). */

let cache;

export function initialData() {
  if (cache !== undefined) return cache;
  const el = document.getElementById("initial-data");
  try {
    cache = el ? JSON.parse(el.textContent) : null;
  } catch {
    cache = null;
  }
  return cache;
}
