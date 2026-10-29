import { GempaRoneApp } from "@/components/rone/GempaRoneApp";
import { loadInitialRoneData } from "@/lib/rone/loadInitialData";
import { buildSeismicJsonLd, createPageMetadata } from "@/lib/rone/seo";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Peringatan Dini Tsunami Hari Ini — Buletin InaTEWS BMKG",
  description:
    "Status peringatan dini tsunami hari ini (Awas, Siaga, Waspada), kronologi buletin PD-1 s.d. PD-4, estimasi waktu tiba gelombang, dan pengamatan tinggi muka laut BMKG.",
  path: "/tsunami",
});

export default async function TsunamiPage() {
  const initialData = await loadInitialRoneData();
  const jsonLd = buildSeismicJsonLd(initialData);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GempaRoneApp initialTab="tsunami" initialData={initialData} />
    </>
  );
}
