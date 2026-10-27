import type { Metadata } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Gempa · SEISMA — Pemantauan Gempa Bumi Terkini di Indonesia',
  description:
    'Gempa terakhir yang dirasakan dan deteksi real-time dari jaringan seismik BMKG (via gempa.rone.dev API) & USGS, lengkap dengan peta episentrum, observatorium 3D, dan analisis statistik.',
  openGraph: {
    title: 'Gempa · SEISMA — Pemantauan Gempa Bumi Terkini di Indonesia',
    description:
      'Gempa terakhir yang dirasakan dan deteksi real-time dari jaringan seismik BMKG (via gempa.rone.dev API) & USGS, lengkap dengan peta episentrum, observatorium 3D, dan analisis statistik.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gempa · SEISMA — Pemantauan Gempa Bumi Terkini di Indonesia',
    description:
      'Gempa terakhir yang dirasakan dan deteksi real-time dari jaringan seismik BMKG (via gempa.rone.dev API) & USGS, lengkap dengan peta episentrum, observatorium 3D, dan analisis statistik.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      data-theme="light"
      className={`light settled ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="font-sans antialiased bg-[var(--clay)] text-[var(--ink)]"
        suppressHydrationWarning
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
