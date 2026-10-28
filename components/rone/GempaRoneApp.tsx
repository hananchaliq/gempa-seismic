"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { fmtClockWib, fmtCoords, fmtDateTime, fmtDecimal, fmtDepth, fmtLong, fmtMag, fmtNumber, fmtRelative, fmtTime, fmtUtcDate, distanceKm, magBucket, magScaleRange, magTierInfo, parseFelt, RoneDamagingEvent, RoneEarthquake, RoneRealtimeEvent, RoneStation, RoneTsunamiBulletin, RoneTsunamiEvent, RoneTsunamiZone, weeklyBuckets } from "@/lib/rone/format";
import { FactsList, ICON_PATHS, MagBadge, MagDial, MagLegend, RoneIcon } from "./RoneIcons";
import { MapQuakePoint, RoneLeafletMap } from "./RoneLeafletMap";
import { DetailTarget, MediaItem, MediaViewerSection, RoneDetailSheet, RoneLightbox } from "./RoneDetailSheet";
import { depthCategoryLabel, EpicenterDistanceBar, estimateFeelAtDistance, HypocenterDepthCrossSection, INDONESIA_REFERENCE_CITIES, InspectableQuake, playSeismicAlertChime, SeismicCapsuleTimeline, SeismicMagnitudeSplineCard, StackedQuickQuakesDeck, UserReferencePoint } from "./SeismicIntelligenceWidgets";

export type RoneTabKey = "home" | "realtime" | "felt" | "significant" | "tsunami" | "damaging" | "map" | "about" | "docs";

interface NavItem {
   key: RoneTabKey;
   path: string;
   label: string;
   shortLabel: string;
   icon: keyof typeof ICON_PATHS;
}

const NAV_ITEMS: NavItem[] = [
   { key: "home", path: "/", label: "Terkini", shortLabel: "Terkini", icon: "home" },
   { key: "realtime", path: "/realtime", label: "Realtime", shortLabel: "Realtime", icon: "pulse" },
   { key: "felt", path: "/felt", label: "Dirasakan", shortLabel: "Dirasakan", icon: "table" },
   { key: "significant", path: "/m5", label: "M5+", shortLabel: "M5+", icon: "layers" },
   { key: "tsunami", path: "/tsunami", label: "Tsunami", shortLabel: "Tsunami", icon: "wave" },
   { key: "damaging", path: "/damage", label: "Merusak", shortLabel: "Merusak", icon: "shield" },
   { key: "map", path: "/map", label: "Peta", shortLabel: "Peta", icon: "compass" },
   { key: "about", path: "/about", label: "Tentang", shortLabel: "Tentang", icon: "info" },
];

const TAB_TITLES: Record<RoneTabKey, [string, string]> = {
   home: ["Gempa", "Seismic"],
   realtime: ["Deteksi", "Realtime"],
   felt: ["Gempa", "Dirasakan"],
   significant: ["Signifikan", "M 5,0+"],
   tsunami: ["Peringatan", "Tsunami"],
   damaging: ["Katalog", "Merusak"],
   map: ["Peta", "Seismisitas"],
   about: ["Data &", "Parameter"],
   docs: ["Dokumentasi", "OpenAPI"],
};

const DAY_MS = 86_400_000;
const AUTO_POLL_SECONDS = 30;

export interface InitialRonePayload {
   latest: RoneEarthquake | null;
   realtime: RoneRealtimeEvent[];
   felt: RoneEarthquake[];
   significant: RoneEarthquake[];
   tsunami: RoneTsunamiEvent[];
   archive3m: RoneRealtimeEvent[];
   referenceNowMs: number;
}

function bulletinLabel(code: string): string {
   const c = code.toUpperCase();
   if (c.startsWith("PD-1")) return "Peringatan dini awal";
   if (c.startsWith("PD-2")) return "Pemutakhiran parameter";
   if (c.startsWith("PD-3")) return "Pengamatan muka laut";
   if (c.startsWith("PD-4")) return "Peringatan berakhir";
   return "";
}

const shortDateFormatter = new Intl.DateTimeFormat("id-ID", {
   timeZone: "Asia/Jakarta",
   day: "numeric",
   month: "long",
   year: "numeric",
});

