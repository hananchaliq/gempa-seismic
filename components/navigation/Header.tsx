'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Moon, RefreshCw, Sun } from 'lucide-react';
import { useSeismaTheme } from '@/components/theme/ThemeProvider';
import { FeedHealthState } from '@/lib/earthquakes/types';

interface HeaderProps {
  feedHealth?: FeedHealthState;
  lastUpdatedIso?: string;
  onRefreshRequest?: () => void;
  isRefreshing?: boolean;
}

const NAV_ITEMS = [
  { href: '/', label: 'Terkini', matchExact: true },
  { href: '/catalog', label: 'Katalog & Realtime', matchExact: false },
  { href: '/earthquakes', label: 'Peta', matchExact: false },
  { href: '/insights', label: 'Analisis', matchExact: false },
  { href: '/sources', label: 'Tentang', matchExact: false },
];

export function Header({
  feedHealth = 'live_official',
  lastUpdatedIso,
  onRefreshRequest,
  isRefreshing = false,
}: HeaderProps) {
  const pathname = usePathname();
  const { resolvedTheme, setThemeMode } = useSeismaTheme();

  const formattedClock = React.useMemo(() => {
    if (!lastUpdatedIso) return '04.43';
    const d = new Date(Date.parse(lastUpdatedIso) + 7 * 3600 * 1000);
    if (Number.isNaN(d.getTime())) return '04.43';
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hh}.${mm}`;
  }, [lastUpdatedIso]);

  const isErrorState = feedHealth === 'archive_fallback';

  const handleToggleTheme = () => {
    setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="site-header">
      <div className="rone-container">
        <div className="site-header__bar">
          {/* Left: Brand with seismic waveform icon matching gempa.rone.dev */}
          <Link href="/" className="brand" aria-label="Gempa · SEISMA — beranda">
            <Activity className="w-6 h-5 text-[var(--accent)]" strokeWidth={2.5} />
            <span>Gempa</span>
          </Link>

          {/* Center: Inset Neumorphic Pill Navigation */}
          <div className="nav-wrap">
            <nav className="nav" aria-label="Navigasi utama">
              {NAV_ITEMS.map((item) => {
                const isActive = item.matchExact
                  ? pathname === item.href
                  : pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Live status well + Circular theme toggle */}
          <div className="header-tools">
            {onRefreshRequest ? (
              <button
                type="button"
                onClick={onRefreshRequest}
                disabled={isRefreshing}
                data-state={isErrorState ? 'error' : 'ok'}
                className="live cursor-pointer border-0"
                title="Klik untuk memperbarui data dari Gempa API (gempa.rone.dev)"
              >
                <span className="live__dot" aria-hidden="true" />
                <span className="live__label">
                  {isRefreshing ? 'Memperbarui...' : `Diperbarui ${formattedClock}`}
                </span>
                {isRefreshing && <RefreshCw className="w-3 h-3 animate-spin ml-1" />}
              </button>
            ) : (
              <div
                className="live"
                data-state={isErrorState ? 'error' : 'ok'}
                title={
                  isErrorState
                    ? 'Menggunakan arsip terverifikasi'
                    : 'Sinkronisasi aktif dengan Gempa API (gempa.rone.dev) & BMKG'
                }
              >
                <span className="live__dot" aria-hidden="true" />
                <span className="live__label">Diperbarui {formattedClock}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleToggleTheme}
              className="icon-btn"
              aria-label="Ganti tema terang/gelap"
              title={
                resolvedTheme === 'dark'
                  ? 'Beralih ke tema terang (Seismic Clay)'
                  : 'Beralih ke tema gelap'
              }
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-[18px] h-[18px]" />
              ) : (
                <Moon className="w-[18px] h-[18px]" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
