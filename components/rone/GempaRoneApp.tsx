"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  fmtClockWib,
  fmtCoords,
  fmtDateTime,
  fmtDecimal,
  fmtDepth,
  fmtLong,
  fmtMag,
  fmtNumber,
  fmtRelative,
  fmtTime,
  fmtUtcDate,
  parseFelt,
  RoneDamagingEvent,
  RoneEarthquake,
  RoneRealtimeEvent,
  RoneStation,
  RoneTsunamiBulletin,
  RoneTsunamiEvent,
  RoneTsunamiZone,
  weeklyBuckets,
} from "@/lib/rone/format";
import {
  EventListItem,
  FactsList,
  MagBadge,
  MagDial,
  MagLegend,
  RoneIcon,
} from "./RoneIcons";
import { MapQuakePoint, RoneLeafletMap } from "./RoneLeafletMap";
import {
  DetailTarget,
  MediaItem,
  MediaViewerSection,
  RoneDetailSheet,
  RoneLightbox,
} from "./RoneDetailSheet";

export type RoneTabKey =
  | "home"
  | "realtime"
  | "felt"
  | "significant"
  | "tsunami"
  | "damaging"
  | "map"
  | "about"
  | "docs";

interface NavItem {
  key: RoneTabKey;
  path: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "home", path: "/", label: "Terkini" },
  { key: "realtime", path: "/realtime", label: "Realtime" },
  { key: "felt", path: "/felt", label: "Dirasakan" },
  { key: "significant", path: "/m5", label: "M5+" },
  { key: "tsunami", path: "/tsunami", label: "Tsunami" },
  { key: "damaging", path: "/damage", label: "Merusak" },
  { key: "map", path: "/map", label: "Peta" },
  { key: "about", path: "/about", label: "Tentang" },
];

const DAY_MS = 86_400_000;

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

