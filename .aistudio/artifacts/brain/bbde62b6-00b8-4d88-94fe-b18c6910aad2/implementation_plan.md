# Indikator Magnitudo Lingkaran Busur (Radial Arc Dial) Serentak & Beranimasi

Pembaruan menyeluruh pada seluruh indikator magnitudo di aplikasi **Gempa Seismic** menjadi desain **lingkaran busur cekung (recessed radial arc gauge)** sesuai dua gambar referensi, diterapkan serentak di seluruh kartu utama, tabel, dan daftar di semua menu lengkap dengan animasi sapuan busur, hitung naik angka, serta kategori kekuatan seismik Indonesia.

## User Review & Critical Decisions

> [!IMPORTANT]
> Seluruh keputusan desain di bawah ini telah dikonfirmasi melalui pilihan Anda dan siap dieksekusi begitu Anda menekan **Proceed**.

- **Keputusan Terkonfirmasi 1 (Label Kategori Kekuatan Magnitudo)**: Mengganti label *Minor* di bawah angka pada dial besar (Hero & Realtime) menjadi **Kategori Seismik Indonesia**:
  - `M < 3,0` → **Mikro**
  - `M 3,0–3,9` → **Ringan**
  - `M 4,0–4,9` → **Sedang**
  - `M 5,0–5,9` → **Kuat**
  - `M 6,0–6,9` → **Besar**
  - `M ≥ 7,0` → **Dahsyat**
- **Keputusan Terkonfirmasi 2 (Cakupan Indikator Lingkaran Kecil)**: Indikator lingkaran busur (`image_e978c597.png`) diterapkan **serentak di seluruh kartu, tabel, dan daftar di semua menu** (Terkini, Realtime, Dirasakan, M5+, Tsunami, Merusak, Peta, dan Tentang) menggantikan kapsul kotak lama.
- **Keputusan Terkonfirmasi 3 (Animasi Interaktif & Refresh)**:
  - **Sapuan garis busur melingkar (`stroke-dashoffset` sweep)** dari pangkal kiri-bawah searah jarum jam sesuai proporsi magnitudo.
  - **Hitung naik angka (`count-up`)** halus untuk nilai magnitudo pada dial utama & daftar saat halaman dimuat, berganti tab, atau disegarkan.
  - **Denyut halus (`pulse ring`)** khusus pada indikator gempa signifikan **M 5,0+**.

---

## 1. Overview & Core Concept

- **What It Does**: Mengubah seluruh penanda magnitudo gempa menjadi instrumen dial melingkar bertekstur *recessed dark bezel* (cincin luar gelap dengan bayangan kedalaman dalam, lintasan busur trek redup, dan busur warna aktif sesuai tingkat kekuatan magnitudo).
- **Target Audience / Persona**: Masyarakat umum dan pemantau aktivitas kegempaan Indonesia di perangkat mobile, tablet, maupun desktop yang membutuhkan pembacaan tingkat bahaya gempa secara instan lewat panjang busur dan warna.
- **Key Value**: Konsistensi visual 100% di seluruh halaman—baik dial berukuran besar pada sorotan Realtime/Hero maupun dial kompak pada setiap baris tabel dan kartu memiliki bahasa bentuk yang seragam dan hidup.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Sorotan Utama (Hero Terkini & Panel Deteksi Realtime — Referensi Gambar 2)**: Menampilkan dial lingkaran besar berlapis bezel cekung dengan angka magnitudo tebal di tengah (mis. `3,4` atau `5,4`), label kategori kekuatan seismik tepat di bawah angka (`Mikro`, `Ringan`, `Sedang`, `Kuat`, `Besar`, `Dahsyat`), dan busur warna dengan ujung membulat (`stroke-linecap: round` / tegas) yang menyapu dari kiri-bawah.
  2. **Tabel, Kartu & Daftar di Semua Menu (Referensi Gambar 1)**: Setiap baris tabel (`Realtime`, `Dirasakan`, `M5+`, `Merusak`, `Tsunami`), kartu tumpuk (`Stacked Deck`), dan bilah atas menampilkan dial lingkaran kompak (`5,4`) dengan bezel gelap cekung, trek busur redup, dan busur aktif berwarna sesuai skala magnitudo.
  3. **Transisi Refresh & Pindah Menu**: Saat pengguna menekan tombol Refresh, pindah tab menu, atau data baru masuk otomatis, seluruh dial menjalankan animasi sapuan busur dan hitung naik angka secara serempak.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Instrumen seismograf taktil modern (*Tactile Seismic Gauge*) dengan kontras tinggi di atas permukaan terang maupun gelap.
  - *Color Palette & Mood*:
    - Casing / Bezel Lingkaran: `#1E1D1B` (cincin luar) dan `#141312` (cekungan dalam dengan *inner shadow* halus) agar kontras busur menyala tajam baik di mode terang maupun mode gelap.
    - Skala Warna Busur Magnitudo:
      - `M < 3` (**Mikro**): `#94A3B8` (Slate)
      - `M 3,0–3,9` (**Ringan**): `#14B8A6` / `#EAB308` (Amber-Gold / Teal sesuai skala kekuatan)
      - `M 4,0–4,9` (**Sedang**): `#F59E0B` (Amber)
      - `M 5,0–5,9` (**Kuat**): `#EA580C` (Oranye Terang seperti gambar `5,4`)
      - `M 6,0–6,9` (**Besar**): `#EF4444` (Merah)
      - `M 7,0+` (**Dahsyat**): `#F43F5E` (Merah Tua Menyala)
  - *Typography & Hierarchy*: Angka magnitudo menggunakan font numerik tabular (`tabular-nums`) berwarna putih gading (`#F5F2EB`) tepat di titik pusat lingkaran, diikuti sub-label kategori (`Mikro`, `Ringan`, `Sedang`, `Kuat`, `Besar`, `Dahsyat`) dengan warna abu hangat (`#A6A096`) pada dial besar.

