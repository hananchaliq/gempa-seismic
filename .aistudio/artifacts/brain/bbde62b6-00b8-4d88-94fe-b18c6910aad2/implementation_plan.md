# Gempa Seismic — Monochrome Alabaster & Obsidian Redesign + Structured Telemetry Tables

Transformasi menyeluruh antarmuka **Gempa Seismic** agar selaras dengan estetika arsitektural **Monochrome Alabaster & Obsidian** pada gambar referensi, dilengkapi navigasi sidebar kiri tunggal, tabel pendeteksi berstruktur penuh pada menu `Realtime`, `Dirasakan`, `M5+`, dan `Merusak`, serta standarisasi satuan **Magnitudo (`M`)** menggantikan label kualitatif seperti *Mikro* atau *Minor*.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Berikut adalah keputusan produk dan desain yang telah dikonfirmasi dari jawaban Anda:

- **Confirmed Decision 1 — Navigasi Sidebar Kiri Tunggal (Tanpa Double Navbar)**: Menggunakan satu *sidebar* vertikal di sisi kiri (seperti kolom menu `Accueil / Calendrier / Projets` pada gambar referensi) dengan kapsul aktif berwarna hitam pekat (*Obsidian Black* `#0F0F10`), sedangkan bagian atas ruang kerja menampilkan tajuk besar editorial dan kapsul utilitas (*status live*, *search bar* dengan tombol ikon bulat hitam, tombol *Sync*, *Suara*, dan *Tema*).
- **Confirmed Decision 2 — Tabel Data Pendeteksi Terstruktur Penuh**: Menu `Realtime`, `Dirasakan`, `M5+`, dan `Merusak` dirombak menggunakan tabel data berstruktur penuh (*full-width structured table*) dengan kolom terpisah yang rapi (`#`, `Magnitudo`, `Waktu (WIB)`, `Wilayah`, `Koordinat`, `Kedalaman & Zona`, `Status / Dirasakan (MMI)`, dan tombol aksi `Inspeksi`), dipadukan dengan peta interaktif beresolusi tinggi.
- **Confirmed Decision 3 — Standarisasi Satuan `Magnitudo` & Awalan `M`**: Mengganti teks kategori kualitatif (`Mikro`, `Minor`, `Ringan`, `Sedang`, `Kuat`) pada *dial* utama, *badge*, dan ringkasan menjadi label satuan **`Magnitudo`** dan awalan **`M`** (contoh: `M 2,6 · Magnitudo`).

---

## 1. Overview & Core Concept

- **What It Does**: Platform pemantauan gempa bumi dan peringatan dini tsunami real-time Indonesia berbasis jaringan sensor BMKG InaTEWS (`gempa.rone.dev`) dengan pembaruan otomatis setiap 30 detik, kalkulator jarak episenter & waktu tiba gelombang P/S, penampang kedalaman hiposenter 2D, dan kurva tren magnitudo.
- **Target Audience / Persona**: Masyarakat umum, peneliti kebumian, analis tanggap darurat, dan pengembang yang membutuhkan data seismik real-time dalam tampilan tabel yang presisi, bersih, dan mudah dipindai.
- **Key Value**: Kombinasi estetika monokrom kontras tinggi (*Alabaster Stone & Obsidian Black*) yang tenang di mata dengan struktur tabel telemetri yang sangat rapi dan terorganisir.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Beranda (`Terkini`)**: Pengguna disambut tajuk editorial besar (`Gempa Seismic`) dan kapsul utilitas atas, diikuti susunan Bento kontras tinggi: kartu monitor gempa terbaru & jadwal rentang waktu deteksi (gaya kapsul hitam horizontal), kartu kurva energi gelombang halus (*smooth bezier curve*), kartu fokus gelap (*Obsidian Card*) untuk peta & pantauan prioritas, serta kartu 3 kolom ringkasan parameter tektonik di bagian bawah.
  2. **Eksplorasi Tabel Terstruktur (`Realtime`, `Dirasakan`, `M5+`, `Merusak`)**: Pengguna menyaring data melalui *toolbar* kapsul (filter magnitudo `Semua`, `M3+`, `M4+`, `M5+` dan pencarian wilayah), lalu membaca tabel terstruktur penuh dengan angka *tabular-nums* yang sejajar vertikal dan mengklik baris mana pun untuk membuka panel *Detail Sheet* atau memusatkan peta.
  3. **Peringatan Tsunami & Peta Seismisitas (`Tsunami`, `Peta`, `Tentang`, `API`)**: Menampilkan matriks zona peringatan, kronologi buletin, peta sesar aktif Indonesia, dan penguji endpoint JSON.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: **Sculptural Monochrome Alabaster & Obsidian** — memadukan permukaan batu alabaster terang (`#ECECE9` / `#F7F7F5`) dengan modul kartu hitam pekat (`#0F0F10`) bertepi membulat halus (`24px–28px`), tombol ikon bulat hitam, dan garis pembatas tipis (*hairline borders*).
  - *Color Palette & Mood*:
    - **Light Mode (Default — Sesuai Gambar Referensi)**:
      - `--bg`: `#E5E5E0` (Outer Alabaster Stone)
      - `--bg-shell`: `#F2F2EF` (Main Glassmorphic Frame)
      - `--bg-card`: `#FAFAFA` (Crisp Ivory Surface)
      - `--bg-obsidian`: `#0F0F10` (High-Contrast Obsidian Black Card & Active Pill)
      - `--ink`: `#111113` (Deep Obsidian Ink)
      - `--ink-2`: `#636369` (Muted Pewter)
      - `--ink-3`: `#94949C` (Soft Silver Gray)
    - **Dark Mode (Night Monitoring Posture)**:
      - `--bg`: `#09090B`, `--bg-shell`: `#111114`, `--bg-card`: `#18181C`, `--bg-obsidian`: `#050506`, `--ink`: `#F4F4F6`.
    - **Semantic Magnitude Accents**: Tetap mempertahankan indikator warna skala magnitudo terkalibrasi pada titik peta dan lencana `M` agar tingkat bahaya gempa langsung dikenali secara visual.
  - *Typography & Hierarchy*:
    - Display & UI: `Plus Jakarta Sans` (700/800 untuk tajuk besar bergaya `Web Design` pada referensi, 500/600 untuk navigasi dan tabel).
    - Numerik & Telemetri: `JetBrains Mono` dengan `font-variant-numeric: tabular-nums` pada seluruh angka magnitudo, koordinat, waktu WIB, dan kedalaman.

