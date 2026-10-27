export type SourceId =
  | 'RONE_LATEST'
  | 'RONE_REALTIME'
  | 'RONE_FELT'
  | 'RONE_SIGNIFICANT'
  | 'BMKG_LATEST'
  | 'BMKG_M5'
  | 'BMKG_FELT'
  | 'USGS_GLOBAL';

export type DepthCategory = 'shallow' | 'intermediate' | 'deep';

export type MagnitudeClass =
  | 'minor'
  | 'light'
  | 'moderate'
  | 'strong'
  | 'major'
  | 'great';

export type VerificationStatus = 'verified' | 'preliminary';

export type TsunamiAdvisoryStatus =
  | 'no_potential'
  | 'potential_warning'
  | 'felt_local'
  | 'official_info_unavailable';

export interface RoneEventMedia {
  shakemap?: string | null;
  location_map?: string | null;
  station_intensity?: string | null;
  impact?: string | null;
  intensity?: string | null;
}

export interface SeismicEvent {
  id: string;
  sourceId: SourceId;
  sourceAgency: 'BMKG' | 'USGS';
  sourceUrl: string;
  title: string;
  region: string;
  subRegion: string;
  magnitude: number;
  magnitudeType: string;
  magnitudeClass: MagnitudeClass;
  depthKm: number;
  depthCategory: DepthCategory;
  latitude: number;
  longitude: number;
  coordinatesText: string;
  originTimeIso: string;
  originTimeEpochMs: number;
  formattedTimeWib: string;
  formattedTimeUtc: string;
  tsunamiStatus: TsunamiAdvisoryStatus;
  tsunamiOfficialText: string;
  feltReport: string | null;
  instructionText?: string | null;
  shakemapUrl: string | null;
  mediaUrls?: RoneEventMedia | null;
  verificationStatus: VerificationStatus;
  tectonicZone: string;
  isArchiveFallback?: boolean;
}

export type FeedHealthState =
  | 'live_official'
  | 'cached_official'
  | 'stale_cache'
  | 'archive_fallback';

export interface SourceStatusReport {
  sourceId: SourceId;
  name: string;
  endpoint: string;
  ok: boolean;
  recordCount: number;
  fetchedAtIso: string;
  latencyMs: number;
  errorMessage: string | null;
}

export interface DatasetEnvelope {
  latestBmkgEvent: SeismicEvent;
  events: SeismicEvent[];
  feedHealth: FeedHealthState;
  lastUpdatedIso: string;
  cacheAgeSeconds: number;
  sources: SourceStatusReport[];
  disclaimer: string;
}

export interface EarthquakeFilterParams {
  search?: string;
  minMag?: number;
  maxMag?: number;
  minDepth?: number;
  maxDepth?: number;
  depthCategory?: DepthCategory | 'all';
  sourceAgency?: 'BMKG' | 'USGS' | 'all';
  sourceId?: SourceId | 'all';
  tectonicZone?: string | 'all';
  sortBy?: 'time' | 'magnitude' | 'depth';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface MagnitudeBucket {
  range: string;
  label: string;
  count: number;
  min: number;
  max: number;
}

export interface DepthBucket {
  category: DepthCategory;
  label: string;
  rangeLabel: string;
  count: number;
  percentage: number;
}

export interface DailyActivityPoint {
  date: string;
  label: string;
  count: number;
  maxMagnitude: number;
  avgDepthKm: number;
}

export interface RegionalActivitySummary {
  zone: string;
  count: number;
  maxMagnitude: number;
  avgDepthKm: number;
  shallowCount: number;
  intermediateCount: number;
  deepCount: number;
}

export interface DepthMagnitudeScatterPoint {
  id: string;
  region: string;
  depthKm: number;
  magnitude: number;
  depthCategory: DepthCategory;
  sourceAgency: 'BMKG' | 'USGS';
  originTimeIso: string;
}

export interface SeismicStatistics {
  totalEvents: number;
  bmkgCount: number;
  usgsCount: number;
  maxMagnitudeEvent: SeismicEvent | null;
  deepestEvent: SeismicEvent | null;
  shallowestEvent: SeismicEvent | null;
  meanMagnitude: number;
  medianMagnitude: number;
  meanDepthKm: number;
  medianDepthKm: number;
  significantCountM5Plus: number;
  feltEventsCount: number;
  periodStartIso: string | null;
  periodEndIso: string | null;
  magnitudeDistribution: MagnitudeBucket[];
  depthDistribution: DepthBucket[];
  dailySeries: DailyActivityPoint[];
  regionalBreakdown: RegionalActivitySummary[];
  scatterPoints: DepthMagnitudeScatterPoint[];
}
