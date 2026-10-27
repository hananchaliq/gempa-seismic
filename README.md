# SEISMA — Seismic Intelligence & Earthquake Visualization Platform

SEISMA adalah platform observasi geospasial dan eksplorasi informasi gempa bumi dengan fokus utama wilayah Indonesia serta konteks sabuk seismik global.

> **Penafian Penting:** SEISMA adalah platform visualisasi ilmiah independen yang menyajikan data dari sumber resmi (**BMKG** dan **USGS**). SEISMA **bukan** produk resmi BMKG, **bukan** sistem peringatan dini tsunami resmi, dan tidak menggantikan layanan atau arahan keselamatan otoritas kebencanaan.

---

## 1. Fitur Utama & Arsitektur Produk

- **Ringkasan Operasional & Gempa Terbaru (`/`)**: Menampilkan langsung parameter gempa terbaru dari BMKG (magnitudo, kedalaman hiposenter, koordinat lintang/bujur, zona waktu WIB & UTC, status potensi tsunami resmi, dan skala intensitas MMI).
- **Observatorium Globe Bumi 3D (`components/globe/SeismicGlobe3D.tsx`)**:
  - Dibangun dengan Three.js menggunakan model prosedural komposit 8 bagian (`THREE.Group`), tekstur batimetri & daratan Indonesia prosedural (`CanvasTexture` tanpa ketergantungan aset eksternal yang rawan gagal dimuat), pipa subduksi Sunda–Banda (`TubeGeometry`), cincin gimbal terkalibrasi, serta kolom kedalaman hiposenter proporsional.
  - Pencahayaan studio PBR (`ACESFilmicToneMapping`, `RoomEnvironment` + `PMREMGenerator`, kontras lampu kunci hangat & `HemisphereLight` dingin).
  - Deteksi otomatis Software WebGL (`isSoftwareGl`) dengan penjadwalan frame `afterDraw` (`fenceSync`) dan opsi beralih ke Proyeksi Geospasial 2D ringan kapan saja.
- **Storytelling Geodinamika Berbasis Scroll (`components/storytelling/SeismicScrollNarrative.tsx`)**:
  - 5 urutan narasi ilmiah menggunakan GSAP & ScrollTrigger (`gsap.context()` dengan cleanup aman untuk React Strict Mode) yang menyinkronkan orientasi kamera globe 3D dan penampang kedalaman hiposenter vs episenter.
  - Menghormati preferensi `prefers-reduced-motion` dan menyediakan tombol navigasi bab langsung untuk pengguna keyboard.
- **Peta Pemantauan Interaktif (`/earthquakes` & `components/map/SeismicLiveMap.tsx`)**:
  - Menggunakan MapLibre GL JS dan lapisan proyeksi vektor interaktif dengan filter magnitudo, kategori kedalaman (`Dangkal <70 km`, `Menengah 70–300 km`, `Dalam >300 km`), sumber agensi (`BMKG` / `USGS`), serta tombol beralih ke **Tampilan Tabel Aksesibel**.
- **Katalog Gempa & Ekspor CSV (`/catalog`)**:
  - Pencarian lokasi/wilayah, filter zona tektonik, pengurutan waktu/magnitudo/kedalaman, paginasi, serta unduhan CSV yang dilindungi dari *CSV Formula Injection*.
- **Detail Kejadian dengan URL Permanen (`/earthquakes/[id]`)**:
  - Menampilkan parameter lengkap per peristiwa, diagram penampang litosfer (episenter vs hiposenter), tautan verifikasi ke portal asli, dan daftar kejadian terkait pada zona tektonik yang sama.
- **Analisis Statistik & Distribusi (`/insights`)**:
  - Histogram distribusi magnitudo, profil kedalaman hiposenter, diagram pencar (*scatter plot*) kedalaman vs magnitudo, deret waktu harian, dan tabel agregasi per zona tektonik menggunakan Recharts.
- **Dokumentasi Sumber & Status Adapter (`/sources`)**:
  - Memantau status kesehatan setiap adapter (`BMKG_LATEST`, `BMKG_M5`, `BMKG_FELT`, `USGS_GLOBAL`), latensi pengambilan data, serta dokumentasi metodologi.

---

## 2. Integrasi Sumber Data Resmi

1. **BMKG Open Data (`https://data.bmkg.go.id/DataMKG/TEWS/`)**:
   - `autogempa.json`: 1 peristiwa gempa bumi terbaru terverifikasi.
   - `gempaterkini.json`: 15 peristiwa gempa bumi terkini dengan magnitudo M ≥ 5.0.
   - `gempadirasakan.json`: 15 peristiwa gempa bumi terbaru yang dirasakan masyarakat (skala MMI).
2. **USGS Earthquake Catalog (`https://earthquake.usgs.gov/fdsnws/event/1/`)**:
   - Umpan GeoJSON global untuk konteks tektonik regional dan sabuk Lingkar Pasifik.

Setiap respons eksternal divalidasi pada batas sistem menggunakan skema **Zod** (`lib/earthquakes/schemas.ts`). Nilai koordinat di luar rentang (`lat < -90..90`, `lng < -180..180`), kedalaman tidak valid, atau `NaN` ditolak secara eksplisit. Rekaman BMKG dan USGS disimpan dengan identitas sumber terpisah dan tidak pernah digabungkan secara paksa.

---

## 3. Setup Lokal & Perintah Eksekusi

### Konfigurasi Environment
Salin `.env.example` ke `.env.local` bila ingin menyesuaikan timeout atau endpoint:

```bash
cp .env.example .env.local
```

### Menjalankan Development Server
```bash
npm install
npm run dev
```
Aplikasi berjalan pada `http://localhost:3000`.

### Menjalankan Unit Test, Lint, & Pemeriksaan Build
```bash
# Menjalankan seluruh unit test deterministik (parser, skema, statistik, keamanan CSV)
npx --yes tsx --test lib/earthquakes/parser.test.ts

# Menjalankan pemeriksaan ESLint
npm run lint

# Membangun bundel produksi Next.js
npm run build
```

---

## 4. Keterbatasan Aktual & Transparansi

- **Cakupan Jendela Umpan Publik BMKG**: Endpoint JSON terbuka BMKG menyajikan peristiwa terbaru (`autogempa`), 15 gempa M ≥ 5.0 terkini (`gempaterkini`), dan 15 gempa dirasakan terkini (`gempadirasakan`). Katalog historis lintas dekade memerlukan akses arsip repositori FDSN/katalog institusional penuh.
- **Mode Arsip Terverifikasi Saat Offline**: Apabila lingkungan kontainer atau jaringan pengguna memblokir akses keluar ke `data.bmkg.go.id` / `earthquake.usgs.gov`, adapter secara transparan menyajikan snapshot arsip resmi yang diberi label eksplisit `Status: Arsip Referensi Terverifikasi (Mode Offline)` tanpa pernah menyamarkannya sebagai koneksi langsung.
