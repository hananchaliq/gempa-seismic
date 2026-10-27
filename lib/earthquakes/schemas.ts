import { z } from 'zod';

/**
 * Schemas for Gempa API v2.0.0 (https://gempa.rone.dev/docs - OAS 3.1)
 */
export const RoneMediaSchema = z
  .object({
    shakemap: z.string().nullable().optional(),
    location_map: z.string().nullable().optional(),
    station_intensity: z.string().nullable().optional(),
    impact: z.string().nullable().optional(),
    intensity: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const RoneMetaSchema = z.object({
  count: z.number().int().nonnegative(),
  source: z.string().min(1),
  generated_at: z.string().min(1),
});

export const RoneEarthquakeItemSchema = z.object({
  event_id: z.string().min(1),
  origin_time: z.string().min(1),
  magnitude: z.number(),
  depth_km: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  region: z.string().min(1),
  tsunami_potential: z.boolean().nullable().optional(),
  potential: z.string().nullable().optional(),
  felt: z.string().nullable().optional(),
  instruction: z.string().nullable().optional(),
  has_narrative: z.boolean().nullable().optional(),
  media: RoneMediaSchema,
});

export type RoneEarthquakeItemRaw = z.infer<typeof RoneEarthquakeItemSchema>;

export const RoneRealtimeItemSchema = z.object({
  event_id: z.string().min(1),
  origin_time: z.string().min(1),
  magnitude: z.number(),
  depth_km: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  region: z.string().min(1),
  status: z.string().nullable().optional(),
  has_focal_mechanism: z.boolean().nullable().optional(),
});

export type RoneRealtimeItemRaw = z.infer<typeof RoneRealtimeItemSchema>;

export const RoneSingleEarthquakeEnvelopeSchema = z.object({
  data: RoneEarthquakeItemSchema,
  meta: RoneMetaSchema,
});

export const RoneListEarthquakeEnvelopeSchema = z.object({
  data: z.array(RoneEarthquakeItemSchema),
  meta: RoneMetaSchema,
});

export const RoneListRealtimeEnvelopeSchema = z.object({
  data: z.array(RoneRealtimeItemSchema),
  meta: RoneMetaSchema,
});

/**
 * Schemas for upstream BMKG Open Data (https://data.bmkg.go.id/DataMKG/TEWS)
 */
export const BmkgGempaItemSchema = z.object({
  Tanggal: z.string().min(1),
  Jam: z.string().min(1),
  DateTime: z.string().min(1),
  Coordinates: z.string().min(3),
  Lintang: z.string().min(1),
  Bujur: z.string().min(1),
  Magnitude: z.union([z.string(), z.number()]),
  Kedalaman: z.string().min(1),
  Wilayah: z.string().min(1),
  Potensi: z.string().optional(),
  Dirasakan: z.string().optional(),
  Shakemap: z.string().optional(),
});

export type BmkgGempaItemRaw = z.infer<typeof BmkgGempaItemSchema>;

export const BmkgSingleResponseSchema = z.object({
  Infogempa: z.object({
    gempa: BmkgGempaItemSchema,
  }),
});

export const BmkgListResponseSchema = z.object({
  Infogempa: z.object({
    gempa: z.array(BmkgGempaItemSchema),
  }),
});

/**
 * Schemas for USGS FDSNWS Global Catalog
 */
export const UsgsFeatureSchema = z.object({
  id: z.string().min(1),
  type: z.literal('Feature'),
  properties: z.object({
    mag: z.number().nullable(),
    place: z.string().nullable(),
    time: z.number(),
    updated: z.number().optional().nullable(),
    url: z.string().optional().nullable(),
    tsunami: z.number().optional().nullable(),
    mmi: z.number().optional().nullable(),
    status: z.string().optional().nullable(),
    magType: z.string().optional().nullable(),
    title: z.string().optional().nullable(),
  }),
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number(), z.number()]),
  }),
});

export type UsgsFeatureRaw = z.infer<typeof UsgsFeatureSchema>;

export const UsgsFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(UsgsFeatureSchema),
});

export const EarthquakeQuerySchema = z.object({
  search: z.string().max(120).optional().default(''),
  minMag: z.coerce.number().min(0).max(10).optional().default(0),
  maxMag: z.coerce.number().min(0).max(10).optional().default(10),
  minDepth: z.coerce.number().min(0).max(1000).optional().default(0),
  maxDepth: z.coerce.number().min(0).max(1000).optional().default(1000),
  depthCategory: z
    .enum(['all', 'shallow', 'intermediate', 'deep'])
    .optional()
    .default('all'),
  sourceAgency: z.enum(['all', 'BMKG', 'USGS']).optional().default('all'),
  sourceId: z
    .enum([
      'all',
      'RONE_LATEST',
      'RONE_REALTIME',
      'RONE_FELT',
      'RONE_SIGNIFICANT',
      'BMKG_LATEST',
      'BMKG_M5',
      'BMKG_FELT',
      'USGS_GLOBAL',
    ])
    .optional()
    .default('all'),
  tectonicZone: z.string().max(80).optional().default('all'),
  sortBy: z.enum(['time', 'magnitude', 'depth']).optional().default('time'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export type ValidatedEarthquakeQuery = z.infer<typeof EarthquakeQuerySchema>;
