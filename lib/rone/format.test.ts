import test from "node:test";
import assert from "node:assert/strict";
import {
  fmtMag,
  fmtDepth,
  fmtCoords,
  fmtRelative,
  magBucket,
  magCategory,
  parseFelt,
  distanceKm,
  weeklyBuckets,
} from "./format";

test("fmtMag and fmtDepth format Indonesian numbers accurately", () => {
  assert.equal(fmtMag(4.9), "4,9");
  assert.equal(fmtMag(5), "5,0");
  assert.equal(fmtDepth(13), "13 km");
});

test("fmtCoords formats Indonesian latitude/longitude directions", () => {
  assert.equal(fmtCoords(-8.45, 121.45), "8,45° LS, 121,45° BT");
  assert.equal(fmtCoords(1.55, 127.24), "1,55° LU, 127,24° BT");
});

test("magBucket and magCategory match BMKG scale", () => {
  assert.equal(magBucket(2.5), "0");
  assert.equal(magCategory(2.5), "Mikro");
  assert.equal(magBucket(4.9), "4");
  assert.equal(magCategory(4.9), "Ringan");
  assert.equal(magBucket(5.8), "5");
  assert.equal(magCategory(5.8), "Sedang");
  assert.equal(magBucket(7.7), "7");
  assert.equal(magCategory(7.7), "Besar");
});

test("parseFelt splits MMI intensity reports accurately", () => {
  const parsed = parseFelt("III Bajawa, III Maumere, II - III Ruteng");
  assert.equal(parsed.length, 3);
  assert.deepEqual(parsed[0], { intensity: "III", place: "Bajawa" });
  assert.deepEqual(parsed[2], { intensity: "II–III", place: "Ruteng" });
});

test("fmtRelative computes Indonesian relative timestamps deterministically", () => {
  const ref = new Date("2026-10-27T02:57:00Z").getTime();
  assert.equal(fmtRelative("2026-10-26T04:53:42Z", ref), "22 jam yang lalu");
});

test("distanceKm computes great-circle distance", () => {
  const d = distanceKm({ latitude: -8.45, longitude: 121.45 }, { latitude: -8.41, longitude: 121.39 });
  assert.ok(d > 5 && d < 10);
});

test("weeklyBuckets groups events into Monday-aligned WIB weekly buckets", () => {
  const buckets = weeklyBuckets([
    { origin_time: "2026-10-12T05:00:00Z", magnitude: 4.8, region: "Flores" },
    { origin_time: "2026-10-14T05:00:00Z", magnitude: 5.4, region: "Banda" },
    { origin_time: "2026-10-20T05:00:00Z", magnitude: 4.6, region: "Java" },
  ]);
  assert.equal(buckets.length, 2);
  assert.equal(buckets[0].count, 2);
  assert.equal(buckets[0].max?.magnitude, 5.4);
  assert.equal(buckets[1].count, 1);
});
