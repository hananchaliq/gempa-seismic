import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gempa Seismic — Info Gempa Hari Ini & Gempa Barusan BMKG",
    short_name: "Gempa Seismic",
    description:
      "Pantau gempa hari ini, gempa barusan, gempa 2 detik lalu, gempa 1 menit lalu, dan peringatan dini tsunami BMKG secara real-time.",
    start_url: "/",
    display: "standalone",
    background_color: "#E4E4DF",
    theme_color: "#0F0F11",
    lang: "id-ID",
  };
}
