import { GempaRoneApp } from "@/components/rone/GempaRoneApp";
import { loadInitialRoneData } from "@/lib/rone/loadInitialData";
import { buildSeismicJsonLd, createPageMetadata } from "@/lib/rone/seo";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "API Gempa Bumi Indonesia JSON — Endpoint Telemetri Real-Time",
  description:
    "Dokumentasi REST API JSON terbuka untuk data gempa bumi terbaru, gempa barusan real-time, gempa dirasakan, katalog M5+, dan peringatan tsunami BMKG.",
  path: "/docs",
});

export default async function DocsPage() {
  const initialData = await loadInitialRoneData();
  const jsonLd = buildSeismicJsonLd(initialData);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GempaRoneApp initialTab="docs" initialData={initialData} />
    </>
  );
}
