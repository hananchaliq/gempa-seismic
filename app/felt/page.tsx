import { GempaRoneApp } from "@/components/rone/GempaRoneApp";
import { loadInitialRoneData } from "@/lib/rone/loadInitialData";
import { buildSeismicJsonLd, createPageMetadata } from "@/lib/rone/seo";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Gempa Dirasakan Barusan & Hari Ini — Peta Guncangan MMI BMKG",
  description:
    "Daftar 30 gempa dirasakan barusan dan hari ini di Indonesia lengkap dengan skala intensitas MMI, peta guncangan ShakeMap BMKG, dan kedalaman gempa.",
  path: "/felt",
});

export default async function FeltPage() {
  const initialData = await loadInitialRoneData();
  const jsonLd = buildSeismicJsonLd(initialData);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GempaRoneApp initialTab="felt" initialData={initialData} />
    </>
  );
}
