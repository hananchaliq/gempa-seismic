'use client';

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { BarChart3, Table2, Info } from 'lucide-react';
import { SeismicStatistics } from '@/lib/earthquakes/types';
import { formatCommaNumber } from '@/lib/earthquakes/parser';

export interface SeismicAnalyticsChartsProps {
  statistics: SeismicStatistics;
}

const MAG_BUCKET_COLORS = ['#a39a8c', '#e8b10c', '#f08c1a', '#d0461a', '#b3202f', '#6e1426'];
const DEPTH_BUCKET_COLORS = ['#d0461a', '#e8b10c', '#2f7a4b'];

export function SeismicAnalyticsCharts({ statistics }: SeismicAnalyticsChartsProps) {
  const [accessibleTableMode, setAccessibleTableMode] = useState(false);

  if (statistics.totalEvents === 0) {
    return (
      <div className="card p-6 text-center text-sm text-[var(--muted)]">
        Tidak ada sampel data kejadian untuk menghasilkan grafik analitik pada filter saat ini.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Methodology & Accessible Toggle Header */}
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
          <div className="text-xs leading-relaxed text-[var(--ink-2)]">
            <strong className="text-[var(--ink)]">Metodologi &amp; Kelengkapan Sampel:</strong>{' '}
            Visualisasi dihitung langsung dari <strong>{statistics.totalEvents} kejadian aktual</strong> yang berada pada katalog saat ini ({statistics.bmkgCount} BMKG via <code className="font-mono">gempa.rone.dev</code> &amp; {statistics.usgsCount} USGS). Frekuensi kejadian pada suatu wilayah mencerminkan sensitivitas jaringan sensor dan rentang waktu pengambilan, bukan prediksi bahaya masa depan.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAccessibleTableMode((v) => !v)}
          className="btn shrink-0"
        >
          {accessibleTableMode ? (
            <>
              <BarChart3 className="h-3.5 w-3.5 text-[var(--accent)]" />
              Tampilkan Grafik Visual
            </>
          ) : (
            <>
              <Table2 className="h-3.5 w-3.5 text-[var(--accent)]" />
              Alternatif Tabel Aksesibel
            </>
          )}
        </button>
      </div>

      {accessibleTableMode ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="card p-6">
            <h3 className="text-sm font-bold text-[var(--ink)]">
              Tabel Distribusi Magnitudo (n = {statistics.totalEvents})
            </h3>
            <table className="mt-3 w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--rule)] text-[var(--muted)]">
                  <th className="py-2">Rentang Skala</th>
                  <th className="py-2">Klasifikasi</th>
                  <th className="py-2 text-right">Jumlah Kejadian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)] font-mono">
                {statistics.magnitudeDistribution.map((b) => (
                  <tr key={b.range}>
                    <td className="py-2 font-semibold text-[var(--ink)]">{b.range}</td>
                    <td className="py-2 text-[var(--muted)]">{b.label}</td>
                    <td className="py-2 text-right text-[var(--ink-2)]">{b.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-bold text-[var(--ink)]">
              Tabel Distribusi Kedalaman Hiposenter (n = {statistics.totalEvents})
            </h3>
            <table className="mt-3 w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--rule)] text-[var(--muted)]">
                  <th className="py-2">Zona Kedalaman</th>
                  <th className="py-2 text-right">Jumlah Kejadian</th>
                  <th className="py-2 text-right">Persentase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)] font-mono">
                {statistics.depthDistribution.map((b) => (
                  <tr key={b.category}>
                    <td className="py-2 font-semibold text-[var(--ink)]">
                      {b.label} ({b.rangeLabel})
                    </td>
                    <td className="py-2 text-right text-[var(--ink-2)]">{b.count}</td>
                    <td className="py-2 text-right text-[var(--muted)]">
                      {formatCommaNumber(b.percentage, 1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Histogram 1: Magnitude Distribution */}
          <div className="card p-6 lg:col-span-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="section-head__eyebrow">
                  Distribusi Magnitudo
                </span>
                <h3 className="text-base font-bold text-[var(--ink)]">
                  Histogram Kelas Magnitudo (n = {statistics.totalEvents})
                </h3>
              </div>
              <span className="rounded-full bg-[var(--well)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--muted)] shadow-[var(--inset-sm)]">
                Rerata M {formatCommaNumber(statistics.meanMagnitude, 1)}
              </span>
            </div>

            <div className="well h-64 w-full p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statistics.magnitudeDistribution}
                  margin={{ top: 10, right: 12, left: -16, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,36,29,0.1)" />
                  <XAxis
                    dataKey="range"
                    tick={{ fill: '#766c5e', fontSize: 11, fontFamily: 'monospace' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#766c5e', fontSize: 11, fontFamily: 'monospace' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#2a241d',
                      borderColor: 'rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#faf6ef',
                    }}
                  />
                  <Bar dataKey="count" name="Jumlah Gempa" radius={[6, 6, 0, 0]}>
                    {statistics.magnitudeDistribution.map((entry, idx) => (
                      <Cell
                        key={entry.range}
                        fill={MAG_BUCKET_COLORS[idx % MAG_BUCKET_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Histogram 2: Depth Distribution */}
          <div className="card p-6 lg:col-span-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="section-head__eyebrow">
                  Profil Litosfer &amp; Subduksi
                </span>
                <h3 className="text-base font-bold text-[var(--ink)]">
                  Distribusi Zona Kedalaman Hiposenter (km)
                </h3>
              </div>
              <span className="rounded-full bg-[var(--well)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--muted)] shadow-[var(--inset-sm)]">
                Median {formatCommaNumber(statistics.medianDepthKm, 0)} km
              </span>
            </div>

            <div className="well h-64 w-full p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statistics.depthDistribution}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,36,29,0.1)" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: '#766c5e', fontSize: 11, fontFamily: 'monospace' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={95}
                    tick={{ fill: '#766c5e', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#2a241d',
                      borderColor: 'rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#faf6ef',
                    }}
                  />
                  <Bar dataKey="count" name="Jumlah Gempa" radius={[0, 6, 6, 0]}>
                    {statistics.depthDistribution.map((entry, idx) => (
                      <Cell
                        key={entry.category}
                        fill={DEPTH_BUCKET_COLORS[idx % DEPTH_BUCKET_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Scatter Plot: Magnitude vs Depth Profile */}
          <div className="card p-6 lg:col-span-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="section-head__eyebrow">
                  Penampang Wadati–Benioff
                </span>
                <h3 className="text-base font-bold text-[var(--ink)]">
                  Sebaran Magnitudo terhadap Kedalaman Hiposenter
                </h3>
              </div>
              <span className="font-mono text-xs text-[var(--muted)]">
                n = {statistics.scatterPoints.length} sampel plot
              </span>
            </div>

            <div className="well h-72 w-full p-3">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,36,29,0.1)" />
                  <XAxis
                    type="number"
                    dataKey="magnitude"
                    name="Magnitudo"
                    domain={[2.0, 'auto']}
                    unit=" M"
                    tick={{ fill: '#766c5e', fontSize: 11, fontFamily: 'monospace' }}
                  />
                  <YAxis
                    type="number"
                    dataKey="depthKm"
                    name="Kedalaman"
                    reversed
                    unit=" km"
                    tick={{ fill: '#766c5e', fontSize: 11, fontFamily: 'monospace' }}
                  />
                  <ZAxis type="number" dataKey="magnitude" range={[45, 210]} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-xl bg-[#2a241d] p-3 text-xs text-[#faf6ef] shadow-xl">
                          <div className="font-mono font-bold text-[#f08c1a]">
                            M {Number(item.magnitude).toFixed(1)} · Kedalaman {item.depthKm} km
                          </div>
                          <div className="mt-1 font-semibold">{item.region}</div>
                          <div className="mt-0.5 font-mono text-[11px] opacity-80">
                            Sumber: {item.sourceAgency}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Scatter name="Kejadian Gempa" data={statistics.scatterPoints}>
                    {statistics.scatterPoints.map((entry) => {
                      const color =
                        entry.magnitude >= 6
                          ? '#b3202f'
                          : entry.magnitude >= 5
                            ? '#d0461a'
                            : entry.magnitude >= 4
                              ? '#f08c1a'
                              : '#e8b10c';
                      return <Cell key={entry.id} fill={color} />;
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Regional Frequency Summary */}
          <div className="card p-6 lg:col-span-4">
            <span className="section-head__eyebrow">
              Distribusi Zona Tektonik
            </span>
            <h3 className="text-base font-bold text-[var(--ink)]">
              Aktivitas Berdasarkan Zona Tektonik
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Dihitung dari sampel katalog aktif ({statistics.totalEvents} kejadian).
            </p>

            <div className="mt-4 space-y-2.5">
              {statistics.regionalBreakdown.slice(0, 6).map((item) => (
                <div
                  key={item.zone}
                  className="well flex items-center justify-between px-3.5 py-2.5"
                >
                  <div className="min-w-0 pr-2">
                    <div className="truncate text-xs font-bold text-[var(--ink)]">
                      {item.zone}
                    </div>
                    <div className="font-mono text-[11px] text-[var(--muted)]">
                      Maks M {formatCommaNumber(item.maxMagnitude, 1)} · Rerata{' '}
                      {formatCommaNumber(item.avgDepthKm, 0)} km
                    </div>
                  </div>
                  <span className="rounded-full bg-[var(--clay)] px-2.5 py-1 font-mono text-xs font-bold text-[var(--accent)] shadow-[var(--raise-sm)]">
                    {item.count} event
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SeismicAnalyticsCharts;