---

## 3. Key Product Decisions & Trade-Offs

- **Keputusan 1: Geometri Busur Radial 270° Dimulai dari Kiri-Bawah (135°)**
  - *Chosen Approach*: Menggunakan SVG `<circle>` dengan rotasi `135deg` dan `pathLength="100"` (panjang trek maksimum `75` dari `100`), sehingga titik awal busur berada di kiri-bawah (~jam 7:30) dan menyapu searah jarum jam melewati sisi kiri dan atas menuju kanan-bawah (~jam 4:30), persis seperti kedua gambar referensi.
  - *Why*: Memberikan ruang visual yang seimbang di bagian bawah untuk sub-label kategori kekuatan (`Ringan`, `Sedang`, `Kuat`, dll.) pada dial besar serta menjaga tampilan dial kecil tetap identik dengan referensi `5,4`.
- **Keputusan 2: Animasi Ringan Berbasis CSS & `requestAnimationFrame`**
  - *Chosen Approach*: Menggabungkan animasi CSS `@keyframes` pada `stroke-dashoffset` untuk sapuan busur dan hook `requestAnimationFrame` berdurasi `550ms` (cubic-out) untuk hitung naik angka magnitudo, ditambah efek *pulse* halus khusus untuk `M ≥ 5,0`.
  - *Why*: Menjaga performa 60fps tetap ringan meskipun puluhan baris tabel dirender secara bersamaan di layar.

---

## 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     Sistem Klasifikasi & Format Seismik                  │
│  • magStrengthLabel(m): "Mikro" | "Ringan" | "Sedang" | "Kuat" |         │
│                         "Besar" | "Dahsyat"                              │
│  • magBucket(m) & magColorHex(m): Penentu warna busur & status M5+       │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────────────┐
│   Dial Lingkaran Besar (MagDial)      │   │  Dial Lingkaran Kompak (MagBadge)     │
│   [Referensi Gambar 2: "3,4 Ringan"]  │   │  [Referensi Gambar 1: "5,4"]          │
├───────────────────────────────────────┤   ├───────────────────────────────────────┤
│ • Digunakan pada:                     │   │ • Digunakan serentak pada:            │
│   - Kartu Sorotan Utama (Hero)        │   │   - Tabel Realtime, Dirasakan, M5+,   │
│   - Panel Deteksi Realtime            │   │     Merusak, Tsunami                  │
│   - Lembar Detail Gempa (Modal)       │   │   - Kartu Tumpuk (Stacked Deck)       │
│ • Bezel cekung berlapis + SVG Arc     │   │   - Bilah Atas, Daftar & Legenda      │
│ • Angka Count-Up + Sub-label Kategori │   │ • Ukuran: sm (38px), md (46px),       │
│   ("Mikro", "Ringan", "Sedang",       │   │   lg (56px)                           │
│    "Kuat", "Besar", "Dahsyat")        │   │ • Animasi sapuan busur + denyut M5+   │
└───────────────────────────────────────┘   └───────────────────────────────────────┘
```

### Interactive Component & State Mapping
- **Sinkronisasi Refresh (`data-refresh-cycle`)**: Setiap kali tombol Refresh ditekan atau pengguna berpindah tab menu, komponen `MagDial` dan `MagBadge` memicu ulang animasi sapuan busur (`dial-arc-sweep`) dan penghitung angka (`useAnimatedNumber`) secara serempak.
- **Responsivitas Seluruh Perangkat**: Ukuran dial kompak menyesuaikan secara otomatis di layar HP (`38px–42px`), tablet (`44px`), dan laptop/desktop (`46px–52px` untuk tabel/kartu, serta `148px–172px` untuk dial besar di Realtime dan Beranda).
