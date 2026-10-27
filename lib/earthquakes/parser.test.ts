import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDepthCategory,
  classifyMagnitude,
  combineAndOrderEvents,
  computeSeismicStatistics,
  filterAndSortEvents,
  getRoneMagnitudeDataAttr,
  normalizeBmkgEvent,
  normalizeRoneEarthquakeEvent,
  normalizeRoneRealtimeEvent,
  normalizeUsgsFeature,
  parseBmkgCoordinates,
  parseBmkgDepthKm,
  parseBmkgMagnitude,
  parseTsunamiAdvisory,
  serializeEventsToCsv,
} from './parser';
import {
  VERIFIED_BMKG_FELT_FIXTURES,
  VERIFIED_BMKG_LATEST_FIXTURE,
  VERIFIED_BMKG_M5_FIXTURES,
  VERIFIED_USGS_GLOBAL_FIXTURES,
} from './fixtures';
import { EarthquakeQuerySchema } from './schemas';

test('parseBmkgCoordinates parses valid Coordinates and Lintang/Bujur strings and rejects out-of-range values', () => {
  const valid = parseBmkgCoordinates('-8.38,115.48', '8.38 LS', '115.48 BT');
  assert.deepEqual(valid, { latitude: -8.38, longitude: 115.48 });

  const fallback = parseBmkgCoordinates('invalid', '3.82 LU', '95.94 BT');
  assert.deepEqual(fallback, { latitude: 3.82, longitude: 95.94 });

  const outOfRange = parseBmkgCoordinates('-95.0,115.0', '95.0 LS', '115.0 BT');
  assert.equal(outOfRange, null);

  const nanCoords = parseBmkgCoordinates('NaN,115.0', 'abc', 'def');
  assert.equal(nanCoords, null);
});

test('parseBmkgDepthKm and parseBmkgMagnitude validate numeric bounds strictly', () => {
  assert.equal(parseBmkgDepthKm('34 km'), 34);
  assert.equal(parseBmkgDepthKm('524 km'), 524);
  assert.equal(parseBmkgDepthKm('-10 km'), 10);
  assert.equal(parseBmkgDepthKm('invalid'), null);
  assert.equal(parseBmkgDepthKm('2500 km'), null);

  assert.equal(parseBmkgMagnitude('5.4'), 5.4);
  assert.equal(parseBmkgMagnitude(6.2), 6.2);
  assert.equal(parseBmkgMagnitude('0'), null);
  assert.equal(parseBmkgMagnitude('12.5'), null);
  assert.equal(parseBmkgMagnitude('NaN'), null);
});

test('classifyDepthCategory, classifyMagnitude, and getRoneMagnitudeDataAttr assign accurate classes', () => {
  assert.equal(classifyDepthCategory(12), 'shallow');
  assert.equal(classifyDepthCategory(69.9), 'shallow');
  assert.equal(classifyDepthCategory(70), 'intermediate');
  assert.equal(classifyDepthCategory(300), 'intermediate');
  assert.equal(classifyDepthCategory(301), 'deep');

  assert.equal(classifyMagnitude(3.8), 'minor');
  assert.equal(classifyMagnitude(4.5), 'light');
  assert.equal(classifyMagnitude(5.4), 'moderate');
  assert.equal(classifyMagnitude(6.4), 'strong');
  assert.equal(classifyMagnitude(7.2), 'major');
  assert.equal(classifyMagnitude(8.1), 'great');

  assert.equal(getRoneMagnitudeDataAttr(2.6), '0');
  assert.equal(getRoneMagnitudeDataAttr(3.3), '3');
  assert.equal(getRoneMagnitudeDataAttr(4.9), '4');
  assert.equal(getRoneMagnitudeDataAttr(5.4), '5');
  assert.equal(getRoneMagnitudeDataAttr(6.5), '6');
  assert.equal(getRoneMagnitudeDataAttr(7.7), '7');
});

test('parseTsunamiAdvisory never invents tsunami warnings and preserves official text', () => {
  const noPot = parseTsunamiAdvisory('Tidak berpotensi tsunami');
  assert.equal(noPot.status, 'no_potential');

  const felt = parseTsunamiAdvisory(
    'Gempa ini dirasakan untuk diteruskan pada masyarakat'
  );
  assert.equal(felt.status, 'felt_local');

  const missing = parseTsunamiAdvisory(undefined);
  assert.equal(missing.status, 'official_info_unavailable');
});

