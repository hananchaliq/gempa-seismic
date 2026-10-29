import { GempaRoneApp } from "@/components/rone/GempaRoneApp";
import { loadInitialRoneData } from "@/lib/rone/loadInitialData";
import { buildSeismicJsonLd, createPageMetadata } from "@/lib/rone/seo";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Panduan Info Gempa BMKG, Skala Magnitudo & Intensitas MMI",
  description:
    "Penjelasan lengkap sumber data gempa bumi BMKG InaTEWS, kategori skala magnitudo (Mikro, Ringan, Sedang, Kuat, Besar), dan skala guncangan MMI.",
  path: "/about",
});

export default async function AboutPage() {
  const initialData = await loadInitialRoneData();
  const jsonLd = buildSeismicJsonLd(initialData);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GempaRoneApp initialTab="about" initialData={initialData} />
    </>
  );
}
