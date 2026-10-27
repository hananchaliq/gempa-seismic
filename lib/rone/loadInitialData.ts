import fs from "node:fs/promises";
import path from "node:path";
import type { InitialRonePayload } from "@/components/rone/GempaRoneApp";

async function readJsonFixture<T>(filename: string, fallback: T): Promise<T> {
  try {
    const filePath = path.join(process.cwd(), "public", "fixtures", "live-cache", filename);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadInitialRoneData(): Promise<InitialRonePayload> {
  const [latestWrap, realtimeWrap, feltWrap, sigWrap, tsunamiWrap, archive3mWrap] =
    await Promise.all([
      readJsonFixture<{ data: InitialRonePayload["latest"] }>("latest.json", { data: null }),
      readJsonFixture<{ data: InitialRonePayload["realtime"] }>("realtime.json", { data: [] }),
      readJsonFixture<{ data: InitialRonePayload["felt"] }>("felt.json", { data: [] }),
      readJsonFixture<{ data: InitialRonePayload["significant"] }>("significant.json", {
        data: [],
      }),
      readJsonFixture<{ data: InitialRonePayload["tsunami"] }>("tsunami.json", { data: [] }),
      readJsonFixture<{ data: InitialRonePayload["archive3m"] }>("archive-3m.json", {
        data: [],
      }),
    ]);

  return {
    latest: latestWrap.data || null,
    realtime: realtimeWrap.data || [],
    felt: feltWrap.data || [],
    significant: sigWrap.data || [],
    tsunami: tsunamiWrap.data || [],
    archive3m: archive3mWrap.data || [],
    referenceNowMs: Date.now(),
  };
}
