import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/rone/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "", changeFrequency: "always", priority: 1.0 },
    { path: "/realtime", changeFrequency: "always", priority: 0.95 },
    { path: "/felt", changeFrequency: "always", priority: 0.92 },
    { path: "/m5", changeFrequency: "hourly", priority: 0.9 },
    { path: "/tsunami", changeFrequency: "always", priority: 0.92 },
    { path: "/map", changeFrequency: "always", priority: 0.88 },
    { path: "/damage", changeFrequency: "daily", priority: 0.82 },
    { path: "/about", changeFrequency: "weekly", priority: 0.75 },
    { path: "/docs", changeFrequency: "weekly", priority: 0.7 },
  ];

  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