- **Interactive Feedback & Motion**:
  - Animasi transisi halus pada setiap siklus pembaruan 30 detik (`refreshCycle`), efek *hover* baris tabel dengan sorotan kontras, dan umpan balik instan saat memilih titik gempa pada kurva maupun peta.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Arsitektur Shell: Satu Sidebar Kiri + Header Utilitas Kontekstual**
  - *Chosen Approach*: Memindahkan 8 menu navigasi ke dalam `.app-sidebar` di sisi kiri (dengan kapsul hitam aktif dan kartu profil stasiun/lokasi referensi di bagian bawah sidebar), serta menjadikan bagian atas halaman sebagai `.workspace-topbar` yang hanya berisi judul halaman dan kapsul pencarian/sinkronisasi.
  - *Why*: Meniru komposisi persis dari gambar referensi sekaligus memastikan tidak ada duplikasi navbar.
- **Decision 2 — Tabel Pendeteksi Terstruktur Penuh (Full-Width Structured Data Grid)**
  - *Chosen Approach*: Menyusun ulang tampilan data pada `Realtime`, `Dirasakan`, `M5+`, dan `Merusak` menjadi tabel penuh dengan 7 kolom terdefinisi (`No`, `Magnitudo`, `Waktu Kejadian (WIB)`, `Wilayah Episenter`, `Koordinat`, `Kedalaman`, `Status / Intensitas MMI`, dan `Aksi`).
  - *Why*: Memenuhi permintaan pengguna agar data pendeteksi terlihat rapi, sejajar, dan terstruktur layaknya instrumen analitik profesional.
- **Decision 3 — Satuan `Magnitudo` & Awalan `M` Eksplisit**
  - *Chosen Approach*: Mengubah fungsi `MagDial` dan komponen lencana agar menampilkan `Magnitudo` sebagai sub-label satuan dan `M` di depan angka magnitudo (mis. `M 4,8`), tanpa label `Mikro` atau `Minor`.
  - *Why*: Lebih akurat secara ilmiah dan sesuai instruksi langsung pengguna.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     .monochrome-shell (Alabaster Frame)                      │
├────────────────────┬─────────────────────────────────────────────────────────┤
│   .app-sidebar     │                  .workspace-main                        │
│  (Single Left Nav) │  ┌───────────────────────────────────────────────────┐  │
│                    │  │ .workspace-topbar                                 │  │
│  • Brand Header    │  │  • Large Editorial Title ("Gempa / Seismic")      │  │
│  • 8 Menu Items    │  │  • Utility Pill (Date/WIB + Peak M + Live 30s)    │  │
│    (Active =       │  │  • Search Pill (Circular Black Icon + Input)      │  │
│     #0F0F10 Pill)  │  │  • Circular Action Buttons (Sync, Suara, Theme)   │  │
│  • API Docs Link   │  └───────────────────────────────────────────────────┘  │
│                    │  ┌───────────────────────────────────────────────────┐  │
│  ┌──────────────┐  │  │ Active View Router:                               │  │
│  │ Station /    │  │  │  1. Terkini: Reference Bento Grid                 │  │
│  │ Reference    │  │  │     • Capsule Timeline Card + Smooth Curve Card   │  │
│  │ Location Pod │  │  │     • Obsidian Dark Map & Priority Spotlight Card │  │
│  └──────────────┘  │  │     • Bottom Obsidian 3-Column Telemetry Card     │  │
│                    │  │  2. Realtime / Dirasakan / M5+ / Merusak:         │  │
│                    │  │     • Interactive Map Card + Filter Toolbar       │  │
│                    │  │     • Full-Width 7-Column Structured Data Table   │  │
│                    │  │  3. Tsunami / Peta / Tentang / Dokumentasi API    │  │
│                    │  └───────────────────────────────────────────────────┘  │
└────────────────────┴─────────────────────────────────────────────────────────┘
```

### Interactive Component & State Mapping

- **Standarisasi `MagDial`, `MagRing`, dan `MagBadge`**:
  - Menghapus pemanggilan `magLabel(m)` (`Mikro`/`Minor`) pada `MagDial` dan menggantinya dengan teks eksplisit `Magnitudo` serta format `M {fmtMag(m)}`.
- **Komponen Tabel Terstruktur (`StructuredSeismicTable`)**:
  - Mendukung pengurutan kolom (*sorting* berdasarkan Magnitudo, Waktu, Wilayah, Kedalaman), pencarian wilayah instan, lencana `M {magnitudo}` dengan angka *tabular-nums*, indikator kedalaman (`Dangkal`, `Menengah`, `Dalam`), serta klik baris untuk membuka `RoneDetailSheet`.
- **Sinkronisasi Real-Time 30 Detik**:
  - Mempertahankan *polling* otomatis 30 detik ke `/api/v1/earthquakes/realtime`, `/latest`, `/felt`, `/significant`, dan `/tsunami` dengan animasi transisi halus pada setiap pembaruan.