test('normalizeRoneEarthquakeEvent and normalizeRoneRealtimeEvent parse gempa.rone.dev API v2 payloads', () => {
  const roneLatestSample = {
    event_id: '20261026115342',
    origin_time: '2026-10-26T11:53:42+07:00',
    magnitude: 4.9,
    depth_km: 13.0,
    latitude: -8.45,
    longitude: 121.45,
    region: 'Pusat gempa berada di laut 30 km timur laut Mbay, Nagekeo',
    tsunami_potential: false,
    potential: 'Gempa ini dirasakan untuk diteruskan pada masyarakat',
    felt: 'III Bajawa, III Maumere, II - III Ruteng',
    instruction: 'Hati-hati terhadap gempabumi susulan yang mungkin terjadi',
    has_narrative: false,
    media: {
      shakemap: '/api/v1/media/20261026115342/shakemap',
      location_map: '/api/v1/media/20261026115342/location-map',
    },
  };

  const normalizedLatest = normalizeRoneEarthquakeEvent(roneLatestSample, 'RONE_LATEST');
  assert.ok(normalizedLatest);
  assert.equal(normalizedLatest.id, 'rone-20261026115342');
  assert.equal(normalizedLatest.sourceId, 'RONE_LATEST');
  assert.equal(normalizedLatest.sourceAgency, 'BMKG');
  assert.equal(normalizedLatest.magnitude, 4.9);
  assert.equal(normalizedLatest.depthKm, 13);
  assert.equal(normalizedLatest.coordinatesText, '8,45° LS, 121,45° BT');
  assert.equal(
    normalizedLatest.shakemapUrl,
    'https://gempa.rone.dev/api/v1/media/20261026115342/shakemap'
  );

  const roneRealtimeSample = {
    event_id: 'bmg2026vacq',
    origin_time: '2026-10-26T21:35:28.338000Z',
    magnitude: 3.3,
    depth_km: 10,
    latitude: -10.05,
    longitude: 118.88,
    region: 'South of Sumbawa, Indonesia',
    status: 'confirmed',
    has_focal_mechanism: false,
  };

  const normalizedRt = normalizeRoneRealtimeEvent(roneRealtimeSample);
  assert.ok(normalizedRt);
  assert.equal(normalizedRt.id, 'rone-rt-bmg2026vacq');
  assert.equal(normalizedRt.sourceId, 'RONE_REALTIME');
  assert.equal(normalizedRt.verificationStatus, 'verified');
});

test('normalizeBmkgEvent and normalizeUsgsFeature preserve source attribution and reject malformed payloads', () => {
  const bmkgEv = normalizeBmkgEvent(VERIFIED_BMKG_LATEST_FIXTURE, 'BMKG_LATEST');
  assert.ok(bmkgEv);
  assert.equal(bmkgEv.sourceAgency, 'BMKG');
  assert.equal(bmkgEv.sourceId, 'BMKG_LATEST');
  assert.equal(bmkgEv.magnitude, 5.4);
  assert.equal(bmkgEv.depthKm, 34);
  assert.equal(bmkgEv.latitude, -8.38);
  assert.equal(bmkgEv.longitude, 115.48);

  const malformedBmkg = normalizeBmkgEvent(
    { ...VERIFIED_BMKG_LATEST_FIXTURE, DateTime: 'not-a-date' },
    'BMKG_LATEST'
  );
  assert.equal(malformedBmkg, null);

  const usgsEv = normalizeUsgsFeature(VERIFIED_USGS_GLOBAL_FIXTURES[0]);
  assert.ok(usgsEv);
  assert.equal(usgsEv.sourceAgency, 'USGS');
  assert.equal(usgsEv.sourceId, 'USGS_GLOBAL');
  assert.equal(usgsEv.depthCategory, 'deep');
});

