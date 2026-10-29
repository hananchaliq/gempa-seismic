import { GempaRoneApp } from "@/components/rone/GempaRoneApp";
import { loadInitialRoneData } from "@/lib/rone/loadInitialData";
import { buildSeismicJsonLd, createPageMetadata } from "@/lib/rone/seo";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Katalog Gempa Merusak Indonesia — Riwayat & Dampak Gempa BMKG",
  description:
    "Katalog historis gempa bumi merusak di Indonesia sejak tahun 1920 lengkap dengan magnitudo, provinsi terdampak, korban jiwa, dan kerusakan bangunan.",
  path: "/damage",
});

export default async function DamagePage() {
  const initialData = await loadInitialRoneData();
  const jsonLd = buildSeismicJsonLd(initialData);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GempaRoneApp initialTab="damaging" initialData={initialData} />
    </>
  );
}
