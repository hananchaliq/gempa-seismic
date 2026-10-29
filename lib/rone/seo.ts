import type { Metadata } from "next";
import type { loadInitialRoneData } from "./loadInitialData";
import { fmtDepth, fmtMag } from "./format";

export type InitialRoneData = Awaited<ReturnType<typeof loadInitialRoneData>>;

export const SITE_URL =
  process.env.APP_URL?.replace(/\/+$/, "") || "https://gempa-seismic.naan.my.id";

export const SITE_NAME = "Gempa Seismic — Info Gempa Hari Ini & Gempa Barusan BMKG";

export const SEISMIC_SEO_KEYWORDS: string[] = [
  // High-intent real-time queries requested by user
  "gempa hari ini",
  "gempa barusan",
  "gempa 2 detik lalu",
  "gempa 1 menit lalu",
  "gempa terbaru",
  "gempa terkini",
  "gempa 5 menit lalu",
  "gempa beberapa detik lalu",
  "info gempa hari ini",
  "info gempa barusan",
  "info gempa terbaru",
  "info gempa terkini",
  "gempa baru saja terjadi",
  "gempa barusan dimana",
  "gempa hari ini dimana",
  "cek gempa barusan",
  "cek gempa hari ini",
  // Official BMKG & technical telemetry queries
  "gempa bmkg",
  "gempa bmkg hari ini",
  "gempa terkini bmkg",
  "info bmkg gempa bumi hari ini",
  "bmkg gempa barusan",
  "gempa dirasakan",
  "gempa dirasakan barusan",
  "gempa dirasakan hari ini",
  "gempa bumi hari ini",
  "gempa bumi terbaru",
  "gempa bumi barusan",
  "deteksi gempa real time",
  "sensor seismograf indonesia",
  "peta gempa hari ini",
  "peta guncangan shakemap bmkg",
  "peringatan dini tsunami hari ini",
  "info tsunami bmkg",
  "gempa m5+ hari ini",
  "gempa signifikan indonesia",
  "pusat gempa hari ini",
  "titik gempa barusan",
  "gempa terdekat dari lokasi saya",
  // Regional high-volume search queries across Indonesia
  "gempa jakarta barusan",
  "gempa jawa barat hari ini",
  "gempa bandung barusan",
  "gempa bogor sukabumi cianjur",
  "gempa garut tasikmalaya pangandaran",
  "gempa banten hari ini",
  "gempa jogja hari ini",
  "gempa jawa tengah hari ini",
  "gempa jawa timur hari ini",
  "gempa malang blitar pacitan",
  "gempa bali hari ini",
  "gempa lombok ntb ntt",
  "gempa sumatera hari ini",
  "gempa padang bengkulu aceh",
  "gempa sulawesi hari ini",
  "gempa maluku papua hari ini",
];

export function createPageMetadata({
  title,
  description,
  path = "/",
}: {
  title: string;
  description: string;
  path?: string;
}): Metadata {
  const canonicalUrl = `${SITE_URL}${path === "/" ? "" : path}`;
  return {
    title,
    description,
    keywords: SEISMIC_SEO_KEYWORDS,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "website",
      locale: "id_ID",
      url: canonicalUrl,
      siteName: SITE_NAME,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function buildSeismicJsonLd(data?: InitialRoneData) {
  const latest = data?.latest;
  const recentRealtime = data?.realtime?.slice(0, 6) ?? [];
  const nowIso = new Date().toISOString();

  const latestHeadline = latest
    ? `Gempa Terbaru M ${fmtMag(latest.magnitude)} ${latest.region} (${fmtDepth(latest.depth_km)})`
    : "Pemantauan Gempa Hari Ini & Gempa Barusan Real-Time Indonesia";

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "Gempa Seismic Indonesia",
        alternateName: [
          "Gempa Hari Ini",
          "Info Gempa Barusan BMKG",
          "Gempa Terkini Real-Time",
          "Gempa 2 Detik Lalu & 1 Menit Lalu",
        ],
        description:
          "Pantau gempa hari ini, gempa barusan, gempa 2 detik lalu, gempa 1 menit lalu, dan gempa terbaru di seluruh Indonesia secara real-time dari jaringan sensor BMKG InaTEWS.",
        inLanguage: "id-ID",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/realtime?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#webapp`,
        name: "Gempa Seismic — Pemantauan Gempa Hari Ini & Barusan",
        url: SITE_URL,
        applicationCategory: "PublicSafetyApplication",
        operatingSystem: "All",
        inLanguage: "id-ID",
        isAccessibleForFree: true,
        description:
          "Aplikasi web pemantauan gempa bumi real-time Indonesia untuk cek gempa hari ini, gempa barusan, gempa 2 detik lalu, gempa 1 menit lalu, peta guncangan MMI, dan peringatan dini tsunami BMKG.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "IDR",
        },
      },
      {
        "@type": "LiveBlogPosting",
        "@id": `${SITE_URL}/#live-earthquake-feed`,
        headline: latestHeadline,
        description:
          "Feed pembaruan langsung gempa hari ini, gempa barusan, gempa 2 detik lalu, dan gempa 1 menit lalu dari sensor seismograf Indonesia.",
        url: SITE_URL,
        dateModified: latest?.origin_time || nowIso,
        coverageStartTime: recentRealtime.at(-1)?.origin_time || nowIso,
        coverageEndTime: nowIso,
        inLanguage: "id-ID",
        about: {
          "@type": "Thing",
          name: "Gempa Bumi Indonesia Hari Ini & Real-Time",
        },
        liveBlogUpdate: recentRealtime.map((ev) => ({
          "@type": "BlogPosting",
          headline: `Gempa M ${fmtMag(ev.magnitude)} — ${ev.region}`,
          datePublished: ev.origin_time,
          articleBody: `Deteksi gempa barusan magnitudo M ${fmtMag(ev.magnitude)} di wilayah ${ev.region} pada kedalaman ${fmtDepth(ev.depth_km)} (koordinat ${ev.latitude}, ${ev.longitude}).`,
          contentLocation: {
            "@type": "Place",
            name: ev.region,
            geo: {
              "@type": "GeoCoordinates",
              latitude: ev.latitude,
              longitude: ev.longitude,
            },
          },
        })),
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "Dimana gempa barusan atau gempa hari ini terjadi?",
            acceptedAnswer: {
              "@type": "Answer",
              text: latest
                ? `Gempa terbaru yang tercatat berada di wilayah ${latest.region} dengan kekuatan magnitudo M ${fmtMag(latest.magnitude)} pada kedalaman ${fmtDepth(latest.depth_km)} (${latest.potential || "data resmi BMKG InaTEWS"}).`
                : "Anda dapat memantau lokasi pusat gempa hari ini dan gempa yang baru saja terjadi hingga hitungan detik lalu langsung pada dashboard Realtime dan Terkini.",
            },
          },
          {
            "@type": "Question",
            name: "Bagaimana cara cek gempa 2 detik lalu atau gempa 1 menit lalu?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Buka menu Realtime di Gempa Seismic untuk melihat deteksi sensor seismograf otomatis yang diperbarui setiap beberapa detik lengkap dengan magnitudo, kedalaman hiposenter, dan jarak dari lokasi Anda.",
            },
          },
          {
            "@type": "Question",
            name: "Apakah gempa terbaru hari ini berpotensi tsunami?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Status potensi tsunami ditampilkan secara langsung pada setiap buletin gempa terkini dan di menu Tsunami (PD-1 hingga PD-4) berdasarkan analisis resmi InaTEWS BMKG.",
            },
          },
        ],
      },
    ],
  };
}
