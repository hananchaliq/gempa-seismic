import { GempaRoneApp } from "@/components/rone/GempaRoneApp";
import { loadInitialRoneData } from "@/lib/rone/loadInitialData";
import { buildSeismicJsonLd, createPageMetadata } from "@/lib/rone/seo";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Gempa Barusan 2 Detik & 1 Menit Lalu — Deteksi Sensor Real-Time",
  description:
    "Pantau gempa barusan, gempa 2 detik lalu, gempa 1 menit lalu, dan deteksi sensor seismograf otomatis di seluruh wilayah Indonesia secara live real-time.",
  path: "/realtime",
});

export default async function RealtimePage() {
  const initialData = await loadInitialRoneData();
  const jsonLd = buildSeismicJsonLd(initialData);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GempaRoneApp initialTab="realtime" initialData={initialData} />
    </>
  );
}