export function GempaRoneApp({
  initialTab = "home",
  initialData,
}: {
  initialTab?: RoneTabKey;
  initialData: InitialRonePayload;
}) {
  const [activeTab, setActiveTab] = useState<RoneTabKey>(initialTab);
  const [isDark, setIsDark] = useState(false);
  const [nowMs, setNowMs] = useState<number>(initialData.referenceNowMs);
  const [liveTimeLabel, setLiveTimeLabel] = useState<string>(() =>
    `Diperbarui ${fmtClockWib(new Date(initialData.referenceNowMs))}`
  );
  const [liveOk, setLiveOk] = useState(true);

  // Core datasets
  const [latest, setLatest] = useState<RoneEarthquake | null>(initialData.latest);
  const [realtime, setRealtime] = useState<RoneRealtimeEvent[]>(initialData.realtime);
  const [feltList, setFeltList] = useState<RoneEarthquake[]>(initialData.felt);
  const [significantList, setSignificantList] = useState<RoneEarthquake[]>(
    initialData.significant
  );
  const [tsunamiList, setTsunamiList] = useState<RoneTsunamiEvent[]>(initialData.tsunami);
  const [archive3m, setArchive3m] = useState<RoneRealtimeEvent[]>(initialData.archive3m);
  const [damagingList, setDamagingList] = useState<RoneDamagingEvent[]>([]);
  const [damagingLoaded, setDamagingLoaded] = useState(false);

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
  const [faultsIndonesia, setFaultsIndonesia] = useState<GeoJSON.FeatureCollection | null>(
    null
  );
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

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  }, []);

  // Theme initialization
  useEffect(() => {
    const saved = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = saved ? saved === "dark" : false && prefersDark;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    setIsDark(dark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      window.localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };

  // Switch navigation tab and update browser URL cleanly
  const navigateTab = useCallback((tab: RoneTabKey) => {
    setActiveTab(tab);
    setAlertsQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    const navItem = NAV_ITEMS.find((n) => n.key === tab);
    const targetPath = tab === "docs" ? "/docs" : navItem?.path || "/";
    try {
      window.history.pushState({}, "", targetPath);
    } catch {}
  }, []);

  // Periodic refresh of live endpoints every 60s
  const refreshLiveFeeds = useCallback(async () => {
    try {
      const [latestRes, rtRes, sigRes, tsRes] = await Promise.all([
        fetch("/api/v1/earthquakes/latest"),
        fetch("/api/v1/earthquakes/realtime?limit=500"),
        fetch("/api/v1/earthquakes/significant"),
        fetch("/api/v1/tsunami"),
      ]);
      if (latestRes.ok) {
        const j = await latestRes.json();
        if (j?.data) setLatest(j.data);
      }
      if (rtRes.ok) {
        const j = await rtRes.json();
        if (Array.isArray(j?.data)) setRealtime(j.data);
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
    } catch {
      setLiveOk(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(refreshLiveFeeds, 60_000);
    return () => clearInterval(timer);
  }, [refreshLiveFeeds]);

  // Lazy load damaging earthquakes when Merusak tab is opened
  useEffect(() => {
    if (activeTab === "damaging" && !damagingLoaded) {
      fetch("/api/v1/earthquakes/damaging")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
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
  }, [
    activeTab,
    mapLayersOn,
    faultsIndonesia,
    faultsGlobal,
    stationsIndonesia.length,
    stationsGlobal.length,
    archive5y.length,
  ]);

  // Load API preview when /docs is opened
  useEffect(() => {
    if (activeTab !== "docs") return;
    setApiPlayLoading(true);
    fetch(apiPlayPath)
      .then((r) => r.json())
      .then((j) => setApiPlayResponse(JSON.stringify(j, null, 2).slice(0, 4000)))
      .catch((e) => setApiPlayResponse(String(e)))
      .finally(() => setApiPlayLoading(false));
  }, [activeTab, apiPlayPath]);

  // Derived Home (Terkini) calculations matching pages/home.js 1:1
  const realtime48h = useMemo(
    () =>
      realtime.filter(
        (e) => nowMs - new Date(e.origin_time).getTime() < 2 * DAY_MS
      ),
    [realtime, nowMs]
  );

  const summaryStats = useMemo(() => {
    const day = realtime.filter(
      (e) => nowMs - new Date(e.origin_time).getTime() < DAY_MS
    );
    const strongest = day.reduce<RoneRealtimeEvent | null>(
      (a, b) => (!a || b.magnitude > a.magnitude ? b : a),
      null
    );
    const m5week = significantList.filter(
      (e) => nowMs - new Date(e.origin_time).getTime() < 7 * DAY_MS
    );
    const activeTsunami = tsunamiList.find(
      (e) => !e.ended && nowMs - new Date(e.origin_time).getTime() < DAY_MS
    );
    const lastTsunami = tsunamiList[0] || null;
    return { day, strongest, m5week, activeTsunami, lastTsunami };
  }, [realtime, significantList, tsunamiList, nowMs]);

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
    const list = realtime.filter(
      (e) => e.magnitude >= rtMinMag && (!q || e.region.toLowerCase().includes(q))
    );
    const dir = rtSort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (rtSort.key === "magnitude") return (a.magnitude - b.magnitude) * dir;
      if (rtSort.key === "depth_km") return (a.depth_km - b.depth_km) * dir;
      if (rtSort.key === "region") return a.region.localeCompare(b.region) * dir;
      return (
        (new Date(a.origin_time).getTime() - new Date(b.origin_time).getTime()) * dir
      );
    });
  }, [realtime, rtMinMag, rtQuery, rtSort]);

  // Felt / M5+ filtered rows
  const currentAlertsSource = activeTab === "significant" ? significantList : feltList;
  const filteredAlerts = useMemo(() => {
    const q = alertsQuery.trim().toLowerCase();
    if (!q) return currentAlertsSource;
    return currentAlertsSource.filter((e) =>
      `${e.region} ${e.felt ?? ""}`.toLowerCase().includes(q)
    );
  }, [currentAlertsSource, alertsQuery]);

  // Damaging catalogue filtered + sorted rows
  const damagingDecades = useMemo(() => {
    const years = damagingList.map((e) => new Date(e.origin_time).getUTCFullYear());
    return [...new Set(years.map((y) => Math.floor(y / 10) * 10))].sort((a, b) => b - a);
  }, [damagingList]);

  const filteredDamaging = useMemo(() => {
    const q = dmgQuery.trim().toLowerCase();
    const list = damagingList.filter((ev) => {
      if (dmgOnlyTsunami && !ev.tsunami) return false;
      if (dmgPeriod) {
        const y = new Date(ev.origin_time).getUTCFullYear();
        const dec = Number(dmgPeriod);
        if (y < dec || y >= dec + 10) return false;
      }
      if (!q) return true;
      return `${ev.province} ${ev.epicenter} ${ev.impact ?? ""}`
        .toLowerCase()
        .includes(q);
    });
    const dir = dmgSort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (dmgSort.key === "magnitude") return (a.magnitude - b.magnitude) * dir;
      if (dmgSort.key === "depth_km") return (a.depth_km - b.depth_km) * dir;
      if (dmgSort.key === "province") return a.province.localeCompare(b.province) * dir;
      return (
        (new Date(a.origin_time).getTime() - new Date(b.origin_time).getTime()) * dir
      );
    });
  }, [damagingList, dmgOnlyTsunami, dmgPeriod, dmgQuery, dmgSort]);

  const handleShareEvent = useCallback(
    (eventId: string) => {
      const url = `${window.location.origin}${window.location.pathname}#e=${encodeURIComponent(
        eventId
      )}`;
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

  return (
    <>
      <a className="skip-link" href="#main">
        Lewati ke konten
      </a>

      {summaryStats.activeTsunami ? (
        <div className="alert-banner" role="alert">
          <div className="container">
            <strong>Peringatan dini tsunami aktif</strong>
            <span>
              M{fmtMag(summaryStats.activeTsunami.magnitude)} ·{" "}
              {summaryStats.activeTsunami.region}
            </span>
            <button type="button" onClick={() => navigateTab("tsunami")}>
              Lihat buletin →
            </button>
          </div>
        </div>
      ) : null}

      <header className="site-header">
        <div
          className={`container${
            activeTab === "realtime" || activeTab === "map" ? " container--wide" : ""
          }`}
        >
          <div className="site-header__bar">
            <button
              type="button"
              className="brand"
              aria-label="Gempa — beranda"
              onClick={() => navigateTab("home")}
            >
              <svg viewBox="0 0 28 18" fill="none" aria-hidden="true">
                <path
                  d="M1 9h6l2-5 3 12 3-15 3 11 2-3h7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Gempa
            </button>

            <div className="nav-wrap">
              <nav className="nav" aria-label="Navigasi utama">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-current={activeTab === item.key ? "page" : undefined}
                    onClick={() => navigateTab(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="header-tools">
              <span
                className="live"
                id="live-status"
                data-state={liveOk ? "ok" : "error"}
                aria-live="polite"
              >
                <span className="live__dot" aria-hidden="true" />
                <span className="live__label" id="live-label">
                  {liveOk ? liveTimeLabel : "Gagal memuat"}
                </span>
              </span>
              <button
                className="icon-btn"
                type="button"
                id="theme-toggle"
                aria-label="Ganti tema terang/gelap"
                onClick={toggleTheme}
              >
                <RoneIcon name="moon" className="icon theme-icon-light" />
                <RoneIcon name="sun" className="icon theme-icon-dark" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ==================== 1. TERKINI (HOME) ==================== */}
        {activeTab === "home" && (
          <div className="container page">
            <header className="page-head">
              <h1>Gempa bumi terkini di Indonesia</h1>
              <p>
                Gempa terakhir yang dirasakan dan deteksi real-time dari jaringan seismik
                BMKG, diperbarui setiap menit.
              </p>
            </header>

            <div className="bento">
              <article className="card hero bento__hero" aria-labelledby="latest-title">
                <div className="hero__top">
                  <div id="latest-dial">
                    {latest ? (
                      <MagDial magnitude={latest.magnitude} />
                    ) : (
                      <div className="dial">
                        <span className="dial__value">
                          <span className="dial__num">–</span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="hero__intro">
                    <p className="hero__kicker">Gempa dirasakan terakhir</p>
                    <h2 className="hero__title" id="latest-title">
                      {latest ? latest.region : "Memuat data BMKG…"}
                    </h2>
                    <p className="hero__time" id="latest-time">
                      {latest ? (
                        <>
                          {fmtLong(latest.origin_time)} ·{" "}
                          <span data-rel-time={latest.origin_time}>
                            {fmtRelative(latest.origin_time, nowMs)}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>

                <div id="latest-facts">
                  {latest ? (
                    <FactsList
                      rows={[
                        ["Kedalaman", fmtDepth(latest.depth_km)],
                        ["Koordinat", fmtCoords(latest.latitude, latest.longitude)],
                        [
                          "Potensi tsunami",
                          latest.tsunami_potential ? (
                            <strong style={{ color: "var(--accent-ink)" }}>
                              Berpotensi tsunami
                            </strong>
                          ) : (
                            "Tidak berpotensi"
                          ),
                        ],
                        [
                          "Dirasakan",
                          (() => {
                            const f = parseFelt(latest.felt);
                            return f.length
                              ? f.map((i) => `${i.intensity} ${i.place}`).join(", ")
                              : "–";
                          })(),
                        ],
                      ]}
                    />
                  ) : null}
                </div>

                <div className="hero__actions" id="latest-actions">
                  <button
                    className="btn btn--accent"
                    type="button"
                    onClick={() => {
                      if (!latest) return;
                      setHomeSelected(null);
                      setDetailTarget({ kind: "felt", data: latest });
                    }}
                  >
                    Detail &amp; peta guncangan
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => navigateTab("felt")}
                  >
                    Gempa dirasakan lainnya
                  </button>
                </div>
              </article>

              <section className="card map-card bento__map" aria-label="Peta episentrum">
                <RoneLeafletMap
                  id="latest-map"
                  className="map map--tall"
                  ariaLabel="Peta lokasi gempa terakhir dan deteksi 48 jam"
                  events={realtime48h}
                  latestEvent={latest}
                  selectedEvent={homeSelected}
                  faintMarkers
                  centerOnLatest
                  latestZoom={6}
                  scrollWheelZoom={false}
                  isDark={isDark}
                  onSelectLatest={(ev) => {
                    if (latest && ev.event_id === latest.event_id) {
                      setHomeSelected(null);
                      setDetailTarget({ kind: "felt", data: latest });
                    }
                  }}
                  onSelectEvent={(ev) => {
                    const rt = realtime.find((r) => r.event_id === ev.event_id);
                    if (rt) {
                      setHomeSelected(rt);
                      setDetailTarget({ kind: "realtime", data: rt });
                    }
                  }}
                />
                <MagLegend />
              </section>

              <section className="bento__stats" aria-labelledby="summary-heading">
                <h2 className="visually-hidden" id="summary-heading">
                  Ringkasan
                </h2>
                <div className="stats" id="summary">
                  <div className="stat">
                    <p className="stat__label">Gempa 24 jam</p>
                    <p className="stat__value">{fmtNumber(summaryStats.day.length)}</p>
                    <p className="stat__note">terdeteksi otomatis</p>
                  </div>
                  <div className="stat">
                    <p className="stat__label">Terkuat 24 jam</p>
                    <p className="stat__value">
                      {summaryStats.strongest
                        ? fmtMag(summaryStats.strongest.magnitude)
                        : "–"}
                    </p>
                    <p className="stat__note">
                      {summaryStats.strongest?.region || "\u00A0"}
                    </p>
                  </div>
                  <div className="stat">
                    <p className="stat__label">M5+ 7 hari</p>
                    <p className="stat__value">{fmtNumber(summaryStats.m5week.length)}</p>
                    <p className="stat__note">
                      {summaryStats.m5week[0]
                        ? `terakhir ${fmtRelative(summaryStats.m5week[0].origin_time, nowMs)}`
                        : "di wilayah Indonesia"}
                    </p>
                  </div>
                  <div className="stat">
                    <p className="stat__label">Status tsunami</p>
                    <p className="stat__value">
                      {summaryStats.activeTsunami ? (
                        <span style={{ color: "var(--accent-ink)" }}>Aktif</span>
                      ) : (
                        "Aman"
                      )}
                    </p>
                    <p className="stat__note">
                      {summaryStats.activeTsunami
                        ? summaryStats.activeTsunami.region
                        : summaryStats.lastTsunami
                          ? `peringatan terakhir ${fmtRelative(
                              summaryStats.lastTsunami.origin_time,
                              nowMs
                            )}`
                          : "\u00A0"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="card bento__chart" aria-labelledby="chart-heading">
                <div className="card__head">
                  <h2 id="chart-heading">Aktivitas 3 bulan terakhir</h2>
                  <span className="hint" id="chart-hint">
                    {weeklyChartData
                      ? `${fmtNumber(weeklyChartData.total)} gempa M4,5+ · rata-rata ${fmtNumber(
                          weeklyChartData.average
                        )} per minggu`
                      : "Gempa M4,5+ per minggu, katalog BMKG"}
                  </span>
                </div>
                <div className="chart" id="weekly-chart">
                  {weeklyChartData ? (
                    <>
                      <div className="chart__plot" aria-hidden="false">
                        <div className="chart__grid">
                          {[weeklyChartData.top, weeklyChartData.top / 2, 0].map((v) => (
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
                              <button
                                key={w.start}
                                type="button"
                                className={`chart__col${isPeak ? " is-peak" : ""}${
                                  w.partial ? " is-partial" : ""
                                }`}
                                aria-label={`${w.label}: ${w.count} gempa`}
                                style={{ "--h": pct } as React.CSSProperties}
                              >
                                {isPeak ? (
                                  <span className="chart__value mono">
                                    {fmtNumber(w.count)}
                                  </span>
                                ) : null}
                                <span className="chart__bar" />
                                <span className="chart__tip" role="tooltip">
                                  <strong>{fmtNumber(w.count)} gempa</strong>
                                  <span>{w.label}</span>
                                  {w.partial ? <em>Data sebagian minggu</em> : null}
                                  {w.max ? (
                                    <span>
                                      Terbesar M{fmtMag(w.max.magnitude)} · {w.max.region}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="chart__x">
                                  {i % 2 === 0 || weeklyChartData.weeks.length < 8
                                    ? w.shortLabel
                                    : ""}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {weeklyChartData.weeks.some((w) => w.partial) ? (
                        <p className="chart__note">
                          Batang pucat: minggu yang datanya belum lengkap.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <div
                      className="skeleton skeleton--block"
                      style={{ minHeight: 180 }}
                    />
                  )}
                </div>
              </section>

              <section className="card bento__recent" aria-labelledby="recent-heading">
                <div className="card__head">
                  <h2 id="recent-heading">Deteksi terbaru</h2>
                  <button
                    type="button"
                    className="link-arrow"
                    onClick={() => navigateTab("realtime")}
                  >
                    Semua deteksi <RoneIcon name="arrow-right" />
                  </button>
                </div>
                <ul className="event-list" id="recent-list" aria-live="polite">
                  {realtime.slice(0, 8).map((ev) => (
                    <EventListItem
                      key={ev.event_id}
                      event={ev}
                      flag={ev.magnitude >= 5 ? "M5+" : ""}
                      nowMs={nowMs}
                      onClick={() => {
                        setHomeSelected(ev);
                        setDetailTarget({ kind: "realtime", data: ev });
                      }}
                    />
                  ))}
                </ul>
              </section>

              <nav className="card bento__links" aria-labelledby="links-heading">
                <div className="card__head">
                  <h2 id="links-heading">Jelajahi</h2>
                </div>
                <div className="links">
                  <button
                    type="button"
                    className="tile"
                    onClick={() => navigateTab("tsunami")}
                  >
                    <span className="tile__icon">
                      <RoneIcon name="wave" />
                    </span>
                    <span>
                      <strong>Peringatan tsunami</strong>
                      <span>Kronologi buletin &amp; zona</span>
                    </span>
                    <span className="tile__arrow">
                      <RoneIcon name="arrow-right" />
                    </span>
                  </button>
                  <button
                    type="button"
                    className="tile"
                    onClick={() => navigateTab("significant")}
                  >
                    <span className="tile__icon">
                      <RoneIcon name="pulse" />
                    </span>
                    <span>
                      <strong>Gempa M5+</strong>
                      <span>Dengan analisis BMKG</span>
                    </span>
                    <span className="tile__arrow">
                      <RoneIcon name="arrow-right" />
                    </span>
                  </button>
                  <button
                    type="button"
                    className="tile"
                    onClick={() => navigateTab("map")}
                  >
                    <span className="tile__icon">
                      <RoneIcon name="layers" />
                    </span>
                    <span>
                      <strong>Peta seismisitas</strong>
                      <span>Sesar, stasiun, katalog</span>
                    </span>
                    <span className="tile__arrow">
                      <RoneIcon name="arrow-right" />
                    </span>
                  </button>
                  <button
                    type="button"
                    className="tile"
                    onClick={() => navigateTab("about")}
                  >
                    <span className="tile__icon">
                      <RoneIcon name="code" />
                    </span>
                    <span>
                      <strong>Data &amp; API</strong>
                      <span>Skala, zona waktu, JSON</span>
                    </span>
                    <span className="tile__arrow">
                      <RoneIcon name="arrow-right" />
                    </span>
                  </button>
                </div>
              </nav>
            </div>
          </div>
        )}

        {/* ==================== 2. REALTIME ==================== */}
        {activeTab === "realtime" && (
          <div className="container container--wide page">
            <header className="page-head">
              <h1>Deteksi gempa real-time</h1>
              <p>
                Deteksi otomatis gempa bumi dari jaringan sensor BMKG: magnitudo,
                kedalaman, lokasi, dan riwayat pemutakhiran tiap kejadian.
              </p>
              <div className="page-head__meta" id="page-meta">
                <span className="chip">{fmtNumber(realtime.length)} deteksi</span>
                {realtime.at(-1) ? (
                  <span className="chip">
                    sejak {fmtDateTime(realtime.at(-1)!.origin_time)}
                  </span>
                ) : null}
              </div>
            </header>

            <div className="toolbar" role="group" aria-label="Saring data">
              <div
                className="segmented"
                id="mag-filter"
                role="group"
                aria-label="Magnitudo minimum"
              >
                {[
                  { min: 0, label: "Semua" },
                  { min: 3, label: "M3+" },
                  { min: 4, label: "M4+" },
                  { min: 5, label: "M5+" },
                ].map((b) => (
                  <button
                    key={b.min}
                    type="button"
                    aria-pressed={rtMinMag === b.min ? "true" : "false"}
                    onClick={() => setRtMinMag(b.min)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              <label className="field field--search">
                <RoneIcon name="search" />
                <span className="visually-hidden">Cari wilayah</span>
                <input
                  type="search"
                  placeholder="Cari wilayah…"
                  autoComplete="off"
                  value={rtQuery}
                  onChange={(e) => setRtQuery(e.target.value)}
                />
              </label>

              <span className="toolbar__spacer" />
              <span className="toolbar__count" aria-live="polite">
                {fmtNumber(filteredRealtime.length)} dari {fmtNumber(realtime.length)}{" "}
                kejadian
              </span>
            </div>

            <div className="split split--list">
              <div>
                <div className="table-wrap table-wrap--scroll">
                  <table className="table" id="table">
                    <caption className="visually-hidden">
                      Deteksi gempa real-time, terbaru di atas
                    </caption>
                    <thead>
                      <tr>
                        {(
                          [
                            { key: "magnitude", label: "Mag", num: true },
                            { key: "origin_time", label: "Waktu (WIB)", num: false },
                            { key: "region", label: "Wilayah", num: false },
                            { key: "depth_km", label: "Kedalaman", num: true },
                          ] as const
                        ).map((col) => (
                          <th
                            key={col.key}
                            scope="col"
                            className={col.num ? "num" : undefined}
                            aria-sort={
                              rtSort.key === col.key
                                ? rtSort.dir === "asc"
                                  ? "ascending"
                                  : "descending"
                                : undefined
                            }
                          >
                            <button
                              className="sort-btn"
                              type="button"
                              onClick={() =>
                                setRtSort((prev) => ({
                                  key: col.key,
                                  dir:
                                    prev.key === col.key && prev.dir === "desc"
                                      ? "asc"
                                      : "desc",
                                }))
                              }
                            >
                              {col.label}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody id="rows">
                      {filteredRealtime.length ? (
                        filteredRealtime.map((ev) => (
                          <tr
                            key={ev.event_id}
                            data-id={ev.event_id}
                            aria-selected={
                              rtSelected?.event_id === ev.event_id ? "true" : "false"
                            }
                            tabIndex={0}
                            onClick={() => {
                              setRtSelected(ev);
                              setDetailTarget({ kind: "realtime", data: ev });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setRtSelected(ev);
                                setDetailTarget({ kind: "realtime", data: ev });
                              }
                            }}
                          >
                            <td className="num">
                              <MagBadge magnitude={ev.magnitude} size="sm" />
                            </td>
                            <td className="nowrap">
                              <span className="mono">
                                {fmtDateTime(ev.origin_time).replace(" WIB", "")}
                              </span>
                              <div className="xsmall muted">
                                <time dateTime={ev.origin_time}>
                                  {fmtRelative(ev.origin_time, nowMs)}
                                </time>
                              </div>
                            </td>
                            <td className="wrap">{ev.region}</td>
                            <td className="num mono">{fmtDepth(ev.depth_km)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4}>
                            <div className="empty">
                              <strong>Tidak ada kejadian</strong>
                              <span>Ubah filter atau kata kunci pencarian.</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="xsmall muted mt-4">
                  Deteksi otomatis, belum ditinjau analis: magnitudo dan lokasi dapat
                  berubah. Pilih baris untuk melihat riwayat pemutakhiran.
                </p>
              </div>

              <div className="split__sticky">
                <section className="card map-card" aria-label="Peta deteksi">
                  <RoneLeafletMap
                    id="realtime-map"
                    className="map map--tall"
                    ariaLabel="Peta deteksi realtime"
                    events={filteredRealtime}
                    latestEvent={filteredRealtime[0] || null}
                    selectedEvent={rtSelected}
                    centerOnLatest
                    latestZoom={5}
                    isDark={isDark}
                    onSelectEvent={(ev) => {
                      const found = realtime.find((r) => r.event_id === ev.event_id);
                      if (found) {
                        setRtSelected(found);
                        setDetailTarget({ kind: "realtime", data: found });
                      }
                    }}
                  />
                  <MagLegend />
                </section>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 3 & 4. DIRASAKAN (/felt/) & M5+ (/m5/) ==================== */}
        {(activeTab === "felt" || activeTab === "significant") && (
          <div className="container page">
            <header className="page-head">
              <h1>
                {activeTab === "felt"
                  ? "Gempa dirasakan"
                  : "Gempa magnitudo 5 ke atas"}
              </h1>
              <p>
                {activeTab === "felt"
                  ? "30 gempa bumi terakhir yang dirasakan masyarakat Indonesia, lengkap dengan skala intensitas MMI dan peta guncangan."
                  : "30 gempa bumi terakhir bermagnitudo 5,0 atau lebih di wilayah Indonesia, dengan analisis dan narasi BMKG."}
              </p>
              <div className="page-head__meta">
                <span className="chip">
                  {fmtNumber(currentAlertsSource.length)} kejadian terakhir
                </span>
                {currentAlertsSource.at(-1) ? (
                  <span className="chip">
                    sejak {fmtDateTime(currentAlertsSource.at(-1)!.origin_time)}
                  </span>
                ) : null}
              </div>
            </header>

            <div className="toolbar">
              <label className="field field--search">
                <RoneIcon name="search" />
                <span className="visually-hidden">Cari wilayah</span>
                <input
                  type="search"
                  placeholder={
                    activeTab === "felt"
                      ? "Cari wilayah atau kota yang merasakan…"
                      : "Cari wilayah…"
                  }
                  autoComplete="off"
                  value={alertsQuery}
                  onChange={(e) => setAlertsQuery(e.target.value)}
                />
              </label>
              <span className="toolbar__spacer" />
              <span className="toolbar__count" aria-live="polite">
                {fmtNumber(filteredAlerts.length)} kejadian
              </span>
            </div>

            <div className="split split--list">
              <section className="card" aria-label="Daftar kejadian">
                <ul className="event-list" aria-live="polite">
                  {filteredAlerts.length ? (
                    filteredAlerts.map((eq) => (
                      <EventListItem
                        key={eq.event_id}
                        event={eq}
                        note={
                          activeTab === "felt"
                            ? eq.felt
                              ? `Dirasakan ${eq.felt}`
                              : ""
                            : eq.potential
                        }
                        flag={eq.tsunami_potential ? "Tsunami" : ""}
                        current={alertsSelected?.event_id === eq.event_id}
                        nowMs={nowMs}
                        onClick={() => {
                          setAlertsSelected(eq);
                          setDetailTarget({ kind: "felt", data: eq });
                        }}
                      />
                    ))
                  ) : (
                    <li>
                      <div className="empty">
                        <strong>Tidak ada kejadian</strong>
                        <span>Coba kata kunci lain.</span>
                      </div>
                    </li>
                  )}
                </ul>
              </section>

              <div className="split__sticky">
                <section className="card map-card" aria-label="Peta kejadian">
                  <RoneLeafletMap
                    id={`alerts-map-${activeTab}`}
                    className="map map--tall"
                    ariaLabel="Peta kejadian"
                    events={filteredAlerts}
                    latestEvent={filteredAlerts[0] || null}
                    selectedEvent={alertsSelected}
                    fitArchipelago
                    isDark={isDark}
                    onSelectEvent={(ev) => {
                      const found = currentAlertsSource.find(
                        (item) => item.event_id === ev.event_id
                      );
                      if (found) {
                        setAlertsSelected(found);
                        setDetailTarget({ kind: "felt", data: found });
                      }
                    }}
                  />
                  <MagLegend />
                </section>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 5. TSUNAMI (/tsunami/) ==================== */}
        {activeTab === "tsunami" && (
          <div className="container page">
            <header className="page-head">
              <h1>Peringatan dini tsunami</h1>
              <p>
                Riwayat peringatan dini tsunami BMKG: status per wilayah, pengamatan tinggi
                gelombang, dan kronologi buletin.
              </p>
              <div className="page-head__meta">
                <span className="chip">
                  {fmtNumber(tsunamiList.length)} kejadian terakhir
                </span>
                <span className="chip">InaTEWS BMKG</span>
              </div>
            </header>

            <section className="card" aria-labelledby="levels-heading">
              <h2 className="visually-hidden" id="levels-heading">
                Arti status peringatan
              </h2>
              <ul className="level-legend">
                <li>
                  <span className="pill pill--awas">AWAS</span>
                  <span>Perkiraan tinggi &gt; 3 m — evakuasi menyeluruh</span>
                </li>
                <li>
                  <span className="pill pill--siaga">SIAGA</span>
                  <span>0,5–3 m — evakuasi</span>
                </li>
                <li>
                  <span className="pill pill--waspada">WASPADA</span>
                  <span>&lt; 0,5 m — jauhi pantai dan tepi sungai</span>
                </li>
              </ul>
            </section>

            <div className="mt-6" id="events" aria-live="polite">
              {tsunamiList.map((ev, index) => {
                const zoneBulletin: RoneTsunamiBulletin | undefined =
                  ev.bulletins.find((b) => b.zones?.length) || ev.bulletins[0];
                const obsBulletin: RoneTsunamiBulletin | undefined = ev.bulletins.find(
                  (b) => b.observations?.length
                );
                const zones: RoneTsunamiZone[] = zoneBulletin?.zones || [];
                const mediaSource =
                  ev.bulletins.find((b) => b.media?.warning_zones)?.media ||
                  ev.bulletins[0]?.media ||
                  {};

                const counts: Record<string, number> = {
                  AWAS: 0,
                  SIAGA: 0,
                  WASPADA: 0,
                };
                zones.forEach((z) => {
                  if (counts[z.level] != null) counts[z.level] += 1;
                });
                const maxZoneCount = Math.max(1, ...Object.values(counts));

                return (
                  <article
                    key={ev.id}
                    className="card tsunami-event"
                    aria-labelledby={`ts-${index}`}
                  >
                    <header className="tsunami-event__head">
                      <div className="tsunami-event__title-row">
                        <MagBadge magnitude={ev.magnitude} size="lg" />
                        <div>
                          <h2 className="tsunami-event__title" id={`ts-${index}`}>
                            {ev.region}
                          </h2>
                          <p className="small muted">{fmtLong(ev.origin_time)}</p>
                          <div className="row mt-3">
                            <span
                              className={`pill${ev.ended ? "" : " pill--signal"}`}
                            >
                              {ev.ended ? "Peringatan berakhir" : "Peringatan aktif"}
                            </span>
                            {ev.max_level ? (
                              <span
                                className={`pill pill--${ev.max_level.toLowerCase()}`}
                              >
                                {ev.max_level}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <FactsList
                        extraClass="facts--4"
                        rows={[
                          [
                            "Tinggi teramati maks.",
                            ev.max_wave_height_m != null
                              ? `${fmtDecimal(ev.max_wave_height_m)} m`
                              : "–",
                          ],
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
                          {ev.bulletins.map((b) => (
                            <li key={b.event_id + b.code}>
                              <span className="timeline__code">{b.code}</span>
                              <span className="timeline__time">
                                {fmtTime(b.issued_at)}
                              </span>
                              <p className="timeline__text">
                                <strong>{bulletinLabel(b.code)}</strong>
                                {bulletinLabel(b.code) ? " — " : ""}M
                                {fmtMag(b.magnitude)}
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
                                .filter((lv) => counts[lv] > 0)
                                .map((lv) => (
                                  <div key={lv} className="level-bar">
                                    <span
                                      className={`pill pill--${lv.toLowerCase()}`}
                                    >
                                      {lv}
                                    </span>
                                    <span className="level-bar__track">
                                      <span
                                        className="level-bar__fill"
                                        style={
                                          {
                                            width: `${
                                              (counts[lv] / maxZoneCount) * 100
                                            }%`,
                                            "--c": `var(--lv-${lv.toLowerCase()})`,
                                          } as React.CSSProperties
                                        }
                                      />
                                    </span>
                                    <span className="num mono">
                                      {fmtNumber(counts[lv])}
                                    </span>
                                  </div>
                                ))}
                            </div>

                            <details className="disclosure">
                              <summary>Daftar wilayah</summary>
                              <div className="table-wrap">
                                <table className="table">
                                  <thead>
                                    <tr>
                                      <th scope="col">Status</th>
                                      <th scope="col">Provinsi</th>
                                      <th scope="col">Wilayah</th>
                                      <th scope="col">Perkiraan tiba</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {zones.map((z, zIdx) => (
                                      <tr key={`${z.district}-${zIdx}`}>
                                        <td>
                                          <span
                                            className={`pill pill--${z.level.toLowerCase()}`}
                                          >
                                            {z.level}
                                          </span>
                                        </td>
                                        <td>{z.province}</td>
                                        <td>{z.district}</td>
                                        <td className="mono nowrap">
                                          {z.estimated_arrival
                                            ? fmtDateTime(z.estimated_arrival)
                                            : "–"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          </>
                        ) : (
                          <p className="small muted">
                            Tidak ada zona peringatan pada buletin ini.
                          </p>
                        )}

                        {obsBulletin ? (
                          <details className="disclosure" open={index === 0}>
                            <summary>
                              Pengamatan tsunami ·{" "}
                              {fmtNumber(obsBulletin.observations.length)} lokasi
                            </summary>
                            <div className="table-wrap">
                              <table className="table">
                                <thead>
                                  <tr>
                                    <th scope="col">Stasiun</th>
                                    <th scope="col">Lokasi</th>
                                    <th scope="col">Waktu</th>
                                    <th scope="col" className="num">
                                      Tinggi
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
                                        {fmtDecimal(o.height_m)} m
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
                            onOpenLightbox={(items, idx) =>
                              setLightboxState({ items, index: idx })
                            }
                          />
                        </div>

                        {ev.instructions?.length ? (
                          <details className="disclosure">
                            <summary>Arahan BMKG</summary>
                            <ul
                              className="prose small"
                              style={{ padding: "0 var(--s-2) 0 var(--s-6)" }}
                            >
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

        {/* ==================== 6. MERUSAK (/damage/) ==================== */}
        {activeTab === "damaging" && (
          <div className="container page">
            <header className="page-head">
              <h1>Katalog gempa merusak</h1>
              <p>
                Katalog historis gempa bumi merusak di Indonesia sejak 1920-an: korban,
                kerusakan, dan tsunami yang ditimbulkan.
              </p>
              <div className="page-head__meta">
                <span className="chip">Sejak 1920-an</span>
                <span className="chip">Sumber: katalog BMKG</span>
              </div>
            </header>

            <div className="stats" id="summary">
              {damagingList.length ? (
                (() => {
                  const years = damagingList.map((e) =>
                    new Date(e.origin_time).getUTCFullYear()
                  );
                  const biggest = damagingList.reduce(
                    (a, b) => (b.magnitude > a.magnitude ? b : a),
                    damagingList[0]
                  );
                  const withTsunami = damagingList.filter((e) => e.tsunami).length;
                  return (
                    <>
                      <div className="stat">
                        <p className="stat__label">Kejadian</p>
                        <p className="stat__value">{fmtNumber(damagingList.length)}</p>
                        <p className="stat__note">gempa merusak tercatat</p>
                      </div>
                      <div className="stat">
                        <p className="stat__label">Memicu tsunami</p>
                        <p className="stat__value">{fmtNumber(withTsunami)}</p>
                        <p className="stat__note">
                          {Math.round((withTsunami / damagingList.length) * 100)}% dari
                          seluruh kejadian
                        </p>
                      </div>
                      <div className="stat">
                        <p className="stat__label">Magnitudo terbesar</p>
                        <p className="stat__value">{fmtMag(biggest.magnitude)}</p>
                        <p className="stat__note">
                          {biggest.province},{" "}
                          {new Date(biggest.origin_time).getUTCFullYear()}
                        </p>
                      </div>
                      <div className="stat">
                        <p className="stat__label">Rentang tahun</p>
                        <p className="stat__value">
                          {Math.min(...years)}–{Math.max(...years)}
                        </p>
                        <p className="stat__note">berdasarkan waktu UTC</p>
                      </div>
                    </>
                  );
                })()
              ) : (
                ["Kejadian", "Memicu tsunami", "Magnitudo terbesar", "Rentang tahun"].map(
                  (label) => (
                    <div key={label} className="stat">
                      <p className="stat__label">{label}</p>
                      <p className="stat__value">
                        <span
                          className="skeleton skeleton--line"
                          style={{ width: "3ch" }}
                        />
                      </p>
                      <p className="stat__note">&nbsp;</p>
                    </div>
                  )
                )
              )}
            </div>

            <section className="card map-card mt-6" aria-label="Peta gempa merusak">
              <RoneLeafletMap
                id="damage-map"
                className="map"
                ariaLabel="Peta gempa merusak"
                events={filteredDamaging}
                latestEvent={filteredDamaging[0] || null}
                selectedEvent={dmgSelected}
                markerScale={0.6}
                fitArchipelago
                scrollWheelZoom={false}
                isDark={isDark}
                onSelectEvent={(ev) => {
                  const found = damagingList.find((d) => d.event_id === ev.event_id);
                  if (found) {
                    setDmgSelected(found);
                    setDetailTarget({ kind: "damaging", data: found });
                  }
                }}
              />
              <MagLegend />
            </section>

            <div className="toolbar mt-6">
              <label className="field field--search">
                <RoneIcon name="search" />
                <span className="visually-hidden">Cari provinsi atau lokasi</span>
                <input
                  type="search"
                  placeholder="Cari provinsi, lokasi, dampak…"
                  autoComplete="off"
                  value={dmgQuery}
                  onChange={(e) => {
                    setDmgQuery(e.target.value);
                    setDmgPage(0);
                  }}
                />
              </label>

              <label className="field field--select">
                <span className="visually-hidden">Periode</span>
                <select
                  value={dmgPeriod}
                  onChange={(e) => {
                    setDmgPeriod(e.target.value);
                    setDmgPage(0);
                  }}
                >
                  <option value="">Semua periode</option>
                  {damagingDecades.map((d) => (
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
                  onChange={(e) => {
                    setDmgOnlyTsunami(e.target.checked);
                    setDmgPage(0);
                  }}
                />{" "}
                Memicu tsunami
              </label>

              <span className="toolbar__spacer" />
              <span className="toolbar__count" aria-live="polite">
                {fmtNumber(filteredDamaging.length)} kejadian
              </span>
            </div>

            <div className="table-wrap">
              <table className="table">
                <caption className="visually-hidden">Katalog gempa merusak</caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="num"
                      aria-sort={
                        dmgSort.key === "magnitude"
                          ? dmgSort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      <button
                        className="sort-btn"
                        type="button"
                        onClick={() =>
                          setDmgSort((p) => ({
                            key: "magnitude",
                            dir: p.key === "magnitude" && p.dir === "desc" ? "asc" : "desc",
                          }))
                        }
                      >
                        Mag
                      </button>
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        dmgSort.key === "origin_time"
                          ? dmgSort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      <button
                        className="sort-btn"
                        type="button"
                        onClick={() =>
                          setDmgSort((p) => ({
                            key: "origin_time",
                            dir:
                              p.key === "origin_time" && p.dir === "desc" ? "asc" : "desc",
                          }))
                        }
                      >
                        Tanggal
                      </button>
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        dmgSort.key === "province"
                          ? dmgSort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      <button
                        className="sort-btn"
                        type="button"
                        onClick={() =>
                          setDmgSort((p) => ({
                            key: "province",
                            dir: p.key === "province" && p.dir === "desc" ? "asc" : "desc",
                          }))
                        }
                      >
                        Lokasi
                      </button>
                    </th>
                    <th scope="col">Dampak</th>
                    <th
                      scope="col"
                      className="num"
                      aria-sort={
                        dmgSort.key === "depth_km"
                          ? dmgSort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      <button
                        className="sort-btn"
                        type="button"
                        onClick={() =>
                          setDmgSort((p) => ({
                            key: "depth_km",
                            dir: p.key === "depth_km" && p.dir === "desc" ? "asc" : "desc",
                          }))
                        }
                      >
                        Kedalaman
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDamaging
                    .slice(dmgPage * 25, (dmgPage + 1) * 25)
                    .map((ev) => (
                      <tr
                        key={ev.event_id}
                        data-id={ev.event_id}
                        tabIndex={0}
                        onClick={() => {
                          setDmgSelected(ev);
                          setDetailTarget({ kind: "damaging", data: ev });
                        }}
                      >
                        <td className="num">
                          <MagBadge magnitude={ev.magnitude} size="sm" />
                        </td>
                        <td className="nowrap mono">{fmtUtcDate(ev.origin_time)}</td>
                        <td>
                          <strong>{ev.province}</strong>
                          <div className="xsmall muted">{ev.epicenter}</div>
                          {ev.tsunami ? (
                            <div className="mt-2">
                              <span className="pill pill--signal">Tsunami</span>
                            </div>
                          ) : null}
                        </td>
                        <td className="wrap small">
                          {ev.impact ? (
                            ev.impact.length > 140
                              ? `${ev.impact.slice(0, 140)}…`
                              : ev.impact
                          ) : (
                            <span className="muted">–</span>
                          )}
                        </td>
                        <td className="num mono">{fmtDepth(ev.depth_km)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {filteredDamaging.length > 25 ? (
              <div className="pager">
                <span>
                  {fmtNumber(dmgPage * 25 + 1)}–
                  {fmtNumber(Math.min(filteredDamaging.length, (dmgPage + 1) * 25))}{" "}
                  dari {fmtNumber(filteredDamaging.length)}
                </span>
                <span className="pager__btns">
                  <button
                    className="btn btn--sm"
                    type="button"
                    disabled={dmgPage === 0}
                    onClick={() => setDmgPage((p) => Math.max(0, p - 1))}
                  >
                    <RoneIcon name="arrow-left" /> Sebelumnya
                  </button>
                  <button
                    className="btn btn--sm"
                    type="button"
                    disabled={(dmgPage + 1) * 25 >= filteredDamaging.length}
                    onClick={() => setDmgPage((p) => p + 1)}
                  >
                    Berikutnya <RoneIcon name="arrow-right" />
                  </button>
                </span>
              </div>
            ) : null}
          </div>
        )}

        {/* ==================== 7. PETA (/map/) ==================== */}
        {activeTab === "map" && (
          <>
            <h1 className="visually-hidden">Peta seismisitas</h1>
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
                stationsIndonesia: mapLayersOn.stationsIndonesia
                  ? stationsIndonesia
                  : undefined,
                stationsGlobal: mapLayersOn.stationsGlobal ? stationsGlobal : undefined,
              }}
              onSelectEvent={(ev) => {
                const found = realtime.find((r) => r.event_id === ev.event_id);
                if (found) setDetailTarget({ kind: "realtime", data: found });
              }}
            >
              <details className="map-panel" id="layers" open>
                <summary>
                  <RoneIcon name="layers" />
                  <span>Lapisan</span>
                  <span
                    className="map-panel__active"
                    id="active-count"
                    aria-label="lapisan aktif"
                  >
                    {activeMapLayerCount}
                  </span>
                </summary>
                <div className="map-panel__body">
                  <fieldset>
                    <legend>Gempa</legend>
                    <label className="check">
                      <span>Realtime</span>
                      <span className="count">{fmtNumber(realtime.length)}</span>
                      <input
                        type="checkbox"
                        checked={mapLayersOn.realtime}
                        onChange={(e) =>
                          setMapLayersOn((p) => ({ ...p, realtime: e.target.checked }))
                        }
                      />
                    </label>
                    <label className="check">
                      <span>3 bulan (M4,5+)</span>
                      <span className="count">{fmtNumber(archive3m.length)}</span>
                      <input
                        type="checkbox"
                        checked={mapLayersOn.archive3m}
                        onChange={(e) =>
                          setMapLayersOn((p) => ({ ...p, archive3m: e.target.checked }))
                        }
                      />
                    </label>
                    <label className="check">
                      <span>5 tahun (M5+)</span>
                      <span className="count">
                        {archive5y.length ? fmtNumber(archive5y.length) : ""}
                      </span>
                      <input
                        type="checkbox"
                        checked={mapLayersOn.archive5y}
                        onChange={(e) =>
                          setMapLayersOn((p) => ({ ...p, archive5y: e.target.checked }))
                        }
                      />
                    </label>
                  </fieldset>

                  <fieldset>
                    <legend>Referensi</legend>
                    <label className="check">
                      <span>Sesar Indonesia</span>
                      <span className="count">
                        {faultsIndonesia?.features?.length
                          ? fmtNumber(faultsIndonesia.features.length)
                          : ""}
                      </span>
                      <input
                        type="checkbox"
                        checked={mapLayersOn.faultsIndonesia}
                        onChange={(e) =>
                          setMapLayersOn((p) => ({
                            ...p,
                            faultsIndonesia: e.target.checked,
                          }))
                        }
                      />
                    </label>
                    <label className="check">
                      <span>Sesar &amp; lempeng global</span>
                      <span className="count">
                        {faultsGlobal?.features?.length
                          ? fmtNumber(faultsGlobal.features.length)
                          : ""}
                      </span>
                      <input
                        type="checkbox"
                        checked={mapLayersOn.faultsGlobal}
                        onChange={(e) =>
                          setMapLayersOn((p) => ({
                            ...p,
                            faultsGlobal: e.target.checked,
                          }))
                        }
                      />
                    </label>
                    <label className="check">
                      <span>Stasiun BMKG</span>
                      <span className="count">
                        {stationsIndonesia.length
                          ? fmtNumber(stationsIndonesia.length)
                          : ""}
                      </span>
                      <input
                        type="checkbox"
                        checked={mapLayersOn.stationsIndonesia}
                        onChange={(e) =>
                          setMapLayersOn((p) => ({
                            ...p,
                            stationsIndonesia: e.target.checked,
                          }))
                        }
                      />
                    </label>
                    <label className="check">
                      <span>Stasiun global</span>
                      <span className="count">
                        {stationsGlobal.length ? fmtNumber(stationsGlobal.length) : ""}
                      </span>
                      <input
                        type="checkbox"
                        checked={mapLayersOn.stationsGlobal}
                        onChange={(e) =>
                          setMapLayersOn((p) => ({
                            ...p,
                            stationsGlobal: e.target.checked,
                          }))
                        }
                      />
                    </label>
                  </fieldset>

                  <div className="legend" style={{ margin: 0 }}>
                    <span className="legend__item">
                      <span
                        className="legend__swatch"
                        style={{ "--c": "var(--m-3)" } as React.CSSProperties}
                      />
                      3
                    </span>
                    <span className="legend__item">
                      <span
                        className="legend__swatch"
                        style={{ "--c": "var(--m-4)" } as React.CSSProperties}
                      />
                      4
                    </span>
                    <span className="legend__item">
                      <span
                        className="legend__swatch"
                        style={{ "--c": "var(--m-5)" } as React.CSSProperties}
                      />
                      5
                    </span>
                    <span className="legend__item">
                      <span
                        className="legend__swatch"
                        style={{ "--c": "var(--m-6)" } as React.CSSProperties}
                      />
                      6
                    </span>
                    <span className="legend__item">
                      <span
                        className="legend__swatch"
                        style={{ "--c": "var(--m-7)" } as React.CSSProperties}
                      />
                      7+
                    </span>
                    <span className="legend__item">
                      <span
                        className="legend__line"
                        style={{ "--c": "var(--accent)" } as React.CSSProperties}
                      />
                      Sesar
                    </span>
                    <span className="legend__item">
                      <span
                        className="legend__swatch"
                        style={{ "--c": "var(--ink-2)" } as React.CSSProperties}
                      />
                      Stasiun
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
          </>
        )}

        {/* ==================== 8. TENTANG (/about/) ==================== */}
        {activeTab === "about" && (
          <div className="container page">
            <header className="page-head">
              <h1>Tentang data &amp; API</h1>
              <p>
                Cara membaca data gempa BMKG: magnitudo, skala MMI, zona waktu, dan API
                JSON terbuka yang dipakai situs ini.
              </p>
            </header>

            <div className="split split--list">
              <article className="card prose">
                <h2>Sumber data</h2>
                <p>
                  Semua data berasal dari <strong>BMKG</strong> (Badan Meteorologi,
                  Klimatologi, dan Geofisika) melalui sistem InaTEWS. Situs ini tidak
                  resmi: kami hanya menata ulang data agar mudah dibaca. Untuk keadaan
                  darurat, ikuti arahan BMKG, BNPB, dan BPBD setempat.
                </p>

                <h2>Jenis data</h2>
                <ul>
                  <li>
                    <strong>Realtime</strong> — deteksi otomatis jaringan seismik, muncul
                    beberapa menit setelah gempa. Belum ditinjau analis, sehingga
                    magnitudo dan lokasi bisa berubah. Waktu asli dalam UTC.
                  </li>
                  <li>
                    <strong>Dirasakan</strong> dan <strong>M5+</strong> — info gempa yang
                    sudah diumumkan BMKG, lengkap dengan peta guncangan (shakemap) dan
                    laporan intensitas. Waktu dalam WIB.
                  </li>
                  <li>
                    <strong>Tsunami</strong> — buletin peringatan dini: PD-1 (peringatan
                    awal), PD-2 (pemutakhiran), PD-3.x (pengamatan tsunami), dan PD-4
                    (peringatan berakhir).
                  </li>
                  <li>
                    <strong>Merusak</strong> — katalog historis gempa yang menimbulkan
                    korban atau kerusakan.
                  </li>
                </ul>

                <h2>Zona waktu</h2>
                <p>
                  Seluruh waktu di situs ini ditampilkan dalam{" "}
                  <strong>WIB (UTC+7)</strong>. Untuk wilayah WITA tambahkan 1 jam, untuk
                  WIT tambahkan 2 jam.
                </p>

                <h2>Magnitudo</h2>
                <p>
                  Magnitudo mengukur energi yang dilepaskan di sumber gempa. Setiap
                  kenaikan 1 angka berarti energi sekitar 32 kali lebih besar. Warna yang
                  sama dipakai di seluruh situs:
                </p>
                <table className="table scale-table">
                  <tbody>
                    <tr>
                      <td>
                        <MagBadge magnitude={2.5} size="sm" labelOverride="<3" />
                      </td>
                      <td>Mikro — umumnya tidak terasa.</td>
                    </tr>
                    <tr>
                      <td>
                        <MagBadge magnitude={3.5} size="sm" labelOverride="3" />
                      </td>
                      <td>Minor — terasa di dekat pusat gempa.</td>
                    </tr>
                    <tr>
                      <td>
                        <MagBadge magnitude={4.5} size="sm" labelOverride="4" />
                      </td>
                      <td>Ringan — terasa luas, jarang merusak.</td>
                    </tr>
                    <tr>
                      <td>
                        <MagBadge magnitude={5.5} size="sm" labelOverride="5" />
                      </td>
                      <td>Sedang — dapat merusak bangunan lemah.</td>
                    </tr>
                    <tr>
                      <td>
                        <MagBadge magnitude={6.5} size="sm" labelOverride="6" />
                      </td>
                      <td>Kuat — berpotensi merusak di area berpenduduk.</td>
                    </tr>
                    <tr>
                      <td>
                        <MagBadge magnitude={7.5} size="sm" labelOverride="7+" />
                      </td>
                      <td>Besar — kerusakan luas; di laut dapat memicu tsunami.</td>
                    </tr>
                  </tbody>
                </table>

                <h2>Intensitas (MMI)</h2>
                <p>
                  Skala Modified Mercalli Intensity (angka Romawi) menggambarkan guncangan
                  yang dirasakan di suatu tempat, bukan kekuatan gempa. Satu gempa punya
                  banyak nilai MMI, makin jauh makin kecil.
                </p>
                <table className="table">
                  <tbody>
                    <tr>
                      <td className="mono">I–II</td>
                      <td>Dirasakan sedikit orang, benda ringan bergoyang.</td>
                    </tr>
                    <tr>
                      <td className="mono">III–IV</td>
                      <td>
                        Terasa di dalam rumah, seperti truk lewat; jendela berderik.
                      </td>
                    </tr>
                    <tr>
                      <td className="mono">V–VI</td>
                      <td>
                        Dirasakan hampir semua orang; barang jatuh, plester retak.
                      </td>
                    </tr>
                    <tr>
                      <td className="mono">VII–VIII</td>
                      <td>Kerusakan ringan hingga sedang pada bangunan biasa.</td>
                    </tr>
                    <tr>
                      <td className="mono">IX+</td>
                      <td>Kerusakan berat; bangunan dapat runtuh.</td>
                    </tr>
                  </tbody>
                </table>
              </article>

              <aside className="split__sticky">
                <section className="card" aria-labelledby="api-heading">
                  <p className="hero__kicker">API JSON terbuka</p>
                  <h2
                    className="mt-2"
                    id="api-heading"
                    style={{ fontSize: "var(--fs-lg)" }}
                  >
                    Pakai data yang sama di aplikasimu
                  </h2>
                  <p className="small muted mt-2">
                    Respons dinormalisasi: kunci berbahasa Inggris, angka bertipe
                    numerik, koordinat desimal bertanda, dan waktu ISO 8601 dengan zona.
                  </p>
                  <div className="endpoints mt-5">
                    {[
                      ["/api/v1/earthquakes/latest", "Gempa dirasakan terakhir"],
                      [
                        "/api/v1/earthquakes/realtime",
                        "Deteksi realtime (?min_magnitude, ?limit)",
                      ],
                      [
                        "/api/v1/earthquakes/realtime/{id}/history",
                        "Riwayat pemutakhiran",
                      ],
                      ["/api/v1/earthquakes/felt", "30 gempa dirasakan"],
                      ["/api/v1/earthquakes/significant", "30 gempa M5+"],
                      ["/api/v1/earthquakes/damaging", "Katalog gempa merusak (?year)"],
                      [
                        "/api/v1/earthquakes/archive/{3m|5y}",
                        "Katalog 3 bulan / 5 tahun",
                      ],
                      ["/api/v1/earthquakes/{id}/narrative", "Narasi BMKG"],
                      ["/api/v1/tsunami", "Peringatan tsunami per kejadian"],
                      ["/api/v1/stations/{indonesia|global}", "Stasiun seismik"],
                      ["/api/v1/faults/{indonesia|global}", "Jalur sesar (GeoJSON)"],
                    ].map(([path, desc]) => (
                      <div key={path} className="endpoint">
                        <code>
                          <span className="method">GET</span>
                          {path}
                        </code>
                        <span>{desc}</span>
                      </div>
                    ))}
                  </div>
                  <div className="row mt-5">
                    <button
                      type="button"
                      className="btn btn--accent"
                      onClick={() => navigateTab("docs")}
                    >
                      Dokumentasi interaktif
                    </button>
                    <a
                      className="btn"
                      href="https://gempa.rone.dev/redoc"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      ReDoc
                    </a>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        )}

        {/* ==================== 9. /DOCS INTERACTIVE OPENAPI EXPLORER ==================== */}
        {activeTab === "docs" && (
          <div className="container page">
            <header className="page-head">
              <h1>Dokumentasi API Interaktif (v2.0.0 · OAS 3.1)</h1>
              <p>
                Uji langsung endpoint REST JSON <code>/api/v1/*</code> yang terintegrasi
                penuh dengan skema <code>gempa.rone.dev</code> dan data resmi BMKG.
              </p>
            </header>

            <div className="split split--list">
              <section className="card">
                <div className="card__head">
                  <h2>Daftar Endpoint</h2>
                  <button
                    type="button"
                    className="link-arrow"
                    onClick={() => navigateTab("about")}
                  >
                    <RoneIcon name="arrow-left" /> Kembali ke Tentang
                  </button>
                </div>
                <div className="endpoints">
                  {[
                    ["/api/v1/earthquakes/latest", "Gempa dirasakan terakhir"],
                    ["/api/v1/earthquakes/realtime?limit=25", "Deteksi realtime terbaru"],
                    ["/api/v1/earthquakes/felt", "30 gempa dirasakan (MMI)"],
                    ["/api/v1/earthquakes/significant", "30 gempa M5+ signifikan"],
                    ["/api/v1/earthquakes/damaging", "Katalog gempa merusak historis"],
                    ["/api/v1/earthquakes/archive/3m", "Katalog 3 bulan terakhir (M4,5+)"],
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
                        border: 0,
                        cursor: "pointer",
                        outline:
                          apiPlayPath === ep ? "2px solid var(--accent)" : undefined,
                      }}
                      onClick={() => setApiPlayPath(ep)}
                    >
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
                <section className="card">
                  <div className="card__head">
                    <h2>Respons JSON Langsung</h2>
                    <span className="mono xsmall muted">{apiPlayPath}</span>
                  </div>
                  <div
                    className="well mono xsmall"
                    style={{
                      maxHeight: "520px",
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {apiPlayLoading ? "Memuat respons JSON…" : apiPlayResponse}
                  </div>
                </section>
              </aside>
            </div>
          </div>
        )}
      </main>

      {activeTab !== "map" && (
        <footer className="site-footer">
          <div className="container">
            <div className="site-footer__inner">
              <div>
                <p>
                  Data gempa bumi dan tsunami: <strong>BMKG</strong> (Badan Meteorologi,
                  Klimatologi, dan Geofisika).
                </p>
                <p>
                  Situs tidak resmi. Untuk keadaan darurat, ikuti arahan BMKG, BNPB, dan
                  BPBD setempat.
                </p>
              </div>
              <nav aria-label="Tautan kaki">
                <button type="button" onClick={() => navigateTab("about")}>
                  Tentang data
                </button>
                <button type="button" onClick={() => navigateTab("docs")}>
                  Dokumentasi API
                </button>
                <a
                  href="https://github.com/ridwaanhall/gempa"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Kode sumber
                </a>
              </nav>
            </div>
          </div>
        </footer>
      )}

      <RoneDetailSheet
        target={detailTarget}
        realtimePool={realtime}
        nowMs={nowMs}
        onClose={() => setDetailTarget(null)}
        onPickRealtime={(ev) => {
          setHomeSelected(ev);
          setRtSelected(ev);
          setDetailTarget({ kind: "realtime", data: ev });
        }}
        onShare={handleShareEvent}
        onOpenLightbox={(items, index) => setLightboxState({ items, index })}
      />

      <RoneLightbox state={lightboxState} onClose={() => setLightboxState(null)} />

      <div
        className="toast"
        role="status"
        aria-live="polite"
        data-show={toastMsg ? "true" : "false"}
      >
        {toastMsg}
      </div>
    </>
  );
}
