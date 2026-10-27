import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="rone-container">
        <div className="site-footer__inner">
          <div>
            <p>
              Data gempa bumi dan tsunami: <strong className="text-[var(--ink)]">BMKG</strong>{' '}
              (Badan Meteorologi, Klimatologi, dan Geofisika) melalui{' '}
              <a
                href="https://gempa.rone.dev/docs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Gempa API
              </a>{' '}
              &amp; katalog global USGS.
            </p>
            <p className="mt-1">
              Situs tidak resmi (Platform Observasi SEISMA). Untuk keadaan darurat, ikuti arahan
              BMKG, BNPB, dan BPBD setempat.
            </p>
          </div>

          <nav aria-label="Tautan kaki">
            <Link href="/sources">Tentang data</Link>
            <Link href="/catalog">Katalog &amp; CSV</Link>
            <Link href="/insights">Analisis statistik</Link>
            <a
              href="https://gempa.rone.dev/docs"
              target="_blank"
              rel="noopener noreferrer"
            >
              Dokumentasi API
            </a>
            <a
              href="https://data.bmkg.go.id/gempabumi/"
              target="_blank"
              rel="noopener noreferrer"
            >
              BMKG Terbuka
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
