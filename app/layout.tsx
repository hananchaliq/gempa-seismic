import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { SEISMIC_SEO_KEYWORDS, SITE_NAME, SITE_URL } from "@/lib/rone/seo";
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

export const viewport: Viewport = {
   width: "device-width",
   initialScale: 1,
   maximumScale: 5,
   themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#E4E4DF" },
      { media: "(prefers-color-scheme: dark)", color: "#09090B" },
   ],
};

export const metadata: Metadata = {
   metadataBase: new URL(SITE_URL),
   title: {
      default: "Gempa Hari Ini & Gempa Barusan — Info Gempa Terkini BMKG Real-Time",
      template: "%s | Gempa Seismic — Info Gempa Hari Ini BMKG",
   },
   icons: {
      icon: "/assets/favicon.png",
   },
   description: "Cek info gempa hari ini, gempa barusan, gempa 2 detik lalu, gempa 1 menit lalu, dan gempa terbaru di Indonesia secara real-time dari sensor BMKG InaTEWS beserta peta guncangan & tsunami.",
   applicationName: "Gempa Seismic Indonesia",
   keywords: SEISMIC_SEO_KEYWORDS,
   category: "news",
   alternates: {
      canonical: "/",
      languages: {
         "id-ID": "/",
      },
   },
   robots: {
      index: true,
      follow: true,
      googleBot: {
         index: true,
         follow: true,
         "max-snippet": -1,
         "max-image-preview": "large",
         "max-video-preview": -1,
      },
   },
   openGraph: {
      title: "Gempa Hari Ini & Gempa Barusan — Info Gempa Terkini BMKG Real-Time",
      description: "Cek info gempa hari ini, gempa barusan, gempa 2 detik lalu, gempa 1 menit lalu, dan gempa terbaru di Indonesia secara real-time dari sensor BMKG InaTEWS.",
      url: SITE_URL,
      siteName: SITE_NAME,
      locale: "id_ID",
      type: "website",
   },
   twitter: {
      card: "summary_large_image",
      title: "Gempa Hari Ini & Gempa Barusan — Info Gempa Terkini BMKG Real-Time",
      description: "Cek info gempa hari ini, gempa barusan, gempa 2 detik lalu, gempa 1 menit lalu, dan gempa terbaru di Indonesia secara real-time dari sensor BMKG InaTEWS.",
   },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
   return (
      <html lang="id" data-theme="light" className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
         <body suppressHydrationWarning>{children}</body>
      </html>
   );
}