test('combineAndOrderEvents deduplicates identical BMKG feeds without merging USGS events', () => {
  const latest = normalizeBmkgEvent(VERIFIED_BMKG_LATEST_FIXTURE, 'BMKG_LATEST')!;
  const duplicateInM5 = normalizeBmkgEvent(VERIFIED_BMKG_M5_FIXTURES[0], 'BMKG_M5')!;
  const usgs = normalizeUsgsFeature(VERIFIED_USGS_GLOBAL_FIXTURES[0])!;

  const syntheticUsgsSameTime = {
    ...usgs,
    originTimeEpochMs: latest.originTimeEpochMs,
    latitude: latest.latitude,
    longitude: latest.longitude,
  };

  const combined = combineAndOrderEvents([
    latest,
    duplicateInM5,
    syntheticUsgsSameTime,
  ]);
  assert.equal(combined.length, 2);
  assert.equal(combined.filter((e) => e.sourceAgency === 'BMKG').length, 1);
  assert.equal(combined.filter((e) => e.sourceAgency === 'USGS').length, 1);
});

test('filterAndSortEvents filters by magnitude, depth, source, search query, and sorts accurately', () => {
  const allEvents = combineAndOrderEvents([
    normalizeBmkgEvent(VERIFIED_BMKG_LATEST_FIXTURE, 'BMKG_LATEST')!,
    ...VERIFIED_BMKG_M5_FIXTURES.map((r) => normalizeBmkgEvent(r, 'BMKG_M5')!),
    ...VERIFIED_BMKG_FELT_FIXTURES.map((r) => normalizeBmkgEvent(r, 'BMKG_FELT')!),
    ...VERIFIED_USGS_GLOBAL_FIXTURES.map((f) => normalizeUsgsFeature(f)!),
  ]);

  const deepOnly = filterAndSortEvents(allEvents, { depthCategory: 'deep' });
  assert.ok(deepOnly.items.length >= 2);
  assert.ok(deepOnly.items.every((e) => e.depthKm > 300));

  const mag6Plus = filterAndSortEvents(allEvents, {
    minMag: 6.0,
    sortBy: 'magnitude',
    sortOrder: 'desc',
  });
  assert.ok(mag6Plus.items.length >= 4);
  assert.ok(mag6Plus.items.every((e) => e.magnitude >= 6.0));
  assert.ok(mag6Plus.items[0].magnitude >= mag6Plus.items[1].magnitude);

  const searchBali = filterAndSortEvents(allEvents, { search: 'Karangasem' });
  assert.equal(searchBali.total, 1);
  assert.ok(searchBali.items[0].region.includes('Karangasem'));
});

test('computeSeismicStatistics calculates reproducible metrics and distributions from dataset', () => {
  const sample = [
    normalizeBmkgEvent(VERIFIED_BMKG_M5_FIXTURES[0], 'BMKG_M5')!, // M 5.4, 34 km
    normalizeBmkgEvent(VERIFIED_BMKG_M5_FIXTURES[2], 'BMKG_M5')!, // M 6.2, 148 km
    normalizeBmkgEvent(VERIFIED_BMKG_M5_FIXTURES[6], 'BMKG_M5')!, // M 6.4, 524 km
  ];

  const stats = computeSeismicStatistics(sample);
  assert.equal(stats.totalEvents, 3);
  assert.equal(stats.bmkgCount, 3);
  assert.equal(stats.usgsCount, 0);
  assert.equal(stats.maxMagnitudeEvent?.magnitude, 6.4);
  assert.equal(stats.deepestEvent?.depthKm, 524);
  assert.equal(stats.shallowestEvent?.depthKm, 34);
  assert.equal(stats.medianMagnitude, 6.2);
  assert.equal(stats.medianDepthKm, 148);
  assert.equal(
    stats.depthDistribution.find((d) => d.category === 'shallow')?.count,
    1
  );
  assert.equal(
    stats.depthDistribution.find((d) => d.category === 'intermediate')?.count,
    1
  );
  assert.equal(
    stats.depthDistribution.find((d) => d.category === 'deep')?.count,
    1
  );
});

test('EarthquakeQuerySchema rejects extreme or invalid query parameters and serializeEventsToCsv neutralizes formula injection', () => {
  const invalidQuery = EarthquakeQuerySchema.safeParse({
    minMag: -5,
    limit: 99999,
    sortBy: 'arbitrary_sql_column',
  });
  assert.equal(invalidQuery.success, false);

  const ev = normalizeBmkgEvent(VERIFIED_BMKG_LATEST_FIXTURE, 'BMKG_LATEST')!;
  const maliciousEv = {
    ...ev,
    region: '=CMD|\' /C calc\'!A0',
  };
  const csv = serializeEventsToCsv([maliciousEv]);
  assert.ok(csv.includes("'=CMD|"));
});
