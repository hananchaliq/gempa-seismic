import { GempaRoneApp } from "@/components/rone/GempaRoneApp";
import { loadInitialRoneData } from "@/lib/rone/loadInitialData";
import { buildSeismicJsonLd, createPageMetadata } from "@/lib/rone/seo";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Peta Gempa Hari Ini & Lokasi Terdekat — Radar Seismik Live",
  description:
    "Peta interaktif gempa hari ini, gempa barusan, jalur sesar aktif Indonesia, dan jaringan stasiun seismograf BMKG secara real-time.",
  path: "/map",
});

export default async function MapPage() {
  const initialData = await loadInitialRoneData();
  const jsonLd = buildSeismicJsonLd(initialData);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GempaRoneApp initialTab="map" initialData={initialData} />
    </>
  );
}
