import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
   subsets: ["latin"],
   weight: ["400", "500", "600", "700", "800"],
   variable: "--font-jakarta",
   display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
   subsets: ["latin"],
   weight: ["400", "600", "700"],
   variable: "--font-jetbrains",
   display: "swap",
});

export const metadata: Metadata = {
   title: "Gempa Seismic — Pemantauan Gempa Bumi Real-Time Indonesia",
   icons: {
      icon: "/assets/favicon.png",
   },
   description: "Deteksi sensor seismograf real-time, peta guncangan BMKG InaTEWS, analisis kedalaman hiposenter, dan kalkulasi jarak gelombang.",
   openGraph: {
      title: "Gempa Seismic — Pemantauan Gempa Bumi Real-Time Indonesia",
      description: "Deteksi sensor seismograf real-time, peta guncangan BMKG InaTEWS, analisis kedalaman hiposenter, dan kalkulasi jarak gelombang.",
      type: "website",
   },
   twitter: {
      card: "summary_large_image",
      title: "Gempa Seismic — Pemantauan Gempa Bumi Real-Time Indonesia",
      description: "Deteksi sensor seismograf real-time, peta guncangan BMKG InaTEWS, analisis kedalaman hiposenter, dan kalkulasi jarak gelombang.",
   },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
   return (
      <html lang="id" data-theme="light" className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
         <body suppressHydrationWarning>{children}</body>
      </html>
   );
}
