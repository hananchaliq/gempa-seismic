import { DepthCategory, MagnitudeClass, TsunamiAdvisoryStatus } from './types';

export interface MagnitudeVisualSpec {
  magnitudeClass: MagnitudeClass;
  labelId: string;
  rangeText: string;
  glyph: string;
  hexDark: string;
  hexLight: string;
  textClass: string;
  borderClass: string;
  markerRadiusPx: number;
}

/**
 * Aligned with gempa.rone.dev "Seismic Clay" Magnitude Ramp:
 * --m-0: #a39a8c | --m-3: #e8b10c | --m-4: #f08c1a | --m-5: #d0461a | --m-6: #b3202f | --m-7: #6e1426
 */
export const MAGNITUDE_SCALE_SPECS: Record<MagnitudeClass, MagnitudeVisualSpec> = {
  minor: {
    magnitudeClass: 'minor',
    labelId: 'Kecil',
    rangeText: '< 4,0',
    glyph: '[I]',
    hexDark: '#e8b10c',
    hexLight: '#d49e08',
    textClass: 'text-[#8c6804] dark:text-[#e8b10c]',
    borderClass: 'border-[#e8b10c]/50',
    markerRadiusPx: 6,
  },
  light: {
    magnitudeClass: 'light',
    labelId: 'Ringan',
    rangeText: '4,0 – 4,9',
    glyph: '[II]',
    hexDark: '#f08c1a',
    hexLight: '#f08c1a',
    textClass: 'text-[#b45309] dark:text-[#f08c1a]',
    borderClass: 'border-[#f08c1a]/50',
    markerRadiusPx: 8,
  },
  moderate: {
    magnitudeClass: 'moderate',
    labelId: 'Sedang',
    rangeText: '5,0 – 5,9',
    glyph: '[III]',
    hexDark: '#d0461a',
    hexLight: '#c2410c',
    textClass: 'text-[#9a3409] dark:text-[#f07a3c]',
    borderClass: 'border-[#d0461a]/55',
    markerRadiusPx: 11,
  },
  strong: {
    magnitudeClass: 'strong',
    labelId: 'Kuat',
    rangeText: '6,0 – 6,9',
    glyph: '[IV]',
    hexDark: '#b3202f',
    hexLight: '#b3202f',
    textClass: 'text-[#b3202f] dark:text-[#f87171]',
    borderClass: 'border-[#b3202f]/60',
    markerRadiusPx: 14,
  },
  major: {
    magnitudeClass: 'major',
    labelId: 'Mayor',
    rangeText: '7,0 – 7,9',
    glyph: '[V]',
    hexDark: '#8e1d35',
    hexLight: '#6e1426',
    textClass: 'text-[#6e1426] dark:text-[#fb7185]',
    borderClass: 'border-[#6e1426]/65',
    markerRadiusPx: 18,
  },
  great: {
    magnitudeClass: 'great',
    labelId: 'Dahsyat',
    rangeText: '≥ 8,0',
    glyph: '[VI]',
    hexDark: '#8e1d35',
    hexLight: '#6e1426',
    textClass: 'text-[#6e1426] dark:text-[#fb7185]',
    borderClass: 'border-[#6e1426]/75',
    markerRadiusPx: 22,
  },
};

export interface DepthVisualSpec {
  category: DepthCategory;
  labelId: string;
  shortCode: string;
  rangeText: string;
  description: string;
  hexDark: string;
  hexLight: string;
  textClass: string;
}

export const DEPTH_SCALE_SPECS: Record<DepthCategory, DepthVisualSpec> = {
  shallow: {
    category: 'shallow',
    labelId: 'Dangkal',
    shortCode: 'SHL',
    rangeText: '< 70 km',
    description: 'Kerak dangkal & zona megathrust atas; guncangan permukaan relatif lebih terasa.',
    hexDark: '#f07a3c',
    hexLight: '#c2410c',
    textClass: 'text-[#9a3409] dark:text-[#f59a66]',
  },
  intermediate: {
    category: 'intermediate',
    labelId: 'Menengah',
    shortCode: 'INT',
    rangeText: '70 – 300 km',
    description: 'Zona Wadati-Benioff menengah pada lempeng samudra yang menunjam.',
    hexDark: '#e8b10c',
    hexLight: '#b45309',
    textClass: 'text-[#92400e] dark:text-[#e8b10c]',
  },
  deep: {
    category: 'deep',
    labelId: 'Dalam',
    shortCode: 'DEP',
    rangeText: '> 300 km',
    description: 'Hiposenter mantel transisi dalam (umum di Laut Banda & Laut Flores); radius sebaran luas namun atenuasi permukaan tinggi.',
    hexDark: '#6cc190',
    hexLight: '#2f7a4b',
    textClass: 'text-[#2f7a4b] dark:text-[#6cc190]',
  },
};

export function getMagnitudeSpec(magnitudeClass: MagnitudeClass): MagnitudeVisualSpec {
  return MAGNITUDE_SCALE_SPECS[magnitudeClass];
}

export function getDepthSpec(category: DepthCategory): DepthVisualSpec {
  return DEPTH_SCALE_SPECS[category];
}

export function getTsunamiStatusPresentation(status: TsunamiAdvisoryStatus): {
  codeLabel: string;
  shortStatusLabel: string;
  summaryLabel: string;
  toneClass: string;
} {
  switch (status) {
    case 'no_potential':
      return {
        codeLabel: 'STATUS RESMI: TIDAK BERPOTENSI TSUNAMI',
        shortStatusLabel: 'Tidak berpotensi',
        summaryLabel: 'Parameter resmi menyatakan tidak berpotensi tsunami',
        toneClass: 'text-[#2f7a4b] dark:text-[#6cc190]',
      };
    case 'potential_warning':
      return {
        codeLabel: 'PERINGATAN / EVALUASI TSUNAMI RESMI',
        shortStatusLabel: 'Berpotensi tsunami',
        summaryLabel: 'Terdapat catatan potensi tsunami — periksa arahan resmi BMKG InaTEWS',
        toneClass: 'text-[#b3202f] dark:text-[#f87171]',
      };
    case 'felt_local':
      return {
        codeLabel: 'GEMPA DIRASAKAN MASYARAKAT',
        shortStatusLabel: 'Tidak berpotensi',
        summaryLabel: 'Dirasakan pada skala MMI lokal tanpa indikasi tsunami',
        toneClass: 'text-[#9a3409] dark:text-[#f59a66]',
      };
    default:
      return {
        codeLabel: 'INFORMASI TSUNAMI RESMI TIDAK TERSEDIA',
        shortStatusLabel: 'Tidak berpotensi',
        summaryLabel: 'Rujuk langsung kanal resmi BMKG untuk status keselamatan pesisir',
        toneClass: 'text-[#625849] dark:text-[#9d9383]',
      };
  }
}
