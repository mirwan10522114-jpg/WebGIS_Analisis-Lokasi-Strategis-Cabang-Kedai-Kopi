# WebGIS Analisis Lokasi Strategis Cabang Kedai Kopi

Aplikasi WebGIS untuk membandingkan calon lokasi cabang kedai kopi di Kota Bandung. Peta interaktif menampilkan lokasi kandidat, kedai kopi pesaing, pusat keramaian, dan akses jalan. Hasil skoring membantu memilih lokasi yang paling strategis berdasarkan data spasial OpenStreetMap.

## Fitur

- Peta Leaflet dengan lapisan OpenStreetMap, pilihan citra satelit Esri, marker, dan radius analisis 1 km.
- Lima calon lokasi awal di Bandung. Pengguna dapat menambah, mengubah, atau menghapus kandidat selama sesi aplikasi berjalan, termasuk memilih titik langsung dari peta atau mencari alamat melalui Nominatim.
- Data kompetitor, pusat keramaian, dan jalan diambil melalui API internal Next.js yang meneruskan permintaan ke Overpass API. Respons disimpan sementara di memori server selama 10 menit.
- Perhitungan jarak Haversine untuk mencari pusat keramaian terdekat dan menghitung jumlah kompetitor dalam radius 1 km.
- Perbandingan skor, peringkat kandidat, rincian alasan setiap skor, dan rekomendasi otomatis.
- Halaman laporan yang menampilkan data serta metode analisis.

## Metode skoring

Setiap kriteria mendapat skor **1, 3, atau 5**. Ketiga skor dijumlahkan tanpa bobot tambahan, sehingga total berada pada rentang **3–15**.

| Kriteria | Skor 5 | Skor 3 | Skor 1 |
| --- | --- | --- | --- |
| Jarak ke pusat keramaian terdekat | 0–300 m | >300–700 m | >700 m |
| Jumlah kompetitor dalam radius 1 km | 0–2 | 3–5 | >5 |
| Klasifikasi akses jalan OSM | Jalan utama | Jalan sedang | Jalan kecil/gang |

Total **12–15** dikategorikan *Sangat Strategis*, **8–11** *Strategis*, dan **3–7** *Kurang Strategis*. Jika total sama, lokasi yang lebih dekat ke pusat keramaian ditempatkan lebih tinggi. Penilaian ini adalah alat bantu perbandingan lokasi; aplikasi tidak mengukur laba, lalu lintas kendaraan, atau kepadatan demografis secara langsung.

## Teknologi

- Next.js 16, React 19, TypeScript
- Leaflet.js, OpenStreetMap, Overpass API, Nominatim, citra satelit Esri
- Tailwind CSS 4 dan komponen Radix UI

Backend aplikasi menggunakan **Next.js API Routes**. Tidak diperlukan PHP atau database untuk menjalankannya.

## Menjalankan secara lokal

Pastikan Node.js dan npm tersedia, lalu jalankan:

```bash
git clone https://github.com/mirwan10522114-jpg/WebGIS_Analisis-Lokasi-Strategis-Cabang-Kedai-Kopi.git
cd WebGIS_Analisis-Lokasi-Strategis-Cabang-Kedai-Kopi
npm ci
npm run dev
```

Buka **http://localhost:3000**. Jika port 3000 digunakan aplikasi lain, jalankan `npx next dev -p 3100` lalu buka **http://localhost:3100**.

Untuk build produksi:

```bash
npm run build
npm run start
```

Pemuatan data peta dan pencarian alamat memerlukan koneksi internet. Ketersediaan serta kelengkapan data mengikuti OpenStreetMap dan layanan Overpass/Nominatim.

## Struktur utama

```text
src/app/page.tsx                 Peta, kandidat, perhitungan skor, dan laporan
src/app/api/osm/competitors/    API data kedai kopi pesaing
src/app/api/osm/crowd/          API data pusat keramaian
src/app/api/osm/roads/          API data jalan dan klasifikasinya
src/components/ui/             Komponen antarmuka
```
