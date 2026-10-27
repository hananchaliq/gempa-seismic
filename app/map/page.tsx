import { GempaRoneApp } from "@/components/rone/GempaRoneApp";
import { loadInitialRoneData } from "@/lib/rone/loadInitialData";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const initialData = await loadInitialRoneData();
  return <GempaRoneApp initialTab="map" initialData={initialData} />;
}
