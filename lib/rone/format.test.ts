import test from "node:test";
import assert from "node:assert/strict";
import {
  distanceKm,
  fmtCoords,
  fmtDepth,
  fmtMag,
  fmtMagUnit,
  magBucket,
  magCategory,
  magColorHex,
  magScaleRange,
  magTierInfo,
  parseFelt,
  weeklyBuckets,
} from "./format";

test("magnitude formatting uses explicit M prefix and Indonesian strength categories", () => {
  assert.equal(fmtMag(2.6), "2,6");
  assert.equal(fmtMagUnit(2.6), "M 2,6");
  assert.equal(fmtMagUnit(5.4), "M 5,4");
  assert.equal(magCategory(2.1), "Mikro");
  assert.equal(magCategory(3.4), "Ringan");
  assert.equal(magCategory(5.8), "Kuat");
  assert.equal(magScaleRange(2.4), "M < 3,0");
  assert.equal(magScaleRange(3.5), "M 3,0–3,9");
  assert.equal(magScaleRange(5.2), "M 5,0–5,9");
});

test("magBucket, magTierInfo, and magColorHex classify magnitudes into 6 distinct color tiers", () => {
  assert.equal(magBucket(2.2), "0");
  assert.equal(magBucket(3.0), "3");
  assert.equal(magBucket(4.4), "4");
  assert.equal(magBucket(5.1), "5");
  assert.equal(magBucket(6.3), "6");
  assert.equal(magBucket(7.2), "7");

  assert.equal(magColorHex(3.4), "#EAB308");
  assert.equal(magColorHex(4.2), "#F59E0B");
  assert.equal(magColorHex(5.9), "#EA580C");
  assert.equal(magColorHex(6.5), "#EF4444");
  assert.equal(magColorHex(7.1), "#F43F5E");

  assert.equal(magTierInfo(3.2).isHigh, false);
  assert.equal(magTierInfo(5.9).isHigh, true);
  assert.equal(magTierInfo(5.9).levelLabel, "Kuat");
  assert.equal(magTierInfo(6.4).levelLabel, "Besar");
});

test("coordinate, depth, and MMI felt parsing work accurately", () => {
  assert.equal(fmtDepth(10.4), "10 km");
  assert.equal(fmtCoords(-7.95, 108.46), "7,95° LS, 108,46° BT");
  const felt = parseFelt("III-IV Pacitan, II-III Yogyakarta");
  assert.equal(felt.length, 2);
  assert.deepEqual(felt[0], { intensity: "III–IV", place: "Pacitan" });
  assert.deepEqual(felt[1], { intensity: "II–III", place: "Yogyakarta" });
});

test("distanceKm and weeklyBuckets compute deterministic outputs", () => {
  const d = distanceKm(
    { latitude: -6.2088, longitude: 106.8456 },
    { latitude: -6.9175, longitude: 107.6191 }
  );
  assert.ok(d > 100 && d < 135);

  const buckets = weeklyBuckets([
    { origin_time: "2026-10-01T00:00:00Z", magnitude: 4.7, region: "Jawa" },
    { origin_time: "2026-10-02T00:00:00Z", magnitude: 5.3, region: "Bali" },
  ]);
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].count, 2);
  assert.equal(buckets[0].max?.magnitude, 5.3);
});
