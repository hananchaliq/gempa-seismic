import { GempaRoneApp } from "@/components/rone/GempaRoneApp";
import { loadInitialRoneData } from "@/lib/rone/loadInitialData";
import { buildSeismicJsonLd, createPageMetadata } from "@/lib/rone/seo";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Gempa Terbaru M5+ Hari Ini — Gempa Bumi Signifikan BMKG",
  description:
    "Informasi gempa terbaru magnitudo M 5,0+ hari ini di Indonesia lengkap dengan analisis potensi tsunami dan titik koordinat episenter resmi BMKG.",
  path: "/m5",
});

export default async function M5Page() {
  const initialData = await loadInitialRoneData();
  const jsonLd = buildSeismicJsonLd(initialData);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GempaRoneApp initialTab="significant" initialData={initialData} />
    </>
  );
}