export function GempaRoneApp({ initialTab = "home", initialData }: { initialTab?: RoneTabKey; initialData: InitialRonePayload }) {
   const [activeTab, setActiveTab] = useState<RoneTabKey>(initialTab);
   // Default to Light Mode (Monochrome Alabaster & Obsidian) matching the reference image
   const [isDark, setIsDark] = useState(false);
   const [nowMs, setNowMs] = useState<number>(initialData.referenceNowMs);
   const [liveTimeLabel, setLiveTimeLabel] = useState<string>(() => `Diperbarui ${fmtClockWib(new Date(initialData.referenceNowMs))}`);
   const [liveOk, setLiveOk] = useState(true);
   const [isSyncing, setIsSyncing] = useState(false);
   const [pollCountdown, setPollCountdown] = useState<number>(AUTO_POLL_SECONDS);
   const [refreshCycle, setRefreshCycle] = useState<number>(0);
   const [quickSearch, setQuickSearch] = useState<string>("");

   // Core datasets
   const [latest, setLatest] = useState<RoneEarthquake | null>(initialData.latest);
   const [realtime, setRealtime] = useState<RoneRealtimeEvent[]>(initialData.realtime);
   const [feltList, setFeltList] = useState<RoneEarthquake[]>(initialData.felt);
   const [significantList, setSignificantList] = useState<RoneEarthquake[]>(initialData.significant);
   const [tsunamiList, setTsunamiList] = useState<RoneTsunamiEvent[]>(initialData.tsunami);
   const [archive3m] = useState<RoneRealtimeEvent[]>(initialData.archive3m);
   const [damagingList, setDamagingList] = useState<RoneDamagingEvent[]>([]);
   const [damagingLoaded, setDamagingLoaded] = useState(false);

   // Hero mode: "realtime" shows the newest automatic sensor detection,
   // "felt" shows the latest felt earthquake with BMKG ShakeMap.
   const [heroMode, setHeroMode] = useState<"realtime" | "felt">("realtime");
   const [focusedRealtime, setFocusedRealtime] = useState<RoneRealtimeEvent | null>(null);

   // User reference location for distance & wave arrival calculator
   const [userPoint, setUserPoint] = useState<UserReferencePoint>(INDONESIA_REFERENCE_CITIES[0]);
   const [gpsLoading, setGpsLoading] = useState(false);

   // Optional audio & visual alert for new earthquake arrivals
   const [soundEnabled, setSoundEnabled] = useState(false);
   const seenTopEventIdRef = useRef<string | null>(initialData.realtime[0]?.event_id || null);

   // Map page (/map/) reference layers
   const [mapLayersOn, setMapLayersOn] = useState<Record<string, boolean>>({
      realtime: true,
      archive3m: false,
      archive5y: false,
      faultsIndonesia: true,
      faultsGlobal: false,
      stationsIndonesia: false,
      stationsGlobal: false,
   });
   const [archive5y, setArchive5y] = useState<RoneRealtimeEvent[]>([]);
   const [faultsIndonesia, setFaultsIndonesia] = useState<GeoJSON.FeatureCollection | null>(null);
   const [faultsGlobal, setFaultsGlobal] = useState<GeoJSON.FeatureCollection | null>(null);
   const [stationsIndonesia, setStationsIndonesia] = useState<RoneStation[]>([]);
   const [stationsGlobal, setStationsGlobal] = useState<RoneStation[]>([]);
   const [layerLoadingStatus, setLayerLoadingStatus] = useState("");

   // Interactive selections & filters
   const [homeSelected, setHomeSelected] = useState<MapQuakePoint | null>(null);
   const [rtMinMag, setRtMinMag] = useState<number>(0);
   const [rtQuery, setRtQuery] = useState("");
   const [rtSort, setRtSort] = useState<{
      key: "magnitude" | "origin_time" | "region" | "depth_km";
      dir: "asc" | "desc";
   }>({ key: "origin_time", dir: "desc" });
   const [rtSelected, setRtSelected] = useState<RoneRealtimeEvent | null>(null);

   const [alertsQuery, setAlertsQuery] = useState("");
   const [alertsMinMag, setAlertsMinMag] = useState<number>(0);
   const [alertsSort, setAlertsSort] = useState<{
      key: "magnitude" | "origin_time" | "region" | "depth_km";
      dir: "asc" | "desc";
   }>({ key: "origin_time", dir: "desc" });
   const [alertsSelected, setAlertsSelected] = useState<RoneEarthquake | null>(null);

   const [dmgQuery, setDmgQuery] = useState("");
   const [dmgPeriod, setDmgPeriod] = useState("");
   const [dmgOnlyTsunami, setDmgOnlyTsunami] = useState(false);
   const [dmgPage, setDmgPage] = useState(0);
   const [dmgSort, setDmgSort] = useState<{
      key: "magnitude" | "origin_time" | "province" | "depth_km";
      dir: "asc" | "desc";
   }>({ key: "origin_time", dir: "desc" });
   const [dmgSelected, setDmgSelected] = useState<RoneDamagingEvent | null>(null);

   // Detail modal & lightbox & toast
   const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
   const [lightboxState, setLightboxState] = useState<{
      items: MediaItem[];
      index: number;
   } | null>(null);
   const [toastMsg, setToastMsg] = useState<string | null>(null);

   // API Playground state for /docs
   const [apiPlayPath, setApiPlayPath] = useState("/api/v1/earthquakes/latest");
   const [apiPlayResponse, setApiPlayResponse] = useState<string>("");
   const [apiPlayLoading, setApiPlayLoading] = useState(false);

   // Responsive Mobile/Tablet UX states
   const [mobileAnalyticsOpen, setMobileAnalyticsOpen] = useState(false);
   const [tableDisplayMode, setTableDisplayMode] = useState<"auto" | "cards" | "table">("auto");

   const showToast = useCallback((msg: string) => {
      setToastMsg(msg);
      setTimeout(() => setToastMsg(null), 3200);
   }, []);

   // Theme & saved preferences initialization (Defaults to Light Monochrome Alabaster & Obsidian)
   useEffect(() => {
      const saved = window.localStorage.getItem("theme_monochrome");
      const dark = saved === "dark";
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      setIsDark(dark);

      const savedCityId = window.localStorage.getItem("seismic_city");
      if (savedCityId) {
         const found = INDONESIA_REFERENCE_CITIES.find(c => c.id === savedCityId);
         if (found) setUserPoint(found);
      }
      const savedSound = window.localStorage.getItem("seismic_sound");
      if (savedSound === "true") {
         setSoundEnabled(true);
      }
   }, []);

   const toggleTheme = () => {
      const next = !isDark;
      setIsDark(next);
      document.documentElement.dataset.theme = next ? "dark" : "light";
      try {
         window.localStorage.setItem("theme_monochrome", next ? "dark" : "light");
      } catch {}
   };

   const toggleSoundAlert = () => {
      const next = !soundEnabled;
      setSoundEnabled(next);
      try {
         window.localStorage.setItem("seismic_sound", String(next));
      } catch {}
      if (next) {
         playSeismicAlertChime();
         showToast("Notifikasi suara gempa baru diaktifkan");
      } else {
         showToast("Notifikasi suara dinonaktifkan");
      }
   };

   const handleSelectCity = useCallback(
      (city: UserReferencePoint) => {
         setUserPoint(city);
         try {
            window.localStorage.setItem("seismic_city", city.id);
         } catch {}
         showToast(`Titik referensi jarak: ${city.label}`);
      },
      [showToast]
   );

   const handleRequestGps = useCallback(() => {
      if (!navigator.geolocation) {
         showToast("Geolokasi tidak didukung oleh browser ini");
         return;
      }
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
         pos => {
            setGpsLoading(false);
            const lat = Number(pos.coords.latitude.toFixed(3));
            const lon = Number(pos.coords.longitude.toFixed(3));
            setUserPoint({
               id: "gps",
               label: `${Math.abs(lat)}°${lat < 0 ? "LS" : "LU"}, ${lon}°BT`,
               lat,
               lon,
               isGps: true,
            });
            showToast("Lokasi GPS berhasil dikalibrasi");
         },
         () => {
            setGpsLoading(false);
            showToast("Izin lokasi ditolak — memakai kota pilihan");
         },
         { enableHighAccuracy: false, timeout: 6000 }
      );
   }, [showToast]);

   // Switch navigation tab and update browser URL cleanly
   const navigateTab = useCallback((tab: RoneTabKey) => {
      setActiveTab(tab);
      setAlertsQuery("");
      setAlertsMinMag(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
      const navItem = NAV_ITEMS.find(n => n.key === tab);
      const targetPath = tab === "docs" ? "/docs" : navItem?.path || "/";
      try {
         window.history.pushState({}, "", targetPath);
      } catch {}
   }, []);

   // Real-time refresh of live endpoints (runs immediately on mount, every 30s, or on manual click)
   const refreshLiveFeeds = useCallback(
      async (manual = false) => {
         setIsSyncing(true);
         try {
            const qs = "?fresh=1";
            const [latestRes, rtRes, feltRes, sigRes, tsRes] = await Promise.all([fetch(`/api/v1/earthquakes/latest${qs}`, { cache: "no-store" }), fetch(`/api/v1/earthquakes/realtime?limit=300&fresh=1`, { cache: "no-store" }), fetch(`/api/v1/earthquakes/felt${qs}`, { cache: "no-store" }), fetch(`/api/v1/earthquakes/significant${qs}`, { cache: "no-store" }), fetch(`/api/v1/tsunami${qs}`, { cache: "no-store" })]);
            if (latestRes.ok) {
               const j = await latestRes.json();
               if (j?.data) setLatest(j.data);
            }
            if (rtRes.ok) {
               const j = await rtRes.json();
               if (Array.isArray(j?.data) && j.data.length > 0) {
                  const newest: RoneRealtimeEvent = j.data[0];
                  if (seenTopEventIdRef.current && seenTopEventIdRef.current !== newest.event_id) {
                     showToast(`Gempa baru terdeteksi: M ${fmtMag(newest.magnitude)} · ${newest.region}`);
                     if (soundEnabled) {
                        playSeismicAlertChime();
                     }
                  }
                  seenTopEventIdRef.current = newest.event_id;
                  setRealtime(j.data);
               }
            }
            if (feltRes.ok) {
               const j = await feltRes.json();
               if (Array.isArray(j?.data)) setFeltList(j.data);
            }
            if (sigRes.ok) {
               const j = await sigRes.json();
               if (Array.isArray(j?.data)) setSignificantList(j.data);
            }
            if (tsRes.ok) {
               const j = await tsRes.json();
               if (Array.isArray(j?.data)) setTsunamiList(j.data);
            }
            const now = Date.now();
            setNowMs(now);
            setLiveTimeLabel(`Diperbarui ${fmtClockWib(new Date(now))}`);
            setLiveOk(true);
            setPollCountdown(AUTO_POLL_SECONDS);
            setRefreshCycle(c => c + 1);
            if (manual) {
               showToast("Data real-time BMKG berhasil disinkronkan");
            }
         } catch {
            setLiveOk(false);
            if (manual) {
               showToast("Gagal menghubungi server — menampilkan data terakhir");
            }
         } finally {
            setIsSyncing(false);
         }
      },
      [showToast, soundEnabled]
   );

   // Run immediate live sync on mount, plus 1-second ticker for relative time & 30s auto-poll
   useEffect(() => {
      refreshLiveFeeds(false);
   }, [refreshLiveFeeds]);

   useEffect(() => {
      const ticker = setInterval(() => {
         setNowMs(Date.now());
         setPollCountdown(prev => {
            if (prev <= 1) {
               refreshLiveFeeds(false);
               return AUTO_POLL_SECONDS;
            }
            return prev - 1;
         });
      }, 1000);
      return () => clearInterval(ticker);
   }, [refreshLiveFeeds]);

   // Lazy load damaging earthquakes when Merusak tab is opened
   useEffect(() => {
      if (activeTab === "damaging" && !damagingLoaded) {
         fetch("/api/v1/earthquakes/damaging")
            .then(r => (r.ok ? r.json() : null))
            .then(j => {
               if (Array.isArray(j?.data)) {
                  setDamagingList(j.data);
                  setDamagingLoaded(true);
               }
            })
            .catch(() => {});
      }
   }, [activeTab, damagingLoaded]);

   // Lazy load map layers when Peta (/map/) is opened or layers toggled
   useEffect(() => {
      if (activeTab !== "map") return;

      async function ensureLayers() {
         if (mapLayersOn.faultsIndonesia && !faultsIndonesia) {
            setLayerLoadingStatus("Memuat lapisan…");
            try {
               const r = await fetch("/api/v1/faults/indonesia");
               if (r.ok) setFaultsIndonesia(await r.json());
            } finally {
               setLayerLoadingStatus("");
            }
         }
         if (mapLayersOn.faultsGlobal && !faultsGlobal) {
            setLayerLoadingStatus("Memuat lapisan…");
            try {
               const r = await fetch("/api/v1/faults/global");
               if (r.ok) setFaultsGlobal(await r.json());
            } finally {
               setLayerLoadingStatus("");
            }
         }
         if (mapLayersOn.stationsIndonesia && !stationsIndonesia.length) {
            setLayerLoadingStatus("Memuat lapisan…");
            try {
               const r = await fetch("/api/v1/stations/indonesia");
               if (r.ok) {
                  const j = await r.json();
                  if (Array.isArray(j?.data)) setStationsIndonesia(j.data);
               }
            } finally {
               setLayerLoadingStatus("");
            }
         }
         if (mapLayersOn.stationsGlobal && !stationsGlobal.length) {
            setLayerLoadingStatus("Memuat lapisan…");
            try {
               const r = await fetch("/api/v1/stations/global");
               if (r.ok) {
                  const j = await r.json();
                  if (Array.isArray(j?.data)) setStationsGlobal(j.data);
               }
            } finally {
               setLayerLoadingStatus("");
            }
         }
         if (mapLayersOn.archive5y && !archive5y.length) {
            setLayerLoadingStatus("Memuat lapisan…");
            try {
               const r = await fetch("/api/v1/earthquakes/archive/5y");
               if (r.ok) {
                  const j = await r.json();
                  if (Array.isArray(j?.data)) setArchive5y(j.data);
               }
            } finally {
               setLayerLoadingStatus("");
            }
         }
      }
      ensureLayers();
   }, [activeTab, mapLayersOn, faultsIndonesia, faultsGlobal, stationsIndonesia.length, stationsGlobal.length, archive5y.length]);

   // Load API preview when /docs is opened
   useEffect(() => {
      if (activeTab !== "docs") return;
      setApiPlayLoading(true);
      fetch(apiPlayPath)
         .then(r => r.json())
         .then(j => setApiPlayResponse(JSON.stringify(j, null, 2).slice(0, 4000)))
         .catch(e => setApiPlayResponse(String(e)))
         .finally(() => setApiPlayLoading(false));
   }, [activeTab, apiPlayPath]);

   // Derived Home (Terkini) calculations
   const realtime48h = useMemo(() => realtime.filter(e => nowMs - new Date(e.origin_time).getTime() < 2 * DAY_MS), [realtime, nowMs]);

   // Active Hero event: either the newest/selected realtime sensor event OR the latest felt ShakeMap event
   const activeHeroQuake: InspectableQuake | null = useMemo(() => {
      if (heroMode === "felt" && latest) {
         return latest;
      }
      return focusedRealtime || realtime[0] || latest || null;
   }, [heroMode, focusedRealtime, realtime, latest]);

   const summaryStats = useMemo(() => {
      const day = realtime.filter(e => nowMs - new Date(e.origin_time).getTime() < DAY_MS);
      const strongest = day.reduce<RoneRealtimeEvent | null>((a, b) => (!a || b.magnitude > a.magnitude ? b : a), null);
      const m5week = significantList.filter(e => nowMs - new Date(e.origin_time).getTime() < 7 * DAY_MS);
      const activeTsunami = tsunamiList.find(e => !e.ended && nowMs - new Date(e.origin_time).getTime() < DAY_MS);
      const lastTsunami = tsunamiList[0] || null;

      const shallowCount = realtime.filter(e => e.depth_km < 60).length;
      const subductionCount = realtime.filter(e => e.depth_km >= 60 && e.depth_km <= 300).length;
      const confirmedCount = realtime.filter(e => e.status === "confirmed").length;

      return {
         day,
         strongest,
         m5week,
         activeTsunami,
         lastTsunami,
         shallowCount,
         subductionCount,
         confirmedCount,
      };
   }, [realtime, significantList, tsunamiList, nowMs]);

   const heroLaymanSummary = useMemo(() => {
      if (!activeHeroQuake) return null;
      const surfaceDist = Math.round(distanceKm({ latitude: userPoint.lat, longitude: userPoint.lon }, activeHeroQuake));
      const hypoDist = Math.round(Math.sqrt(surfaceDist * surfaceDist + activeHeroQuake.depth_km ** 2));
      const feelText = surfaceDist > 550 ? "Jauh · Tidak terasa di lokasi Anda" : estimateFeelAtDistance(activeHeroQuake.magnitude, activeHeroQuake.depth_km, hypoDist);
      const hasTsunamiWarn = Boolean(summaryStats.activeTsunami) || Boolean(activeHeroQuake.tsunami_potential);
      const safetyLabel = hasTsunamiWarn ? "Waspada · Cek Buletin Tsunami BMKG" : "Aman · Tidak Berpotensi Tsunami";
      const depthInfo = depthCategoryLabel(activeHeroQuake.depth_km);

      return {
         surfaceDist,
         feelText,
         hasTsunamiWarn,
         safetyLabel,
         depthTier: depthInfo.tier,
      };
   }, [activeHeroQuake, userPoint, summaryStats.activeTsunami]);

   const weeklyChartData = useMemo(() => {
      const weeks = weeklyBuckets(archive3m);
      if (!weeks.length) return null;
      const peak = weeks.reduce((a, b) => (b.count > a.count ? b : a), weeks[0]);
      const step = peak.count > 50 ? 20 : 10;
      const top = Math.max(step, Math.ceil(peak.count / step) * step);
      const total = weeks.reduce((n, w) => n + w.count, 0);
      const average = Math.round(total / weeks.length);
      return { weeks, peak, top, total, average };
   }, [archive3m]);

   // Realtime page filtered + sorted rows
   const filteredRealtime = useMemo(() => {
      const q = rtQuery.trim().toLowerCase();
      const list = realtime.filter(e => e.magnitude >= rtMinMag && (!q || e.region.toLowerCase().includes(q)));
      const dir = rtSort.dir === "asc" ? 1 : -1;
      return [...list].sort((a, b) => {
         if (rtSort.key === "magnitude") return (a.magnitude - b.magnitude) * dir;
         if (rtSort.key === "depth_km") return (a.depth_km - b.depth_km) * dir;
         if (rtSort.key === "region") return a.region.localeCompare(b.region) * dir;
         return (new Date(a.origin_time).getTime() - new Date(b.origin_time).getTime()) * dir;
      });
   }, [realtime, rtMinMag, rtQuery, rtSort]);

   // Felt / M5+ filtered + sorted rows
   const currentAlertsSource = activeTab === "significant" ? significantList : feltList;
   const filteredAlerts = useMemo(() => {
      const q = alertsQuery.trim().toLowerCase();
      const list = currentAlertsSource.filter(e => e.magnitude >= alertsMinMag && (!q || `${e.region} ${e.felt ?? ""} ${e.potential ?? ""}`.toLowerCase().includes(q)));
      const dir = alertsSort.dir === "asc" ? 1 : -1;
      return [...list].sort((a, b) => {
         if (alertsSort.key === "magnitude") return (a.magnitude - b.magnitude) * dir;
         if (alertsSort.key === "depth_km") return (a.depth_km - b.depth_km) * dir;
         if (alertsSort.key === "region") return a.region.localeCompare(b.region) * dir;
         return (new Date(a.origin_time).getTime() - new Date(b.origin_time).getTime()) * dir;
      });
   }, [currentAlertsSource, alertsQuery, alertsMinMag, alertsSort]);

   // Damaging catalogue filtered + sorted rows
   const damagingDecades = useMemo(() => {
      const years = damagingList.map(e => new Date(e.origin_time).getUTCFullYear());
      return [...new Set(years.map(y => Math.floor(y / 10) * 10))].sort((a, b) => b - a);
   }, [damagingList]);

   const filteredDamaging = useMemo(() => {
      const q = dmgQuery.trim().toLowerCase();
      const list = damagingList.filter(ev => {
         if (dmgOnlyTsunami && !ev.tsunami) return false;
         if (dmgPeriod) {
            const y = new Date(ev.origin_time).getUTCFullYear();
            const dec = Number(dmgPeriod);
            if (y < dec || y >= dec + 10) return false;
         }
         if (!q) return true;
         return `${ev.province} ${ev.epicenter} ${ev.impact ?? ""}`.toLowerCase().includes(q);
      });
      const dir = dmgSort.dir === "asc" ? 1 : -1;
      return [...list].sort((a, b) => {
         if (dmgSort.key === "magnitude") return (a.magnitude - b.magnitude) * dir;
         if (dmgSort.key === "depth_km") return (a.depth_km - b.depth_km) * dir;
         if (dmgSort.key === "province") return a.province.localeCompare(b.province) * dir;
         return (new Date(a.origin_time).getTime() - new Date(b.origin_time).getTime()) * dir;
      });
   }, [damagingList, dmgOnlyTsunami, dmgPeriod, dmgQuery, dmgSort]);

   const handleShareEvent = useCallback(
      (eventId: string) => {
         const url = `${window.location.origin}${window.location.pathname}#e=${encodeURIComponent(eventId)}`;
         if (navigator.clipboard?.writeText) {
            navigator.clipboard
               .writeText(url)
               .then(() => showToast("Tautan disalin"))
               .catch(() => showToast(url));
         } else {
            showToast("Tautan siap dibagikan");
         }
      },
      [showToast]
   );

   const activeMapLayerCount = Object.values(mapLayersOn).filter(Boolean).length;
   const [titleLine1, titleLine2] = TAB_TITLES[activeTab] || ["Gempa", "Seismic"];
   const formattedToday = shortDateFormatter.format(new Date(nowMs)).toUpperCase();

   return (
      <div className="monochrome-viewport" data-refresh-cycle={refreshCycle}>
         <a className="skip-link" href="#main">
            Lewati ke konten
         </a>

         {summaryStats.activeTsunami ? (
            <div className="alert-banner" role="alert">
               <div className="alert-banner__inner">
                  <strong>Peringatan dini tsunami aktif</strong>
                  <span>
                     M {fmtMag(summaryStats.activeTsunami.magnitude)} · {summaryStats.activeTsunami.region}
                  </span>
                  <button type="button" onClick={() => navigateTab("tsunami")}>
                     Lihat buletin →
                  </button>
               </div>
            </div>
         ) : null}

         <div className="monochrome-shell">
            {/* ==================== SINGLE LEFT SIDEBAR NAVIGATION ==================== */}
            <aside className="app-sidebar" aria-label="Bilah sisi aplikasi">
               <button type="button" className="sidebar-brand" aria-label="Gempa Seismic — beranda" onClick={() => navigateTab("home")}>
                  <span className="sidebar-brand__mark">
                     <RoneIcon name="pulse" />
                  </span>
                  <span className="sidebar-brand__copy">
                     <strong>Gempa Seismic</strong>
                     <span>BMKG InaTEWS Live</span>
                  </span>
               </button>

               <nav className="sidebar-nav" aria-label="Navigasi utama">
                  {NAV_ITEMS.map(item => {
                     const isActive = activeTab === item.key;
                     return (
                        <button key={item.key} type="button" className="sidebar-nav__item" aria-current={isActive ? "page" : undefined} onClick={() => navigateTab(item.key)}>
                           <span className="sidebar-nav__icon">
                              <RoneIcon name={item.icon} />
                           </span>
                           <span className="sidebar-nav__label">{item.label}</span>
                        </button>
                     );
                  })}
                  <button type="button" className="sidebar-nav__item" aria-current={activeTab === "docs" ? "page" : undefined} onClick={() => navigateTab("docs")}>
                     <span className="sidebar-nav__icon">
                        <RoneIcon name="code" />
                     </span>
                     <span className="sidebar-nav__label">API JSON</span>
                  </button>
               </nav>

               {/* Reference Image Bottom-Left Profile/Location Pod ("Lucas Morel" motif) */}
               <div className="sidebar-pod" aria-label="Lokasi referensi kalkulasi jarak">
                  <div className="sidebar-pod__avatar" aria-hidden="true">
                     <RoneIcon name="pin" />
                  </div>
                  <strong className="sidebar-pod__name">{userPoint.label}</strong>
                  <span className="sidebar-pod__role">Stasiun Referensi Jarak</span>
                  <div className="sidebar-pod__controls">
                     <label className="sidebar-pod__select-wrap">
                        <span className="visually-hidden">Pilih kota referensi</span>
                        <select
                           aria-label="Pilih kota referensi sidebar"
                           value={userPoint.isGps ? "gps" : userPoint.id}
                           onChange={e => {
                              const found = INDONESIA_REFERENCE_CITIES.find(c => c.id === e.target.value);
                              if (found) handleSelectCity(found);
                           }}>
                           {userPoint.isGps ? <option value="gps">GPS ({userPoint.label})</option> : null}
                           {INDONESIA_REFERENCE_CITIES.map(city => (
                              <option key={city.id} value={city.id}>
                                 {city.label}
                              </option>
                           ))}
                        </select>
                     </label>
                     <button type="button" className="sidebar-pod__gps" onClick={handleRequestGps} disabled={gpsLoading} title="Kalibrasi lokasi GPS perangkat">
                        {gpsLoading ? "…" : "GPS"}
                     </button>
                  </div>
               </div>
            </aside>

            {/* ==================== MAIN WORKSPACE ==================== */}
            <div className="workspace-main">
               {/* Top Contextual Workspace Bar (Matches "Web Design" + Utility Capsule Bar on Row 1, Date/Mode Subbar on Row 2) */}
               <header className="workspace-topbar">
                  <div className="workspace-topbar__row1">
                     <h1 className="workspace-display-title">
                        <span>{titleLine1}</span>
                        <span>{titleLine2}</span>
                     </h1>

                     {/* Right Utility Capsule Bar ("Vue jour | 22° | Rechercher... | Bell | Dots") */}
                     <div className="topbar-capsule">
                        <div className="topbar-widget" id="live-status" data-state={liveOk ? "ok" : "error"} aria-live="polite" title="Pembaruan otomatis setiap 30 detik dari jaringan sensor BMKG">
                           <span className="circle-icon circle-icon--obsidian" aria-hidden="true">
                              <RoneIcon name="calendar" />
                           </span>
                           <div className="topbar-widget__copy">
                              <strong id="live-label" className="live-label-row">
                                 <span className="live-pulse-dot" aria-hidden="true" />
                                 {liveOk ? `Live · ${pollCountdown}d` : "Gangguan"}
                              </strong>
                              <span className="mono">{liveTimeLabel.replace("Diperbarui ", "")} WIB</span>
                           </div>
                        </div>

                        <div className="topbar-widget topbar-widget--peak" title="Magnitudo terbesar dalam 24 jam terakhir">
                           {summaryStats.strongest ? (
                              <MagBadge magnitude={summaryStats.strongest.magnitude} size="sm" />
                           ) : (
                              <span className="topbar-widget__sun" aria-hidden="true">
                                 <RoneIcon name="pulse" />
                              </span>
                           )}
                           <div className="topbar-widget__copy">
                              <strong>Terkuat 24j</strong>
                              <span>{summaryStats.strongest ? magTierInfo(summaryStats.strongest.magnitude).levelLabel : "Magnitudo"}</span>
                           </div>
                        </div>

                        <form
                           className="topbar-search"
                           onSubmit={e => {
                              e.preventDefault();
                              const q = quickSearch.trim();
                              if (activeTab === "felt" || activeTab === "significant") {
                                 setAlertsQuery(q);
                              } else if (activeTab === "damaging") {
                                 setDmgQuery(q);
                              } else {
                                 setRtQuery(q);
                                 if (activeTab !== "realtime" && q) {
                                    navigateTab("realtime");
                                 }
                              }
                           }}>
                           <button type="submit" className="circle-icon circle-icon--obsidian" aria-label="Jalankan pencarian wilayah">
                              <RoneIcon name="search" />
                           </button>
                           <input
                              type="search"
                              placeholder="Cari wilayah gempa…"
                              aria-label="Cari wilayah gempa"
                              value={quickSearch}
                              onChange={e => {
                                 const val = e.target.value;
                                 setQuickSearch(val);
                                 if (activeTab === "realtime") setRtQuery(val);
                                 if (activeTab === "felt" || activeTab === "significant") {
                                    setAlertsQuery(val);
                                 }
                                 if (activeTab === "damaging") setDmgQuery(val);
                              }}
                           />
                           <span className="topbar-search__kbd" aria-hidden="true">
                              ↵
                           </span>
                        </form>

                        <button type="button" className={`circle-btn circle-btn--obsidian${soundEnabled ? " is-active" : ""}`} aria-pressed={soundEnabled ? "true" : "false"} onClick={toggleSoundAlert} aria-label="Notifikasi suara gempa baru" title={soundEnabled ? "Notifikasi suara aktif (klik untuk matikan)" : "Aktifkan bunyi peringatan saat gempa baru terdeteksi"}>
                           <RoneIcon name="bell" />
                        </button>

                        <button type="button" className="circle-btn circle-btn--ivory" data-syncing={isSyncing ? "true" : "false"} onClick={() => refreshLiveFeeds(true)} aria-label="Sinkronisasi data gempa sekarang" title="Sinkronisasi data real-time sekarang">
                           <RoneIcon name="refresh" />
                        </button>

                        <button type="button" className="circle-btn circle-btn--ivory" id="theme-toggle" aria-label="Ganti tema terang/gelap" onClick={toggleTheme} title="Ganti tema Alabaster Terang / Obsidian Gelap">
                           <RoneIcon name="moon" className="icon theme-icon-light" />
                           <RoneIcon name="sun" className="icon theme-icon-dark" />
                        </button>
                     </div>
                  </div>

                  <div className="workspace-subbar">
                     <span className="workspace-date mono">
                        {formattedToday} <RoneIcon name="chevron-down" />
                     </span>
                     <div className="workspace-mode-pills" role="group" aria-label="Mode pantauan cepat">
                        <button
                           type="button"
                           className={`mode-pill${activeTab === "home" && heroMode === "realtime" ? " is-active" : ""}`}
                           onClick={() => {
                              setHeroMode("realtime");
                              setFocusedRealtime(null);
                              if (activeTab !== "home") navigateTab("home");
                           }}>
                           Realtime
                        </button>
                        <button
                           type="button"
                           className={`mode-pill${activeTab === "home" && heroMode === "felt" ? " is-active" : ""}`}
                           onClick={() => {
                              setHeroMode("felt");
                              if (activeTab !== "home") navigateTab("home");
                           }}>
                           ShakeMap
                        </button>
                        <button type="button" className={`mode-pill${activeTab === "realtime" ? " is-active" : ""}`} onClick={() => navigateTab("realtime")}>
                           Tabel ({realtime.length})
                        </button>
                        <button type="button" className={`mode-pill${activeTab === "significant" ? " is-active" : ""}`} onClick={() => navigateTab("significant")}>
                           M 5+
                        </button>
                     </div>
                  </div>
               </header>

               <main id="main" className="workspace-body">
                  {/* ==================== 1. TERKINI (HOME) — REFERENCE BENTO LAYOUT ==================== */}
                  {activeTab === "home" && (
                     <div className="bento-reference">
                        {/* TOP-LEFT CARD: MONITOR GEMPA + STAGGERED CAPSULE TIMELINE (Matches 09:00..18:00 capsule card) */}
                        <motion.article key={`hero-card-${refreshCycle}-${heroMode}-${activeHeroQuake?.event_id || "init"}`} className="card bento-ref__timeline" aria-labelledby="latest-title" initial={{ opacity: 0.85, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                           <div className="hero__top">
                              <motion.div id="latest-dial" key={`dial-${refreshCycle}-${activeHeroQuake?.event_id}`} initial={{ scale: 0.9, opacity: 0.75 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.38 }}>
                                 {activeHeroQuake ? (
                                    <MagDial magnitude={activeHeroQuake.magnitude} />
                                 ) : (
                                    <div className="dial">
                                       <span className="dial__value">
                                          <span className="dial__num">–</span>
                                          <span className="dial__label">Magnitudo</span>
                                       </span>
                                    </div>
                                 )}
                              </motion.div>

                              <div className="hero__intro">
                                 <div className="hero__kicker-row">
                                    <span className="hero__kicker">{heroMode === "realtime" ? (focusedRealtime ? "Fokus Sensor Terpilih" : "Deteksi Sensor Otomatis") : "Gempa Dirasakan (ShakeMap)"}</span>
                                    {activeHeroQuake ? <span className="pill">{fmtRelative(activeHeroQuake.origin_time, nowMs)}</span> : null}
                                 </div>
                                 <h2 className="hero__title" id="latest-title">
                                    {activeHeroQuake ? activeHeroQuake.region : "Memuat data BMKG…"}
                                 </h2>
                                 <p className="hero__time" id="latest-time">
                                    {activeHeroQuake ? (
                                       <>
                                          {fmtDateTime(activeHeroQuake.origin_time)} · <span>{fmtDepth(activeHeroQuake.depth_km)}</span>
                                       </>
                                    ) : null}
                                 </p>
                              </div>
                           </div>

                           {/* Clean, Breathable Layman Summary Strip */}
                           {heroLaymanSummary && activeHeroQuake ? (
                              <div className="layman-summary" aria-label="Ringkasan dampak gempa untuk masyarakat">
                                 <div className="layman-summary__top">
                                    <span className={`layman-status-badge${heroLaymanSummary.hasTsunamiWarn ? " is-warn" : " is-safe"}`}>
                                       {heroLaymanSummary.hasTsunamiWarn ? "⚠ " : "✓ "}
                                       {heroLaymanSummary.safetyLabel}
                                    </span>
                                    <div className="layman-summary__loc">
                                       <label className="layman-city-select">
                                          <span className="visually-hidden">Pilih lokasi Anda</span>
                                          <select
                                             aria-label="Pilih lokasi referensi Anda"
                                             value={userPoint.isGps ? "gps" : userPoint.id}
                                             onChange={e => {
                                                const found = INDONESIA_REFERENCE_CITIES.find(c => c.id === e.target.value);
                                                if (found) handleSelectCity(found);
                                             }}>
                                             {userPoint.isGps ? <option value="gps">Lokasi: GPS ({userPoint.label})</option> : null}
                                             {INDONESIA_REFERENCE_CITIES.map(city => (
                                                <option key={city.id} value={city.id}>
                                                   Lokasi: {city.label}
                                                </option>
                                             ))}
                                          </select>
                                       </label>
                                       <button type="button" className="layman-gps-btn" onClick={handleRequestGps} disabled={gpsLoading}>
                                          {gpsLoading ? "…" : "GPS"}
                                       </button>
                                    </div>
                                 </div>

                                 <div className="layman-summary__grid">
                                    <div className="layman-tile">
                                       <span className="layman-tile__label">Jarak ({userPoint.label})</span>
                                       <strong className="layman-tile__val mono">{fmtNumber(heroLaymanSummary.surfaceDist)} km</strong>
                                    </div>
                                    <div className="layman-tile">
                                       <span className="layman-tile__label">Kedalaman</span>
                                       <strong className="layman-tile__val mono">
                                          {fmtDepth(activeHeroQuake.depth_km)} · {heroLaymanSummary.depthTier}
                                       </strong>
                                    </div>
                                    <div className="layman-tile">
                                       <span className="layman-tile__label">Kategori M</span>
                                       <div className="layman-tile__badge-row">
                                          <MagBadge magnitude={activeHeroQuake.magnitude} size="sm" />
                                          <span className="layman-tile__tier">{magTierInfo(activeHeroQuake.magnitude).levelLabel}</span>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           ) : null}

                           {/* Staggered Monochrome Capsule Timeline from Reference Image */}
                           <SeismicCapsuleTimeline
                              events={realtime}
                              activeId={activeHeroQuake?.event_id}
                              onSelect={ev => {
                                 setFocusedRealtime(ev);
                                 setHomeSelected(ev);
                                 setHeroMode("realtime");
                                 showToast(`Fokus: M ${fmtMag(ev.magnitude)} · ${ev.region}`);
                              }}
                           />

                           <div className="hero__actions" id="latest-actions">
                              <button
                                 className="btn btn--obsidian"
                                 type="button"
                                 onClick={() => {
                                    if (!activeHeroQuake) return;
                                    if (heroMode === "felt" && latest) {
                                       setDetailTarget({ kind: "felt", data: latest });
                                    } else {
                                       const rt = focusedRealtime || realtime.find(r => r.event_id === activeHeroQuake.event_id) || realtime[0];
                                       if (rt) {
                                          setDetailTarget({ kind: "realtime", data: rt });
                                       } else if (latest) {
                                          setDetailTarget({ kind: "felt", data: latest });
                                       }
                                    }
                                 }}>
                                 Inspeksi Detail &amp; Peta
                              </button>
                              <button className="btn" type="button" onClick={() => navigateTab(heroMode === "felt" ? "felt" : "realtime")}>
                                 Tabel {fmtNumber(realtime.length)} Deteksi →
                              </button>
                           </div>
                        </motion.article>

                        {/* TOP-CENTER CARD: KURVA MAGNITUDO (Matches "Projets en cours / 74,3%" card) */}
                        <motion.section key={`spline-panel-${refreshCycle}`} className={`card bento-ref__curve mobile-collapsible-panel${mobileAnalyticsOpen ? " is-open-mobile" : ""}`} aria-label="Kurva magnitudo dan distribusi kedalaman" initial={{ opacity: 0.85, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.34, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}>
                           <SeismicMagnitudeSplineCard
                              events={realtime}
                              activeQuake={activeHeroQuake}
                              refreshCycle={refreshCycle}
                              onSelectQuake={ev => {
                                 setFocusedRealtime(ev);
                                 setHomeSelected(ev);
                                 setHeroMode("realtime");
                                 showToast(`Fokus kurva: M ${fmtMag(ev.magnitude)} · ${ev.region}`);
                              }}
                           />
                        </motion.section>

                        {/* TOP-RIGHT CARD: OBSIDIAN BLACK SPOTLIGHT & INTERACTIVE MAP (Matches "Aperçu du fichier" dark card) */}
                        <motion.section key={`map-col-${refreshCycle}`} className="card card--obsidian bento-ref__spotlight" aria-label="Peta episentrum dan kartu pantauan prioritas" initial={{ opacity: 0.88, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}>
                           <div className="obsidian-card__head">
                              <h2>Peta &amp; Fokus Episenter</h2>
                              <span className="obsidian-card__spark" aria-hidden="true">
                                 ✦
                              </span>
                           </div>

                           <div className="obsidian-map-frame">
                              <RoneLeafletMap
                                 id="latest-map"
                                 className="map map--spotlight"
                                 ariaLabel="Peta lokasi gempa terbaru dan deteksi 48 jam"
                                 events={realtime48h}
                                 latestEvent={activeHeroQuake || latest}
                                 selectedEvent={homeSelected}
                                 faintMarkers
                                 centerOnLatest
                                 latestZoom={5}
                                 scrollWheelZoom={false}
                                 isDark={true}
                                 onSelectLatest={ev => {
                                    if (latest && ev.event_id === latest.event_id) {
                                       setHomeSelected(null);
                                       setDetailTarget({ kind: "felt", data: latest });
                                    } else {
                                       const rt = realtime.find(r => r.event_id === ev.event_id);
                                       if (rt) {
                                          setFocusedRealtime(rt);
                                          setDetailTarget({ kind: "realtime", data: rt });
                                       }
                                    }
                                 }}
                                 onSelectEvent={ev => {
                                    const rt = realtime.find(r => r.event_id === ev.event_id);
                                    if (rt) {
                                       setHomeSelected(rt);
                                       setFocusedRealtime(rt);
                                       setHeroMode("realtime");
                                       setDetailTarget({ kind: "realtime", data: rt });
                                    }
                                 }}
                              />
                              <MagLegend />
                           </div>

                           <StackedQuickQuakesDeck
                              realtimeTop={realtime[0] || null}
                              feltTop={latest || feltList[0] || null}
                              significantTop={significantList[0] || null}
                              activeId={activeHeroQuake?.event_id}
                              refreshCycle={refreshCycle}
                              onPickRealtime={ev => {
                                 setHeroMode("realtime");
                                 setFocusedRealtime(ev);
                                 setHomeSelected(ev);
                                 showToast(`Fokus sensor: M ${fmtMag(ev.magnitude)} · ${ev.region}`);
                              }}
                              onPickFelt={ev => {
                                 setHeroMode("felt");
                                 setHomeSelected(ev);
                                 showToast(`Fokus ShakeMap: M ${fmtMag(ev.magnitude)} · ${ev.region}`);
                              }}
                              onPickSignificant={ev => {
                                 setDetailTarget({ kind: "felt", data: ev });
                              }}
                              onOpenDetail={() => {
                                 if (heroMode === "felt" && latest) {
                                    setDetailTarget({ kind: "felt", data: latest });
                                 } else if (realtime[0]) {
                                    setDetailTarget({
                                       kind: "realtime",
                                       data: focusedRealtime || realtime[0],
                                    });
                                 }
                              }}
                           />
                        </motion.section>

                        {/* BOTTOM-LEFT CARD: DETEKSI TERBARU STACKED PILLS (Matches "Tous les fichiers" + circular black button) */}
                        <motion.section key={`recent-feed-${refreshCycle}`} className="card bento-ref__files" aria-labelledby="recent-heading" initial={{ opacity: 0.85, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}>
                           <div className="files-card__head">
                              <div>
                                 <h2 id="recent-heading">Deteksi Terbaru</h2>
                              </div>
                              <button type="button" className="circle-btn circle-btn--obsidian" onClick={() => navigateTab("realtime")} aria-label="Lihat tabel seluruh deteksi realtime" title="Buka tabel seluruh deteksi realtime">
                                 <RoneIcon name="arrow-up-right" />
                              </button>
                           </div>

                           <div className="recent-scroll-box">
                              <ul className="file-pill-list" id="recent-list" aria-live="polite">
                                 {realtime.slice(0, 16).map(ev => {
                                    const isCurrent = activeHeroQuake?.event_id === ev.event_id;
                                    const tier = magTierInfo(ev.magnitude);
                                    return (
                                       <li key={`${ev.event_id}-${refreshCycle}`}>
                                          <button
                                             type="button"
                                             className={`file-pill-item${isCurrent ? " is-current" : ""}`}
                                             onClick={() => {
                                                setFocusedRealtime(ev);
                                                setHomeSelected(ev);
                                                setHeroMode("realtime");
                                                setDetailTarget({ kind: "realtime", data: ev });
                                             }}>
                                             <MagBadge magnitude={ev.magnitude} />
                                             <span className="file-pill-item__body">
                                                <strong>{ev.region}</strong>
                                                <span>
                                                   {fmtDepth(ev.depth_km)} · {fmtRelative(ev.origin_time, nowMs)}
                                                </span>
                                             </span>
                                             {tier.isHigh ? (
                                                <span className="high-mag-tag" data-m={tier.bucket}>
                                                   {tier.levelLabel}
                                                </span>
                                             ) : null}
                                          </button>
                                       </li>
                                    );
                                 })}
                              </ul>
                           </div>
                        </motion.section>

                        {/* MOBILE-ONLY ANALYTICS TOGGLE BAR: Keeps Mobile view ultra-simple for laymen while allowing 1-tap access to full charts */}
                        <div className="mobile-analytics-toggle-wrap">
                           <button type="button" className="mobile-analytics-toggle" aria-expanded={mobileAnalyticsOpen ? "true" : "false"} onClick={() => setMobileAnalyticsOpen(prev => !prev)}>
                              <span>{mobileAnalyticsOpen ? "Sembunyikan Grafik & Analisis Teknis" : "Tampilkan Grafik & Analisis Teknis (Kurva M, Penampang 2D & Tren 3 Bulan)"}</span>
                              <RoneIcon name="chevron-down" />
                           </button>
                        </div>

                        {/* BOTTOM-RIGHT WIDE CARD: TELEMETRY SUMMARY BAR + OBSIDIAN 3-COLUMN PROGRESS POD (Matches "Équipe" card) */}
                        <motion.section key={`overview-panel-${refreshCycle}`} className={`card bento-ref__equipe mobile-collapsible-panel${mobileAnalyticsOpen ? " is-open-mobile" : ""}`} aria-labelledby="summary-heading" initial={{ opacity: 0.85, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}>
                           {/* Top Summary Strip inside Equipe Card */}
                           <div className="equipe-summary" id="summary">
                              <div className="equipe-summary__brand">
                                 <h2 id="summary-heading">Telemetri</h2>
                                 <span className="equipe-summary__badge">BMKG</span>
                              </div>

                              <div className="equipe-summary__metrics">
                                 <div className="equipe-metric">
                                    <span className="equipe-metric__label">Gempa 24 jam</span>
                                    <div className="equipe-metric__row">
                                       <strong className="mono">{fmtNumber(summaryStats.day.length)}</strong>
                                       <span className="equipe-metric__bar" />
                                       <small className="mono">+{realtime.length}</small>
                                    </div>
                                 </div>

                                 <div className="equipe-metric">
                                    <span className="equipe-metric__label">Terkuat 24 jam</span>
                                    <div className="equipe-metric__row">
                                       <strong className="mono">{summaryStats.strongest ? `M ${fmtMag(summaryStats.strongest.magnitude)}` : "–"}</strong>
                                       <span className="equipe-metric__bar" />
                                       <small>Magnitudo</small>
                                    </div>
                                 </div>

                                 <div className="equipe-metric">
                                    <span className="equipe-metric__label">M 5+ (7 hari)</span>
                                    <div className="equipe-metric__row">
                                       <strong className="mono">{fmtNumber(summaryStats.m5week.length)}</strong>
                                       <span className="equipe-metric__bar" />
                                       <small>{summaryStats.activeTsunami ? "Tsunami Aktif" : "Tsunami Aman"}</small>
                                    </div>
                                 </div>
                              </div>

                              <svg viewBox="0 0 110 36" className="equipe-summary__spark" aria-hidden="true">
                                 <path d="M 4 28 C 22 10, 38 30, 56 16 C 74 4, 90 26, 106 14" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
                                 <path d="M 4 22 C 24 30, 42 12, 60 24 C 78 32, 92 10, 106 22" fill="none" stroke="var(--ink-3)" strokeWidth="1.4" strokeOpacity="0.5" strokeLinecap="round" />
                              </svg>
                           </div>

                           {/* Nested Obsidian Black 3-Column Telemetry Progress Card (Clean & Uncluttered) */}
                           <div className="obsidian-trio">
                              <div className="obsidian-trio__col">
                                 <div className="obsidian-trio__head">
                                    <strong>Kerak Dangkal (&lt; 60 km)</strong>
                                    <span>{fmtNumber(summaryStats.shallowCount)} deteksi sesar aktif</span>
                                 </div>
                                 <div className="obsidian-trio__prog">
                                    <div className="obsidian-trio__prog-label">
                                       <span>Proporsi Dangkal</span>
                                       <span className="mono">{Math.round((summaryStats.shallowCount / Math.max(1, realtime.length)) * 100)}%</span>
                                    </div>
                                    <div className="obsidian-trio__bar">
                                       <span
                                          style={{
                                             width: `${Math.min(100, Math.round((summaryStats.shallowCount / Math.max(1, realtime.length)) * 100))}%`,
                                          }}
                                       />
                                    </div>
                                 </div>
                              </div>

                              <div className="obsidian-trio__col">
                                 <div className="obsidian-trio__head">
                                    <strong>Subduksi (60–300 km)</strong>
                                    <span>{fmtNumber(summaryStats.subductionCount)} deteksi lempeng</span>
                                 </div>
                                 <div className="obsidian-trio__prog">
                                    <div className="obsidian-trio__prog-label">
                                       <span>Proporsi Subduksi</span>
                                       <span className="mono">{Math.round((summaryStats.subductionCount / Math.max(1, realtime.length)) * 100)}%</span>
                                    </div>
                                    <div className="obsidian-trio__bar">
                                       <span
                                          style={{
                                             width: `${Math.min(100, Math.round((summaryStats.subductionCount / Math.max(1, realtime.length)) * 100))}%`,
                                          }}
                                       />
                                    </div>
                                 </div>
                              </div>

                              <div className="obsidian-trio__col">
                                 <div className="obsidian-trio__head">
                                    <strong>Verifikasi InaTEWS</strong>
                                    <span>{fmtNumber(summaryStats.confirmedCount)} parameter terkonfirmasi</span>
                                 </div>
                                 <div className="obsidian-trio__prog">
                                    <div className="obsidian-trio__prog-label">
                                       <span>Terverifikasi Analis</span>
                                       <span className="mono">{Math.round((summaryStats.confirmedCount / Math.max(1, realtime.length)) * 100)}%</span>
                                    </div>
                                    <div className="obsidian-trio__bar">
                                       <span
                                          style={{
                                             width: `${Math.min(100, Math.round((summaryStats.confirmedCount / Math.max(1, realtime.length)) * 100))}%`,
                                          }}
                                       />
                                    </div>
                                 </div>
                              </div>
                           </div>

                           {/* Interactive Distance & P/S Wave Calculator */}
                           <EpicenterDistanceBar quake={activeHeroQuake} userPoint={userPoint} gpsLoading={gpsLoading} refreshCycle={refreshCycle} onSelectCity={handleSelectCity} onRequestGps={handleRequestGps} />
                        </motion.section>

                        {/* ROW 3: 2D HYPOCENTER DEPTH CROSS-SECTION + 3-MONTH WEEKLY BAR CHART */}
                        <div className={`bento-depth-wrapper mobile-collapsible-panel${mobileAnalyticsOpen ? " is-open-mobile" : ""}`}>
                           <HypocenterDepthCrossSection
                              activeQuake={activeHeroQuake}
                              recentQuakes={realtime}
                              nowMs={nowMs}
                              refreshCycle={refreshCycle}
                              onSelectQuake={ev => {
                                 setFocusedRealtime(ev);
                                 setHomeSelected(ev);
                                 setHeroMode("realtime");
                                 showToast(`Fokus penampang: M ${fmtMag(ev.magnitude)} · ${ev.region}`);
                              }}
                              onOpenDetail={ev => {
                                 if (latest && ev.event_id === latest.event_id) {
                                    setDetailTarget({ kind: "felt", data: latest });
                                 } else {
                                    const rt = realtime.find(r => r.event_id === ev.event_id) || realtime[0];
                                    if (rt) setDetailTarget({ kind: "realtime", data: rt });
                                 }
                              }}
                           />
                        </div>

                        <motion.section key={`weekly-chart-${refreshCycle}`} className={`card bento__chart mobile-collapsible-panel${mobileAnalyticsOpen ? " is-open-mobile" : ""}`} aria-labelledby="chart-heading" initial={{ opacity: 0.85, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}>
                           <div className="card__head">
                              <div>
                                 <h2 id="chart-heading">Aktivitas 3 Bulan Terakhir (M 4,5+)</h2>
                                 <span className="hint" id="chart-hint">
                                    {weeklyChartData ? `${fmtNumber(weeklyChartData.total)} gempa M 4,5+ · rata-rata ${fmtNumber(weeklyChartData.average)}/minggu` : "Gempa M 4,5+ per minggu, katalog BMKG"}
                                 </span>
                              </div>
                              <span className="pill">M 4,5+</span>
                           </div>
                           <div className="chart" id="weekly-chart">
                              {weeklyChartData ? (
                                 <>
                                    <div className="chart__plot" aria-hidden="false">
                                       <div className="chart__grid">
                                          {[weeklyChartData.top, weeklyChartData.top / 2, 0].map(v => (
                                             <span key={v} className="chart__gridline">
                                                <span className="mono">{fmtNumber(v)}</span>
                                             </span>
                                          ))}
                                       </div>
                                       <div className="chart__cols">
                                          {weeklyChartData.weeks.map((w, i) => {
                                             const isPeak = w === weeklyChartData.peak;
                                             const pct = `${(w.count / weeklyChartData.top) * 100}%`;
                                             return (
                                                <button key={`${w.start}-${refreshCycle}`} type="button" className={`chart__col${isPeak ? " is-peak" : ""}${w.partial ? " is-partial" : ""}`} aria-label={`${w.label}: ${w.count} gempa`} style={{ "--h": pct, "--delay": `${i * 28}ms` } as React.CSSProperties}>
                                                   {isPeak ? <span className="chart__value mono">{fmtNumber(w.count)}</span> : <span className="chart__subval mono">{fmtNumber(w.count)}</span>}
                                                   <span className="chart__bar" />
                                                   <span className="chart__tip" role="tooltip">
                                                      <strong>{fmtNumber(w.count)} gempa</strong>
                                                      <span>{w.label}</span>
                                                      {w.partial ? <em>Data sebagian minggu</em> : null}
                                                      {w.max ? (
                                                         <span>
                                                            Terbesar M {fmtMag(w.max.magnitude)} · {w.max.region}
                                                         </span>
                                                      ) : null}
                                                   </span>
                                                   <span className="chart__x">{i % 2 === 0 || weeklyChartData.weeks.length < 8 ? w.shortLabel : ""}</span>
                                                </button>
                                             );
                                          })}
                                       </div>
                                    </div>
                                    {weeklyChartData.weeks.some(w => w.partial) ? <p className="chart__note">Batang pucat: minggu berjalan · Batang hitam pekat: puncak aktivitas mingguan.</p> : null}
                                 </>
                              ) : (
                                 <div className="skeleton skeleton--block" style={{ minHeight: 180 }} />
                              )}
                           </div>
                        </motion.section>
                     </div>
                  )}

                  {/* ==================== 2. REALTIME — FULL-WIDTH STRUCTURED DETECTION TABLE ==================== */}
                  {activeTab === "realtime" && (
                     <div className="page-stack">
                        <section className="card map-banner-card" aria-label="Peta deteksi realtime">
                           <div className="map-banner-card__head">
                              <h2>Peta Sebaran Sensor Realtime</h2>
                              <div className="row">
                                 <span className="pill">{fmtNumber(realtime.length)} deteksi aktif</span>
                                 {realtime[0] ? <MagBadge magnitude={realtime[0].magnitude} size="sm" /> : null}
                              </div>
                           </div>
                           <RoneLeafletMap
                              id="realtime-map"
                              className="map map--banner"
                              ariaLabel="Peta deteksi realtime"
                              events={filteredRealtime}
                              latestEvent={filteredRealtime[0] || null}
                              selectedEvent={rtSelected}
                              centerOnLatest
                              latestZoom={5}
                              scrollWheelZoom={false}
                              isDark={isDark}
                              onSelectEvent={ev => {
                                 const found = realtime.find(r => r.event_id === ev.event_id);
                                 if (found) {
                                    setRtSelected(found);
                                    setDetailTarget({ kind: "realtime", data: found });
                                 }
                              }}
                           />
                           <MagLegend />
                        </section>

                        <section className="card structured-table-card" aria-label="Tabel terstruktur deteksi gempa realtime">
                           <div className="toolbar" role="group" aria-label="Saring data realtime">
                              <div className="segmented" id="mag-filter" role="group" aria-label="Magnitudo minimum">
                                 {[
                                    { min: 0, label: "Semua Magnitudo" },
                                    { min: 3, label: "M 3,0+" },
                                    { min: 4, label: "M 4,0+" },
                                    { min: 5, label: "M 5,0+" },
                                 ].map(b => (
                                    <button key={b.min} type="button" aria-pressed={rtMinMag === b.min ? "true" : "false"} onClick={() => setRtMinMag(b.min)}>
                                       {b.label}
                                    </button>
                                 ))}
                              </div>

                              <label className="field field--search">
                                 <RoneIcon name="search" />
                                 <span className="visually-hidden">Cari wilayah</span>
                                 <input type="search" placeholder="Filter wilayah episenter…" autoComplete="off" value={rtQuery} onChange={e => setRtQuery(e.target.value)} />
                              </label>

                              <span className="toolbar__spacer" />
                              <div className="segmented segmented--viewmode" role="group" aria-label="Mode tampilan data">
                                 {(
                                    [
                                       { id: "auto", label: "Otomatis" },
                                       { id: "cards", label: "Kartu Ringkas" },
                                       { id: "table", label: "Tabel Penuh" },
                                    ] as const
                                 ).map(vm => (
                                    <button key={vm.id} type="button" aria-pressed={tableDisplayMode === vm.id ? "true" : "false"} onClick={() => setTableDisplayMode(vm.id)}>
                                       {vm.label}
                                    </button>
                                 ))}
                              </div>
                              <span className="toolbar__count mono" aria-live="polite">
                                 {fmtNumber(filteredRealtime.length)} / {fmtNumber(realtime.length)} deteksi
                              </span>
                           </div>

                           <div className="table-wrap" data-display-mode={tableDisplayMode}>
                              <table className={`table table--structured table--mode-${tableDisplayMode}`} id="table">
                                 <caption className="visually-hidden">Tabel terstruktur deteksi gempa real-time BMKG</caption>
                                 <thead>
                                    <tr>
                                       <th scope="col" className="col-idx col-hide-tablet">
                                          #
                                       </th>
                                       <th scope="col" aria-sort={rtSort.key === "magnitude" ? (rtSort.dir === "asc" ? "ascending" : "descending") : undefined}>
                                          <button
                                             className="sort-btn"
                                             type="button"
                                             onClick={() =>
                                                setRtSort(prev => ({
                                                   key: "magnitude",
                                                   dir: prev.key === "magnitude" && prev.dir === "desc" ? "asc" : "desc",
                                                }))
                                             }>
                                             Magnitudo (M) ↕
                                          </button>
                                       </th>
                                       <th scope="col" aria-sort={rtSort.key === "origin_time" ? (rtSort.dir === "asc" ? "ascending" : "descending") : undefined}>
                                          <button
                                             className="sort-btn"
                                             type="button"
                                             onClick={() =>
                                                setRtSort(prev => ({
                                                   key: "origin_time",
                                                   dir: prev.key === "origin_time" && prev.dir === "desc" ? "asc" : "desc",
                                                }))
                                             }>
                                             Waktu Kejadian (WIB) ↕
                                          </button>
                                       </th>
                                       <th scope="col" aria-sort={rtSort.key === "region" ? (rtSort.dir === "asc" ? "ascending" : "descending") : undefined}>
                                          <button
                                             className="sort-btn"
                                             type="button"
                                             onClick={() =>
                                                setRtSort(prev => ({
                                                   key: "region",
                                                   dir: prev.key === "region" && prev.dir === "desc" ? "asc" : "desc",
                                                }))
                                             }>
                                             Wilayah Episenter ↕
                                          </button>
                                       </th>
                                       <th scope="col" className="col-coord col-hide-tablet">
                                          Koordinat
                                       </th>
                                       <th scope="col" aria-sort={rtSort.key === "depth_km" ? (rtSort.dir === "asc" ? "ascending" : "descending") : undefined}>
                                          <button
                                             className="sort-btn"
                                             type="button"
                                             onClick={() =>
                                                setRtSort(prev => ({
                                                   key: "depth_km",
                                                   dir: prev.key === "depth_km" && prev.dir === "desc" ? "asc" : "desc",
                                                }))
                                             }>
                                             Kedalaman &amp; Zona ↕
                                          </button>
                                       </th>
                                       <th scope="col">Status Sensor</th>
                                       <th scope="col" className="num">
                                          Aksi
                                       </th>
                                    </tr>
                                 </thead>
                                 <tbody id="rows">
                                    {filteredRealtime.length ? (
                                       filteredRealtime.map((ev, idx) => {
                                          const depthTier = depthCategoryLabel(ev.depth_km).tier;
                                          const tier = magTierInfo(ev.magnitude);
                                          return (
                                             <tr
                                                key={ev.event_id}
                                                data-id={ev.event_id}
                                                aria-selected={rtSelected?.event_id === ev.event_id ? "true" : "false"}
                                                tabIndex={0}
                                                onClick={() => {
                                                   setRtSelected(ev);
                                                   setDetailTarget({ kind: "realtime", data: ev });
                                                }}
                                                onKeyDown={e => {
                                                   if (e.key === "Enter" || e.key === " ") {
                                                      e.preventDefault();
                                                      setRtSelected(ev);
                                                      setDetailTarget({ kind: "realtime", data: ev });
                                                   }
                                                }}>
                                                <td className="col-idx col-hide-tablet mono" data-label="#">
                                                   {String(idx + 1).padStart(2, "0")}
                                                </td>
                                                <td className="td-mag" data-label="Magnitudo">
                                                   <div className="cell-mag">
                                                      <MagBadge magnitude={ev.magnitude} />
                                                      {tier.isHigh ? (
                                                         <span className="high-mag-tag" data-m={tier.bucket}>
                                                            {tier.levelLabel}
                                                         </span>
                                                      ) : null}
                                                   </div>
                                                </td>
                                                <td className="td-time nowrap" data-label="Waktu (WIB)">
                                                   <strong className="mono cell-primary">{fmtDateTime(ev.origin_time)}</strong>
                                                   <div className="xsmall muted">
                                                      <time dateTime={ev.origin_time}>{fmtRelative(ev.origin_time, nowMs)}</time>
                                                   </div>
                                                </td>
                                                <td className="td-region" data-label="Wilayah">
                                                   <strong className="cell-region">{ev.region}</strong>
                                                </td>
                                                <td className="td-coord col-coord col-hide-tablet nowrap" data-label="Koordinat">
                                                   <span className="coord-pill mono">{fmtCoords(ev.latitude, ev.longitude)}</span>
                                                </td>
                                                <td className="td-depth nowrap" data-label="Kedalaman">
                                                   <strong className="mono">{fmtDepth(ev.depth_km)}</strong> <span className="depth-badge">{depthTier}</span>
                                                </td>
                                                <td className="td-status" data-label="Status">
                                                   <span className={`pill ${ev.status === "confirmed" ? "pill--obsidian" : ""}`}>{ev.status === "confirmed" ? "Terkonfirmasi" : "Otomatis"}</span>
                                                </td>
                                                <td className="td-action num nowrap" data-label="Aksi">
                                                   <button
                                                      type="button"
                                                      className="table-action-btn"
                                                      onClick={e => {
                                                         e.stopPropagation();
                                                         setRtSelected(ev);
                                                         setDetailTarget({ kind: "realtime", data: ev });
                                                      }}>
                                                      Detail →
                                                   </button>
                                                </td>
                                             </tr>
                                          );
                                       })
                                    ) : (
                                       <tr>
                                          <td colSpan={8}>
                                             <div className="empty">
                                                <strong>Tidak ada kejadian yang cocok</strong>
                                                <span>Ubah filter magnitudo atau kata kunci pencarian.</span>
                                             </div>
                                          </td>
                                       </tr>
                                    )}
                                 </tbody>
                              </table>
                           </div>
                        </section>
                     </div>
                  )}

                  {/* ==================== 3 & 4. DIRASAKAN (/felt/) & M5+ (/m5/) — STRUCTURED TABLE ==================== */}
                  {(activeTab === "felt" || activeTab === "significant") && (
                     <div className="page-stack">
                        <section className="card map-banner-card" aria-label="Peta kejadian">
                           <div className="map-banner-card__head">
                              <h2>{activeTab === "felt" ? "Peta Gempa Dirasakan (Skala MMI & ShakeMap)" : "Peta Gempa Signifikan Magnitudo M 5,0+"}</h2>
                              <div className="row">
                                 <span className="pill">{fmtNumber(currentAlertsSource.length)} kejadian resmi</span>
                                 {currentAlertsSource[0] ? <MagBadge magnitude={currentAlertsSource[0].magnitude} size="sm" /> : null}
                              </div>
                           </div>

                           <RoneLeafletMap
                              id={`alerts-map-${activeTab}`}
                              className="map map--banner"
                              ariaLabel="Peta kejadian"
                              events={filteredAlerts}
                              latestEvent={filteredAlerts[0] || null}
                              selectedEvent={alertsSelected}
                              fitArchipelago
                              scrollWheelZoom={false}
                              isDark={isDark}
                              onSelectEvent={ev => {
                                 const found = currentAlertsSource.find(item => item.event_id === ev.event_id);
                                 if (found) {
                                    setAlertsSelected(found);
                                    setDetailTarget({ kind: "felt", data: found });
                                 }
                              }}
                           />
                           <MagLegend />
                        </section>

                        <section className="card structured-table-card" aria-label="Tabel terstruktur kejadian gempa">
                           <div className="toolbar">
                              <div className="segmented" role="group" aria-label="Saring magnitudo minimum">
                                 {[
                                    { min: 0, label: "Semua Magnitudo" },
                                    { min: 4, label: "M 4,0+" },
                                    { min: 5, label: "M 5,0+" },
                                    { min: 6, label: "M 6,0+" },
                                 ].map(b => (
                                    <button key={b.min} type="button" aria-pressed={alertsMinMag === b.min ? "true" : "false"} onClick={() => setAlertsMinMag(b.min)}>
                                       {b.label}
                                    </button>
                                 ))}
                              </div>

                              <label className="field field--search">
                                 <RoneIcon name="search" />
                                 <span className="visually-hidden">Cari wilayah</span>
                                 <input type="search" placeholder={activeTab === "felt" ? "Cari wilayah atau kota yang merasakan (MMI)…" : "Cari wilayah episenter…"} autoComplete="off" value={alertsQuery} onChange={e => setAlertsQuery(e.target.value)} />
                              </label>
                              <span className="toolbar__spacer" />
                              <div className="segmented segmented--viewmode" role="group" aria-label="Mode tampilan data">
                                 {(
                                    [
                                       { id: "auto", label: "Otomatis" },
                                       { id: "cards", label: "Kartu Ringkas" },
                                       { id: "table", label: "Tabel Penuh" },
                                    ] as const
                                 ).map(vm => (
                                    <button key={vm.id} type="button" aria-pressed={tableDisplayMode === vm.id ? "true" : "false"} onClick={() => setTableDisplayMode(vm.id)}>
                                       {vm.label}
                                    </button>
                                 ))}
                              </div>
                              <span className="toolbar__count mono" aria-live="polite">
                                 {fmtNumber(filteredAlerts.length)} kejadian ditampilkan
                              </span>
                           </div>

                           <div className="table-wrap" data-display-mode={tableDisplayMode}>
                              <table className={`table table--structured table--mode-${tableDisplayMode}`}>
                                 <caption className="visually-hidden">{activeTab === "felt" ? "Tabel terstruktur gempa dirasakan" : "Tabel terstruktur gempa M 5,0 ke atas"}</caption>
                                 <thead>
                                    <tr>
                                       <th scope="col" className="col-idx col-hide-tablet">
                                          #
                                       </th>
                                       <th scope="col">
                                          <button
                                             className="sort-btn"
                                             type="button"
                                             onClick={() =>
                                                setAlertsSort(p => ({
                                                   key: "magnitude",
                                                   dir: p.key === "magnitude" && p.dir === "desc" ? "asc" : "desc",
                                                }))
                                             }>
                                             Magnitudo (M) ↕
                                          </button>
                                       </th>
                                       <th scope="col">
                                          <button
                                             className="sort-btn"
                                             type="button"
                                             onClick={() =>
                                                setAlertsSort(p => ({
                                                   key: "origin_time",
                                                   dir: p.key === "origin_time" && p.dir === "desc" ? "asc" : "desc",
                                                }))
                                             }>
                                             Waktu Kejadian (WIB) ↕
                                          </button>
                                       </th>
                                       <th scope="col">
                                          <button
                                             className="sort-btn"
                                             type="button"
                                             onClick={() =>
                                                setAlertsSort(p => ({
                                                   key: "region",
                                                   dir: p.key === "region" && p.dir === "desc" ? "asc" : "desc",
                                                }))
                                             }>
                                             Wilayah Episenter ↕
                                          </button>
                                       </th>
                                       <th scope="col" className="col-coord col-hide-tablet">
                                          Koordinat
                                       </th>
                                       <th scope="col">
                                          <button
                                             className="sort-btn"
                                             type="button"
                                             onClick={() =>
                                                setAlertsSort(p => ({
                                                   key: "depth_km",
                                                   dir: p.key === "depth_km" && p.dir === "desc" ? "asc" : "desc",
                                                }))
                                             }>
                                             Kedalaman &amp; Zona ↕
                                          </button>
                                       </th>
                                       <th scope="col">{activeTab === "felt" ? "Intensitas Dirasakan (MMI)" : "Potensi & Status BMKG"}</th>
                                       <th scope="col" className="num">
                                          Aksi
                                       </th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {filteredAlerts.length ? (
                                       filteredAlerts.map((eq, idx) => {
                                          const feltParsed = parseFelt(eq.felt);
                                          const depthTier = depthCategoryLabel(eq.depth_km).tier;
                                          const tier = magTierInfo(eq.magnitude);
                                          return (
                                             <tr
                                                key={eq.event_id}
                                                data-id={eq.event_id}
                                                aria-selected={alertsSelected?.event_id === eq.event_id ? "true" : "false"}
                                                tabIndex={0}
                                                onClick={() => {
                                                   setAlertsSelected(eq);
                                                   setDetailTarget({ kind: "felt", data: eq });
                                                }}
                                                onKeyDown={e => {
                                                   if (e.key === "Enter" || e.key === " ") {
                                                      e.preventDefault();
                                                      setAlertsSelected(eq);
                                                      setDetailTarget({ kind: "felt", data: eq });
                                                   }
                                                }}>
                                                <td className="col-idx col-hide-tablet mono" data-label="#">
                                                   {String(idx + 1).padStart(2, "0")}
                                                </td>
                                                <td className="td-mag" data-label="Magnitudo">
                                                   <div className="cell-mag">
                                                      <MagBadge magnitude={eq.magnitude} />
                                                      {tier.isHigh ? (
                                                         <span className="high-mag-tag" data-m={tier.bucket}>
                                                            {tier.levelLabel}
                                                         </span>
                                                      ) : null}
                                                   </div>
                                                </td>
                                                <td className="td-time nowrap" data-label="Waktu (WIB)">
                                                   <strong className="mono cell-primary">{fmtDateTime(eq.origin_time)}</strong>
                                                   <div className="xsmall muted">{fmtRelative(eq.origin_time, nowMs)}</div>
                                                </td>
                                                <td className="td-region" data-label="Wilayah">
                                                   <strong className="cell-region">{eq.region}</strong>
                                                   {eq.tsunami_potential ? (
                                                      <div className="mt-1">
                                                         <span className="pill pill--signal">Potensi Tsunami</span>
                                                      </div>
                                                   ) : null}
                                                </td>
                                                <td className="td-coord col-coord col-hide-tablet nowrap" data-label="Koordinat">
                                                   <span className="coord-pill mono">{fmtCoords(eq.latitude, eq.longitude)}</span>
                                                </td>
                                                <td className="td-depth nowrap" data-label="Kedalaman">
                                                   <strong className="mono">{fmtDepth(eq.depth_km)}</strong> <span className="depth-badge">{depthTier}</span>
                                                </td>
                                                <td className="td-status" data-label="Status / MMI">
                                                   {activeTab === "felt" && feltParsed.length ? (
                                                      <div className="mmi-inline-list">
                                                         {feltParsed.slice(0, 3).map((f, fIdx) => (
                                                            <span key={fIdx} className="mmi-chip">
                                                               <b>{f.intensity}</b> {f.place}
                                                            </span>
                                                         ))}
                                                         {feltParsed.length > 3 ? <span className="xsmall muted">+{feltParsed.length - 3} kota</span> : null}
                                                      </div>
                                                   ) : (
                                                      <span className="small">{eq.potential || eq.felt || "Tidak berpotensi tsunami"}</span>
                                                   )}
                                                </td>
                                                <td className="td-action num nowrap" data-label="Aksi">
                                                   <button
                                                      type="button"
                                                      className="table-action-btn"
                                                      onClick={e => {
                                                         e.stopPropagation();
                                                         setAlertsSelected(eq);
                                                         setDetailTarget({ kind: "felt", data: eq });
                                                      }}>
                                                      ShakeMap →
                                                   </button>
                                                </td>
                                             </tr>
                                          );
                                       })
                                    ) : (
                                       <tr>
                                          <td colSpan={8}>
                                             <div className="empty">
                                                <strong>Tidak ada kejadian</strong>
                                                <span>Coba kata kunci atau filter magnitudo lain.</span>
                                             </div>
                                          </td>
                                       </tr>
                                    )}
                                 </tbody>
                              </table>
                           </div>
                        </section>
                     </div>
                  )}

                  {/* ==================== 5. TSUNAMI (/tsunami/) ==================== */}
                  {activeTab === "tsunami" && (
                     <div className="page-stack">
                        <section className="card" aria-labelledby="levels-heading">
                           <div className="card__head">
                              <div>
                                 <h2 id="levels-heading">Matriks Status Peringatan Dini Tsunami InaTEWS</h2>
                                 <span className="hint">Riwayat resmi peringatan dini tsunami BMKG: zona terdampak, pengamatan tinggi muka laut, dan kronologi buletin PD-1 hingga PD-4.</span>
                              </div>
                              <span className="pill pill--obsidian">{fmtNumber(tsunamiList.length)} Kejadian Tercatat</span>
                           </div>
                           <ul className="level-legend">
                              <li>
                                 <span className="pill pill--awas">AWAS</span>
                                 <span>Perkiraan tinggi &gt; 3 m — evakuasi menyeluruh</span>
                              </li>
                              <li>
                                 <span className="pill pill--siaga">SIAGA</span>
                                 <span>0,5–3 m — evakuasi menuju tempat tinggi</span>
                              </li>
                              <li>
                                 <span className="pill pill--waspada">WASPADA</span>
                                 <span>&lt; 0,5 m — jauhi pantai dan tepi sungai</span>
                              </li>
                           </ul>
                        </section>

                        <div id="events" aria-live="polite" className="page-stack">
                           {tsunamiList.map((ev, index) => {
                              const zoneBulletin: RoneTsunamiBulletin | undefined = ev.bulletins.find(b => b.zones?.length) || ev.bulletins[0];
                              const obsBulletin: RoneTsunamiBulletin | undefined = ev.bulletins.find(b => b.observations?.length);
                              const zones: RoneTsunamiZone[] = zoneBulletin?.zones || [];
                              const mediaSource = ev.bulletins.find(b => b.media?.warning_zones)?.media || ev.bulletins[0]?.media || {};

                              const counts: Record<string, number> = {
                                 AWAS: 0,
                                 SIAGA: 0,
                                 WASPADA: 0,
                              };
                              zones.forEach(z => {
                                 if (counts[z.level] != null) counts[z.level] += 1;
                              });
                              const maxZoneCount = Math.max(1, ...Object.values(counts));

                              return (
                                 <article key={ev.id} className="card tsunami-event" aria-labelledby={`ts-${index}`}>
                                    <header className="tsunami-event__head">
                                       <div className="tsunami-event__title-row">
                                          <MagBadge magnitude={ev.magnitude} size="lg" />
                                          <div>
                                             <h2 className="tsunami-event__title" id={`ts-${index}`}>
                                                {ev.region}
                                             </h2>
                                             <p className="small muted">{fmtLong(ev.origin_time)}</p>
                                             <div className="row mt-3">
                                                <span className={`pill${ev.ended ? "" : " pill--signal"}`}>{ev.ended ? "Peringatan berakhir" : "Peringatan aktif"}</span>
                                                {ev.max_level ? <span className={`pill pill--${ev.max_level.toLowerCase()}`}>{ev.max_level}</span> : null}
                                             </div>
                                          </div>
                                       </div>
                                       <FactsList
                                          extraClass="facts--4"
                                          rows={[
                                             ["Tinggi teramati maks.", ev.max_wave_height_m != null ? `${fmtDecimal(ev.max_wave_height_m)} m` : "–"],
                                             ["Kedalaman", fmtDepth(ev.depth_km)],
                                             ["Koordinat", fmtCoords(ev.latitude, ev.longitude)],
                                             ["Buletin", fmtNumber(ev.bulletins.length)],
                                          ]}
                                       />
                                    </header>

                                    <div className="tsunami-event__grid">
                                       <section>
                                          <h3>Kronologi buletin</h3>
                                          <ol className="timeline">
                                             {ev.bulletins.map(b => (
                                                <li key={b.event_id + b.code}>
                                                   <span className="timeline__code">{b.code}</span>
                                                   <span className="timeline__time">{fmtTime(b.issued_at)}</span>
                                                   <p className="timeline__text">
                                                      <strong>{bulletinLabel(b.code)}</strong>
                                                      {bulletinLabel(b.code) ? " — " : ""}M {fmtMag(b.magnitude)}
                                                   </p>
                                                </li>
                                             ))}
                                          </ol>
                                       </section>

                                       <section>
                                          {zones.length ? (
                                             <>
                                                <h3>Zona peringatan · {fmtNumber(zones.length)} wilayah</h3>
                                                <div className="level-bars">
                                                   {(["AWAS", "SIAGA", "WASPADA"] as const)
                                                      .filter(lv => counts[lv] > 0)
                                                      .map(lv => (
                                                         <div key={lv} className="level-bar">
                                                            <span className={`pill pill--${lv.toLowerCase()}`}>{lv}</span>
                                                            <span className="level-bar__track">
                                                               <span
                                                                  className="level-bar__fill"
                                                                  style={
                                                                     {
                                                                        width: `${(counts[lv] / maxZoneCount) * 100}%`,
                                                                        "--c": `var(--lv-${lv.toLowerCase()})`,
                                                                     } as React.CSSProperties
                                                                  }
                                                               />
                                                            </span>
                                                            <span className="num mono">{fmtNumber(counts[lv])}</span>
                                                         </div>
                                                      ))}
                                                </div>

                                                <details className="disclosure">
                                                   <summary>Daftar wilayah terdampak ({zones.length})</summary>
                                                   <div className="table-wrap">
                                                      <table className="table table--structured">
                                                         <thead>
                                                            <tr>
                                                               <th scope="col">Status</th>
                                                               <th scope="col">Provinsi</th>
                                                               <th scope="col">Kabupaten / Kota</th>
                                                               <th scope="col">Perkiraan Tiba</th>
                                                            </tr>
                                                         </thead>
                                                         <tbody>
                                                            {zones.map((z, zIdx) => (
                                                               <tr key={`${z.district}-${zIdx}`}>
                                                                  <td>
                                                                     <span className={`pill pill--${z.level.toLowerCase()}`}>{z.level}</span>
                                                                  </td>
                                                                  <td>{z.province}</td>
                                                                  <td>{z.district}</td>
                                                                  <td className="mono nowrap">{z.estimated_arrival ? fmtDateTime(z.estimated_arrival) : "–"}</td>
                                                               </tr>
                                                            ))}
                                                         </tbody>
                                                      </table>
                                                   </div>
                                                </details>
                                             </>
                                          ) : (
                                             <p className="small muted">Tidak ada zona peringatan pada buletin ini.</p>
                                          )}

                                          {obsBulletin ? (
                                             <details className="disclosure" open={index === 0}>
                                                <summary>Pengamatan tsunami · {fmtNumber(obsBulletin.observations.length)} lokasi</summary>
                                                <div className="table-wrap">
                                                   <table className="table table--structured">
                                                      <thead>
                                                         <tr>
                                                            <th scope="col">Stasiun</th>
                                                            <th scope="col">Lokasi</th>
                                                            <th scope="col">Waktu</th>
                                                            <th scope="col" className="num">
                                                               Tinggi Gelombang
                                                            </th>
                                                         </tr>
                                                      </thead>
                                                      <tbody>
                                                         {obsBulletin.observations.map((o, oIdx) => (
                                                            <tr key={`${o.station}-${oIdx}`}>
                                                               <td className="mono">{o.station}</td>
                                                               <td>{o.location}</td>
                                                               <td className="mono nowrap">{o.time}</td>
                                                               <td className="num mono">
                                                                  <strong>{fmtDecimal(o.height_m)} m</strong>
                                                               </td>
                                                            </tr>
                                                         ))}
                                                      </tbody>
                                                   </table>
                                                </div>
                                             </details>
                                          ) : null}

                                          <div className="mt-5">
                                             <MediaViewerSection
                                                title="Peta BMKG"
                                                items={[
                                                   {
                                                      label: "Zona peringatan",
                                                      caption: "Status peringatan per wilayah",
                                                      src: mediaSource.warning_zones,
                                                   },
                                                   {
                                                      label: "Waktu tiba",
                                                      caption: "Perkiraan waktu tiba gelombang",
                                                      src: mediaSource.travel_time,
                                                   },
                                                   {
                                                      label: "Tinggi muka laut",
                                                      caption: "Perkiraan tinggi muka laut maksimum",
                                                      src: mediaSource.sea_height,
                                                   },
                                                   {
                                                      label: "Peta guncangan",
                                                      caption: "Estimasi intensitas guncangan",
                                                      src: mediaSource.shakemap,
                                                   },
                                                ]}
                                                onOpenLightbox={(items, idx) => setLightboxState({ items, index: idx })}
                                             />
                                          </div>

                                          {ev.instructions?.length ? (
                                             <details className="disclosure">
                                                <summary>Arahan BMKG</summary>
                                                <ul className="prose small" style={{ padding: "0 var(--s-2) 0 var(--s-6)" }}>
                                                   {ev.instructions.map((inst, iIdx) => (
                                                      <li key={iIdx}>{inst}</li>
                                                   ))}
                                                </ul>
                                             </details>
                                          ) : null}
                                       </section>
                                    </div>
                                 </article>
                              );
                           })}
                        </div>
                     </div>
                  )}

                  {/* ==================== 6. MERUSAK (/damage/) — STRUCTURED TABLE ==================== */}
                  {activeTab === "damaging" && (
                     <div className="page-stack">
                        <div className="stats" id="summary">
                           {damagingList.length
                              ? (() => {
                                   const years = damagingList.map(e => new Date(e.origin_time).getUTCFullYear());
                                   const biggest = damagingList.reduce((a, b) => (b.magnitude > a.magnitude ? b : a), damagingList[0]);
                                   const withTsunami = damagingList.filter(e => e.tsunami).length;
                                   return (
                                      <>
                                         <div className="stat">
                                            <p className="stat__label">Total Kejadian</p>
                                            <p className="stat__value">{fmtNumber(damagingList.length)}</p>
                                            <p className="stat__note">gempa merusak tercatat</p>
                                         </div>
                                         <div className="stat">
                                            <p className="stat__label">Memicu Tsunami</p>
                                            <p className="stat__value">{fmtNumber(withTsunami)}</p>
                                            <p className="stat__note">{Math.round((withTsunami / damagingList.length) * 100)}% dari seluruh kejadian</p>
                                         </div>
                                         <div className="stat">
                                            <p className="stat__label">Magnitudo Terbesar</p>
                                            <p className="stat__value">M {fmtMag(biggest.magnitude)}</p>
                                            <p className="stat__note">
                                               {biggest.province}, {new Date(biggest.origin_time).getUTCFullYear()}
                                            </p>
                                         </div>
                                         <div className="stat">
                                            <p className="stat__label">Rentang Tahun</p>
                                            <p className="stat__value">
                                               {Math.min(...years)}–{Math.max(...years)}
                                            </p>
                                            <p className="stat__note">katalog historis BMKG</p>
                                         </div>
                                      </>
                                   );
                                })()
                              : ["Total Kejadian", "Memicu Tsunami", "Magnitudo Terbesar", "Rentang Tahun"].map(label => (
                                   <div key={label} className="stat">
                                      <p className="stat__label">{label}</p>
                                      <p className="stat__value">
                                         <span className="skeleton skeleton--line" style={{ width: "3ch" }} />
                                      </p>
                                      <p className="stat__note">&nbsp;</p>
                                   </div>
                                ))}
                        </div>

                        <section className="card map-banner-card" aria-label="Peta gempa merusak">
                           <RoneLeafletMap
                              id="damage-map"
                              className="map map--banner"
                              ariaLabel="Peta gempa merusak"
                              events={filteredDamaging}
                              latestEvent={filteredDamaging[0] || null}
                              selectedEvent={dmgSelected}
                              markerScale={0.6}
                              fitArchipelago
                              scrollWheelZoom={false}
                              isDark={isDark}
                              onSelectEvent={ev => {
                                 const found = damagingList.find(d => d.event_id === ev.event_id);
                                 if (found) {
                                    setDmgSelected(found);
                                    setDetailTarget({ kind: "damaging", data: found });
                                 }
                              }}
                           />
                           <MagLegend />
                        </section>

                        <section className="card structured-table-card" aria-label="Tabel katalog gempa merusak">
                           <div className="toolbar">
                              <label className="field field--search">
                                 <RoneIcon name="search" />
                                 <span className="visually-hidden">Cari provinsi atau lokasi</span>
                                 <input
                                    type="search"
                                    placeholder="Cari provinsi, episenter, dampak kerusakan…"
                                    autoComplete="off"
                                    value={dmgQuery}
                                    onChange={e => {
                                       setDmgQuery(e.target.value);
                                       setDmgPage(0);
                                    }}
                                 />
                              </label>

                              <label className="field field--select">
                                 <span className="visually-hidden">Periode</span>
                                 <select
                                    value={dmgPeriod}
                                    onChange={e => {
                                       setDmgPeriod(e.target.value);
                                       setDmgPage(0);
                                    }}>
                                    <option value="">Semua dekade</option>
                                    {damagingDecades.map(d => (
                                       <option key={d} value={String(d)}>
                                          {d}–{d + 9}
                                       </option>
                                    ))}
                                 </select>
                              </label>

                              <label className="check">
                                 <input
                                    type="checkbox"
                                    checked={dmgOnlyTsunami}
                                    onChange={e => {
                                       setDmgOnlyTsunami(e.target.checked);
                                       setDmgPage(0);
                                    }}
                                 />{" "}
                                 Memicu tsunami
                              </label>

                              <span className="toolbar__spacer" />
                              <div className="segmented segmented--viewmode" role="group" aria-label="Mode tampilan data">
                                 {(
                                    [
                                       { id: "auto", label: "Otomatis" },
                                       { id: "cards", label: "Kartu Ringkas" },
                                       { id: "table", label: "Tabel Penuh" },
                                    ] as const
                                 ).map(vm => (
                                    <button key={vm.id} type="button" aria-pressed={tableDisplayMode === vm.id ? "true" : "false"} onClick={() => setTableDisplayMode(vm.id)}>
                                       {vm.label}
                                    </button>
                                 ))}
                              </div>
                              <span className="toolbar__count mono" aria-live="polite">
                                 {fmtNumber(filteredDamaging.length)} kejadian
                              </span>
                           </div>

                           <div className="table-wrap" data-display-mode={tableDisplayMode}>
                              <table className={`table table--structured table--mode-${tableDisplayMode}`}>
                                 <caption className="visually-hidden">Katalog gempa merusak</caption>
                                 <thead>
                                    <tr>
                                       <th scope="col" className="col-idx col-hide-tablet">
                                          #
                                       </th>
                                       <th scope="col">
                                          <button
                                             className="sort-btn"
                                             type="button"
                                             onClick={() =>
                                                setDmgSort(p => ({
                                                   key: "magnitude",
                                                   dir: p.key === "magnitude" && p.dir === "desc" ? "asc" : "desc",
                                                }))
                                             }>
                                             Magnitudo (M) ↕
                                          </button>
                                       </th>
                                       <th scope="col">
                                          <button
                                             className="sort-btn"
                                             type="button"
                                             onClick={() =>
                                                setDmgSort(p => ({
                                                   key: "origin_time",
                                                   dir: p.key === "origin_time" && p.dir === "desc" ? "asc" : "desc",
                                                }))
                                             }>
                                             Tanggal (UTC) ↕
                                          </button>
                                       </th>
                                       <th scope="col">
                                          <button
                                             className="sort-btn"
                                             type="button"
                                             onClick={() =>
                                                setDmgSort(p => ({
                                                   key: "province",
                                                   dir: p.key === "province" && p.dir === "desc" ? "asc" : "desc",
                                                }))
                                             }>
                                             Provinsi &amp; Episenter ↕
                                          </button>
                                       </th>
                                       <th scope="col" className="col-coord col-hide-tablet">
                                          Koordinat
                                       </th>
                                       <th scope="col">
                                          <button
                                             className="sort-btn"
                                             type="button"
                                             onClick={() =>
                                                setDmgSort(p => ({
                                                   key: "depth_km",
                                                   dir: p.key === "depth_km" && p.dir === "desc" ? "asc" : "desc",
                                                }))
                                             }>
                                             Kedalaman ↕
                                          </button>
                                       </th>
                                       <th scope="col">Dampak &amp; Tsunami</th>
                                       <th scope="col" className="num">
                                          Aksi
                                       </th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {filteredDamaging.slice(dmgPage * 25, (dmgPage + 1) * 25).map((ev, idx) => (
                                       <tr
                                          key={ev.event_id}
                                          data-id={ev.event_id}
                                          tabIndex={0}
                                          onClick={() => {
                                             setDmgSelected(ev);
                                             setDetailTarget({ kind: "damaging", data: ev });
                                          }}>
                                          <td className="col-idx col-hide-tablet mono" data-label="#">
                                             {String(dmgPage * 25 + idx + 1).padStart(2, "0")}
                                          </td>
                                          <td className="td-mag" data-label="Magnitudo">
                                             <div className="cell-mag">
                                                <MagBadge magnitude={ev.magnitude} />
                                                {ev.magnitude >= 5.0 ? (
                                                   <span className="high-mag-tag" data-m={magBucket(ev.magnitude)}>
                                                      {magTierInfo(ev.magnitude).levelLabel}
                                                   </span>
                                                ) : null}
                                             </div>
                                          </td>
                                          <td className="td-time nowrap mono" data-label="Tanggal">
                                             <strong>{fmtUtcDate(ev.origin_time)}</strong>
                                          </td>
                                          <td className="td-region" data-label="Provinsi & Episenter">
                                             <strong className="cell-region">{ev.province}</strong>
                                             <div className="xsmall muted">{ev.epicenter}</div>
                                          </td>
                                          <td className="td-coord col-coord col-hide-tablet nowrap" data-label="Koordinat">
                                             <span className="coord-pill mono">{fmtCoords(ev.latitude, ev.longitude)}</span>
                                          </td>
                                          <td className="td-depth nowrap" data-label="Kedalaman">
                                             <strong className="mono">{fmtDepth(ev.depth_km)}</strong> <span className="depth-badge">{depthCategoryLabel(ev.depth_km).tier}</span>
                                          </td>
                                          <td className="td-status wrap small" data-label="Dampak">
                                             {ev.tsunami ? (
                                                <span className="pill pill--signal" style={{ marginRight: 6 }}>
                                                   Tsunami
                                                </span>
                                             ) : null}
                                             {ev.impact ? ev.impact.length > 120 ? `${ev.impact.slice(0, 120)}…` : ev.impact : <span className="muted">–</span>}
                                          </td>
                                          <td className="td-action num nowrap" data-label="Aksi">
                                             <button
                                                type="button"
                                                className="table-action-btn"
                                                onClick={e => {
                                                   e.stopPropagation();
                                                   setDmgSelected(ev);
                                                   setDetailTarget({ kind: "damaging", data: ev });
                                                }}>
                                                Detail →
                                             </button>
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>

                           {filteredDamaging.length > 25 ? (
                              <div className="pager">
                                 <span>
                                    {fmtNumber(dmgPage * 25 + 1)}–{fmtNumber(Math.min(filteredDamaging.length, (dmgPage + 1) * 25))} dari {fmtNumber(filteredDamaging.length)} kejadian
                                 </span>
                                 <span className="pager__btns">
                                    <button className="btn btn--sm" type="button" disabled={dmgPage === 0} onClick={() => setDmgPage(p => Math.max(0, p - 1))}>
                                       <RoneIcon name="arrow-left" /> Sebelumnya
                                    </button>
                                    <button className="btn btn--sm" type="button" disabled={(dmgPage + 1) * 25 >= filteredDamaging.length} onClick={() => setDmgPage(p => p + 1)}>
                                       Berikutnya <RoneIcon name="arrow-right" />
                                    </button>
                                 </span>
                              </div>
                           ) : null}
                        </section>
                     </div>
                  )}

                  {/* ==================== 7. PETA (/map/) ==================== */}
                  {activeTab === "map" && (
                     <div className="page-stack">
                        <RoneLeafletMap
                           id="seismicity-map"
                           className="map map--full"
                           ariaLabel="Peta seismisitas"
                           events={mapLayersOn.realtime ? realtime : []}
                           latestEvent={mapLayersOn.realtime ? realtime[0] || null : null}
                           zoomPosition="bottomright"
                           scrollWheelZoom
                           isDark={isDark}
                           extraLayers={{
                              archive3m: mapLayersOn.archive3m ? archive3m : undefined,
                              archive5y: mapLayersOn.archive5y ? archive5y : undefined,
                              faultsIndonesia: mapLayersOn.faultsIndonesia ? faultsIndonesia : null,
                              faultsGlobal: mapLayersOn.faultsGlobal ? faultsGlobal : null,
                              stationsIndonesia: mapLayersOn.stationsIndonesia ? stationsIndonesia : undefined,
                              stationsGlobal: mapLayersOn.stationsGlobal ? stationsGlobal : undefined,
                           }}
                           onSelectEvent={ev => {
                              const found = realtime.find(r => r.event_id === ev.event_id);
                              if (found) setDetailTarget({ kind: "realtime", data: found });
                           }}>
                           <details className="map-panel" id="layers" open>
                              <summary>
                                 <RoneIcon name="layers" />
                                 <span>Lapisan Peta</span>
                                 <span className="map-panel__active" id="active-count" aria-label="lapisan aktif">
                                    {activeMapLayerCount}
                                 </span>
                              </summary>
                              <div className="map-panel__body">
                                 <fieldset>
                                    <legend>Gempa Bumi</legend>
                                    <label className="check">
                                       <span>Realtime</span>
                                       <span className="count">{fmtNumber(realtime.length)}</span>
                                       <input type="checkbox" checked={mapLayersOn.realtime} onChange={e => setMapLayersOn(p => ({ ...p, realtime: e.target.checked }))} />
                                    </label>
                                    <label className="check">
                                       <span>3 bulan (M 4,5+)</span>
                                       <span className="count">{fmtNumber(archive3m.length)}</span>
                                       <input type="checkbox" checked={mapLayersOn.archive3m} onChange={e => setMapLayersOn(p => ({ ...p, archive3m: e.target.checked }))} />
                                    </label>
                                    <label className="check">
                                       <span>5 tahun (M 5,0+)</span>
                                       <span className="count">{archive5y.length ? fmtNumber(archive5y.length) : ""}</span>
                                       <input type="checkbox" checked={mapLayersOn.archive5y} onChange={e => setMapLayersOn(p => ({ ...p, archive5y: e.target.checked }))} />
                                    </label>
                                 </fieldset>

                                 <fieldset>
                                    <legend>Referensi Tektonik</legend>
                                    <label className="check">
                                       <span>Sesar Indonesia</span>
                                       <span className="count">{faultsIndonesia?.features?.length ? fmtNumber(faultsIndonesia.features.length) : ""}</span>
                                       <input
                                          type="checkbox"
                                          checked={mapLayersOn.faultsIndonesia}
                                          onChange={e =>
                                             setMapLayersOn(p => ({
                                                ...p,
                                                faultsIndonesia: e.target.checked,
                                             }))
                                          }
                                       />
                                    </label>
                                    <label className="check">
                                       <span>Sesar &amp; lempeng global</span>
                                       <span className="count">{faultsGlobal?.features?.length ? fmtNumber(faultsGlobal.features.length) : ""}</span>
                                       <input
                                          type="checkbox"
                                          checked={mapLayersOn.faultsGlobal}
                                          onChange={e =>
                                             setMapLayersOn(p => ({
                                                ...p,
                                                faultsGlobal: e.target.checked,
                                             }))
                                          }
                                       />
                                    </label>
                                    <label className="check">
                                       <span>Stasiun BMKG</span>
                                       <span className="count">{stationsIndonesia.length ? fmtNumber(stationsIndonesia.length) : ""}</span>
                                       <input
                                          type="checkbox"
                                          checked={mapLayersOn.stationsIndonesia}
                                          onChange={e =>
                                             setMapLayersOn(p => ({
                                                ...p,
                                                stationsIndonesia: e.target.checked,
                                             }))
                                          }
                                       />
                                    </label>
                                    <label className="check">
                                       <span>Stasiun global</span>
                                       <span className="count">{stationsGlobal.length ? fmtNumber(stationsGlobal.length) : ""}</span>
                                       <input
                                          type="checkbox"
                                          checked={mapLayersOn.stationsGlobal}
                                          onChange={e =>
                                             setMapLayersOn(p => ({
                                                ...p,
                                                stationsGlobal: e.target.checked,
                                             }))
                                          }
                                       />
                                    </label>
                                 </fieldset>

                                 <div className="legend" style={{ margin: 0 }}>
                                    <span className="legend__item">
                                       <span className="legend__swatch" style={{ "--c": "var(--m-3)" } as React.CSSProperties} />M 3
                                    </span>
                                    <span className="legend__item">
                                       <span className="legend__swatch" style={{ "--c": "var(--m-4)" } as React.CSSProperties} />M 4
                                    </span>
                                    <span className="legend__item">
                                       <span className="legend__swatch" style={{ "--c": "var(--m-5)" } as React.CSSProperties} />M 5
                                    </span>
                                    <span className="legend__item">
                                       <span className="legend__swatch" style={{ "--c": "var(--m-6)" } as React.CSSProperties} />M 6
                                    </span>
                                    <span className="legend__item">
                                       <span className="legend__swatch" style={{ "--c": "var(--m-7)" } as React.CSSProperties} />M 7+
                                    </span>
                                 </div>
                                 {layerLoadingStatus ? (
                                    <p className="xsmall muted" aria-live="polite">
                                       {layerLoadingStatus}
                                    </p>
                                 ) : null}
                              </div>
                           </details>
                        </RoneLeafletMap>
                     </div>
                  )}

                  {/* ==================== 8. TENTANG (/about/) ==================== */}
                  {activeTab === "about" && (
                     <div className="split split--list">
                        <article className="card prose">
                           <h2>Sumber Data</h2>
                           <p>
                              Semua data berasal dari <strong>BMKG</strong> (Badan Meteorologi, Klimatologi, dan Geofisika) melalui sistem InaTEWS. Situs ini menata ulang telemetri seismik agar terstruktur dan mudah dianalisis. Untuk keadaan darurat, ikuti arahan resmi BMKG, BNPB, dan BPBD setempat.
                           </p>

                           <h2>Jenis Kanal Data</h2>
                           <ul>
                              <li>
                                 <strong>Realtime</strong> — deteksi otomatis jaringan seismik, muncul beberapa menit setelah gempa. Waktu asli dalam UTC dikonversi ke WIB.
                              </li>
                              <li>
                                 <strong>Dirasakan</strong> dan <strong>M 5+</strong> — info gempa yang sudah diverifikasi BMKG, lengkap dengan peta guncangan (ShakeMap) dan laporan intensitas MMI.
                              </li>
                              <li>
                                 <strong>Tsunami</strong> — buletin peringatan dini: PD-1 (peringatan awal), PD-2 (pemutakhiran), PD-3.x (pengamatan tsunami), dan PD-4 (peringatan berakhir).
                              </li>
                              <li>
                                 <strong>Merusak</strong> — katalog historis gempa yang menimbulkan korban jiwa atau kerusakan infrastruktur sejak 1920-an.
                              </li>
                           </ul>

                           <h2>Skala Satuan Magnitudo (M)</h2>
                           <p>
                              Magnitudo (<strong>M</strong>) mengukur energi yang dilepaskan di pusat patahan gempa. Setiap kenaikan 1,0 satuan Magnitudo berarti pelepasan energi sekitar 32 kali lebih besar:
                           </p>
                           <table className="table table--structured scale-table">
                              <thead>
                                 <tr>
                                    <th scope="col">Lencana</th>
                                    <th scope="col">Rentang Magnitudo</th>
                                    <th scope="col">Karakteristik Energi &amp; Dampak</th>
                                 </tr>
                              </thead>
                              <tbody>
                                 <tr>
                                    <td>
                                       <MagBadge magnitude={2.5} size="sm" labelOverride="M <3" />
                                    </td>
                                    <td className="mono">Magnitudo M &lt; 3,0</td>
                                    <td>Terekam instrumen seismograf lokal; umumnya tidak terasa manusia.</td>
                                 </tr>
                                 <tr>
                                    <td>
                                       <MagBadge magnitude={3.5} size="sm" labelOverride="M 3" />
                                    </td>
                                    <td className="mono">Magnitudo M 3,0–3,9</td>
                                    <td>Terasa ringan di dekat episenter apabila kedalaman sangat dangkal.</td>
                                 </tr>
                                 <tr>
                                    <td>
                                       <MagBadge magnitude={4.5} size="sm" labelOverride="M 4" />
                                    </td>
                                    <td className="mono">Magnitudo M 4,0–4,9</td>
                                    <td>Getaran dirasakan cukup luas di dalam ruangan; jarang memicu kerusakan.</td>
                                 </tr>
                                 <tr>
                                    <td>
                                       <MagBadge magnitude={5.5} size="sm" labelOverride="M 5" />
                                    </td>
                                    <td className="mono">Magnitudo M 5,0–5,9</td>
                                    <td>Dapat menyebabkan kerusakan ringan–sedang pada konstruksi lemah.</td>
                                 </tr>
                                 <tr>
                                    <td>
                                       <MagBadge magnitude={6.5} size="sm" labelOverride="M 6" />
                                    </td>
                                    <td className="mono">Magnitudo M 6,0–6,9</td>
                                    <td>Energi besar; berpotensi merusak di kawasan berpenduduk dekat episenter.</td>
                                 </tr>
                                 <tr>
                                    <td>
                                       <MagBadge magnitude={7.5} size="sm" labelOverride="M 7+" />
                                    </td>
                                    <td className="mono">Magnitudo M ≥ 7,0</td>
                                    <td>Kerusakan struktural luas; hiposenter dangkal di laut dapat memicu tsunami.</td>
                                 </tr>
                              </tbody>
                           </table>

                           <h2>Intensitas Guncangan (MMI)</h2>
                           <p>Skala Modified Mercalli Intensity (angka Romawi) menggambarkan guncangan di lokasi pengamat:</p>
                           <table className="table table--structured">
                              <tbody>
                                 <tr>
                                    <td className="mono">I–II MMI</td>
                                    <td>Dirasakan sedikit orang dalam keadaan tenang, benda gantung bergoyang.</td>
                                 </tr>
                                 <tr>
                                    <td className="mono">III–IV MMI</td>
                                    <td>Terasa nyata di dalam rumah seperti truk berat melintas.</td>
                                 </tr>
                                 <tr>
                                    <td className="mono">V–VI MMI</td>
                                    <td>Dirasakan hampir semua warga; barang ringan jatuh, plester dinding retak.</td>
                                 </tr>
                                 <tr>
                                    <td className="mono">VII–VIII MMI</td>
                                    <td>Kerusakan ringan hingga sedang pada bangunan standar.</td>
                                 </tr>
                                 <tr>
                                    <td className="mono">IX+ MMI</td>
                                    <td>Kerusakan struktural berat.</td>
                                 </tr>
                              </tbody>
                           </table>
                        </article>

                        <aside className="split__sticky">
                           <section className="card card--obsidian" aria-labelledby="api-heading">
                              <p className="hero__kicker">API JSON Terbuka</p>
                              <h2 className="mt-2" id="api-heading" style={{ fontSize: "var(--fs-lg)", color: "#FFFFFF" }}>
                                 Endpoint Telemetri JSON
                              </h2>
                              <p className="small mt-2" style={{ color: "rgba(255,255,255,0.72)" }}>
                                 Respons dinormalisasi: kunci berbahasa Inggris, angka bertipe numerik, koordinat desimal bertanda, dan waktu ISO 8601.
                              </p>
                              <div className="endpoints mt-5">
                                 {[
                                    ["/api/v1/earthquakes/latest", "Gempa dirasakan terakhir"],
                                    ["/api/v1/earthquakes/realtime", "Deteksi realtime (?min_magnitude, ?limit)"],
                                    ["/api/v1/earthquakes/realtime/{id}/history", "Riwayat pemutakhiran"],
                                    ["/api/v1/earthquakes/felt", "30 gempa dirasakan"],
                                    ["/api/v1/earthquakes/significant", "30 gempa M 5+"],
                                    ["/api/v1/earthquakes/damaging", "Katalog gempa merusak (?year)"],
                                    ["/api/v1/earthquakes/archive/{3m|5y}", "Katalog 3 bulan / 5 tahun"],
                                    ["/api/v1/tsunami", "Peringatan tsunami per kejadian"],
                                    ["/api/v1/stations/{indonesia|global}", "Stasiun seismik"],
                                    ["/api/v1/faults/{indonesia|global}", "Jalur sesar (GeoJSON)"],
                                 ].map(([path, desc]) => (
                                    <div key={path} className="endpoint endpoint--dark">
                                       <code>
                                          <span className="method">GET</span>
                                          {path}
                                       </code>
                                       <span>{desc}</span>
                                    </div>
                                 ))}
                              </div>
                              <div className="row mt-5">
                                 <button type="button" className="btn" style={{ background: "#FFFFFF", color: "#0F0F10" }} onClick={() => navigateTab("docs")}>
                                    Uji Endpoint Interaktif →
                                 </button>
                                 <a
                                    className="btn"
                                    style={{
                                       background: "rgba(255,255,255,0.12)",
                                       color: "#FFFFFF",
                                       borderColor: "rgba(255,255,255,0.22)",
                                    }}
                                    href="https://gempa.rone.dev/redoc"
                                    target="_blank"
                                    rel="noopener noreferrer">
                                    ReDoc
                                 </a>
                              </div>
                           </section>
                        </aside>
                     </div>
                  )}

                  {/* ==================== 9. /DOCS INTERACTIVE OPENAPI EXPLORER ==================== */}
                  {activeTab === "docs" && (
                     <div className="split split--list">
                        <section className="card">
                           <div className="card__head">
                              <h2>Daftar Endpoint OpenAPI (v2.0.0)</h2>
                              <button type="button" className="link-arrow" onClick={() => navigateTab("about")}>
                                 <RoneIcon name="arrow-left" /> Kembali ke Tentang
                              </button>
                           </div>
                           <div className="endpoints">
                              {[
                                 ["/api/v1/earthquakes/latest", "Gempa dirasakan terakhir"],
                                 ["/api/v1/earthquakes/realtime?limit=25", "Deteksi realtime terbaru"],
                                 ["/api/v1/earthquakes/felt", "30 gempa dirasakan (MMI)"],
                                 ["/api/v1/earthquakes/significant", "30 gempa M 5+ signifikan"],
                                 ["/api/v1/earthquakes/damaging", "Katalog gempa merusak historis"],
                                 ["/api/v1/earthquakes/archive/3m", "Katalog 3 bulan terakhir (M 4,5+)"],
                                 ["/api/v1/tsunami", "Buletin peringatan dini tsunami InaTEWS"],
                                 ["/api/v1/stations/indonesia", "Jaringan stasiun seismik BMKG"],
                                 ["/api/v1/faults/indonesia", "Jalur sesar aktif Indonesia (GeoJSON)"],
                              ].map(([ep, desc]) => (
                                 <button
                                    key={ep}
                                    type="button"
                                    className="endpoint"
                                    style={{
                                       textAlign: "left",
                                       cursor: "pointer",
                                       outline: apiPlayPath === ep ? "2px solid var(--ink)" : undefined,
                                    }}
                                    onClick={() => setApiPlayPath(ep)}>
                                    <code>
                                       <span className="method">GET</span>
                                       {ep}
                                    </code>
                                    <span>{desc}</span>
                                 </button>
                              ))}
                           </div>
                        </section>

                        <aside className="split__sticky">
                           <section className="card card--obsidian">
                              <div className="card__head">
                                 <h2 style={{ color: "#FFFFFF" }}>Respons JSON Langsung</h2>
                                 <span className="mono xsmall" style={{ color: "rgba(255,255,255,0.68)" }}>
                                    {apiPlayPath}
                                 </span>
                              </div>
                              <div
                                 className="well mono xsmall"
                                 style={{
                                    maxHeight: "520px",
                                    overflow: "auto",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    background: "#18181B",
                                    color: "#F4F4F5",
                                    borderColor: "rgba(255,255,255,0.14)",
                                 }}>
                                 {apiPlayLoading ? "Memuat respons JSON…" : apiPlayResponse}
                              </div>
                           </section>
                        </aside>
                     </div>
                  )}
               </main>

               {activeTab !== "map" && (
                  <footer className="site-footer">
                     <div className="site-footer__inner">
                        <div>
                           <p>
                              Data gempa bumi dan tsunami: <strong>BMKG</strong> (Badan Meteorologi, Klimatologi, dan Geofisika).
                           </p>
                           <p>Situs tidak resmi. Untuk keadaan darurat, ikuti arahan BMKG, BNPB, dan BPBD setempat.</p>
                        </div>
                        <nav aria-label="Tautan kaki">
                           <button type="button" onClick={() => navigateTab("about")}>
                              Tentang data
                           </button>
                           <button type="button" onClick={() => navigateTab("docs")}>
                              Dokumentasi API
                           </button>
                           <a href="https://github.com/hananchaliq/gempa-seismic" target="_blank" rel="noopener noreferrer">
                              Kode sumber
                           </a>
                        </nav>
                     </div>
                  </footer>
               )}
            </div>

            {/* Thumb-Friendly Mobile Bottom Navigation Bar (Visible on Phones < 680px) */}
            <nav className="mobile-bottom-nav" aria-label="Navigasi cepat perangkat seluler">
               {NAV_ITEMS.map(item => {
                  const isActive = activeTab === item.key;
                  return (
                     <button key={`mob-${item.key}`} type="button" className={`mobile-bottom-nav__btn${isActive ? " is-active" : ""}`} aria-current={isActive ? "page" : undefined} onClick={() => navigateTab(item.key)}>
                        <RoneIcon name={item.icon} />
                        <span>{item.shortLabel}</span>
                     </button>
                  );
               })}
            </nav>
         </div>

         <RoneDetailSheet
            target={detailTarget}
            realtimePool={realtime}
            nowMs={nowMs}
            onClose={() => setDetailTarget(null)}
            onPickRealtime={ev => {
               setHomeSelected(ev);
               setRtSelected(ev);
               setDetailTarget({ kind: "realtime", data: ev });
            }}
            onShare={handleShareEvent}
            onOpenLightbox={(items, index) => setLightboxState({ items, index })}
         />

         <RoneLightbox state={lightboxState} onClose={() => setLightboxState(null)} />

         <div className="toast" role="status" aria-live="polite" data-show={toastMsg ? "true" : "false"}>
            {toastMsg}
         </div>
      </div>
   );
}
