# Bengkel Interior Mobil — Sistem Administrasi

This is a local web app for a car interior workshop. It covers customers, vehicles, work orders, production, materials stock, finance, and PDF reports.
Next.js 14 (App Router) + TypeScript + Tailwind + SQLite (better-sqlite3) + pdfkit.

## Cara menjalankan

Syarat: **Node.js 18.18+** (disarankan Node 20/22).

```bash
npm install
npm run dev
```

Buka **http://localhost:3000**. Database `data/bengkel.db` dibuat & diisi data contoh otomatis saat pertama kali dibuka.

- Mode produksi: `npm run build && npm start`
- Ganti port bila 3000 terpakai: `npx next dev -p 3005`
- Reset data ke kondisi awal: hentikan server, `npm run reset-db`, lalu `npm run dev` lagi.

> Catatan: `better-sqlite3` memakai modul native. Bila `npm install` meminta izin menjalankan script install (npm 11 / `allow-scripts`), izinkan untuk paket `better-sqlite3`. Di Windows mungkin perlu "Desktop development with C++" bila binary prebuilt tidak tersedia.

## Akun demo (KHUSUS UJI COBA)

Semua password: `password123`. **Ganti / nonaktifkan sebelum dipakai sungguhan** (menu Pengguna).

| Username | Peran | Akses utama |
|---|---|---|
| pemilik | Pemilik | Semua menu & aksi, termasuk kelola pengguna dan laba rugi |
| admin | Admin | Semua operasional (pelanggan, kendaraan, pesanan, produksi, persediaan, pembayaran/invoice/pengeluaran, pengaturan) — tanpa kelola pengguna & kas |
| keuangan | Keuangan | Pembayaran, invoice, pengeluaran, kas, piutang, laba rugi; lihat semua pesanan & stok (tanpa ubah stok) |
| gudang | Gudang | Bahan, pemasok, stok masuk/penyesuaian, pemakaian bahan; lihat pesanan terbatas; tanpa pembayaran/keuangan |
| teknisi | Teknisi | Hanya pesanan yang ditugaskan: progres + foto, pemakaian bahan, status produksi; tanpa harga, pembayaran, pengguna |
| teknisi2 | Teknisi | Contoh teknisi kedua |

### Matriks hak akses menu

| Menu | Pemilik | Admin | Keuangan | Gudang | Teknisi |
|---|:-:|:-:|:-:|:-:|:-:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pelanggan | ✓ | ✓ | – | – | – |
| Kendaraan | ✓ | ✓ | – | – | lihat |
| Pesanan / WO | ✓ | ✓ | lihat semua | lihat | hanya tugasnya |
| Produksi | ✓ | ✓ | – | – | ✓ |
| Persediaan | ✓ | ✓ | lihat | ✓ | – |
| Keuangan | ✓ | ✓ (tanpa kas) | ✓ | – | – |
| Laporan | ✓ | ✓ (tanpa laba rugi) | ✓ | stok | – |
| Pengguna | ✓ | – | – | – | – |
| Pengaturan | ✓ | ✓ | – | – | – |

### Matriks aksi Tambah / Edit / Hapus

Tombol yang tidak diizinkan disembunyikan, dan setiap server action memeriksa izin lagi (`lib/rbac.ts` → `requirePerm`). Hapus selalu minta konfirmasi.

| Aksi | Pemilik | Admin | Keuangan | Gudang | Teknisi |
|---|:-:|:-:|:-:|:-:|:-:|
| Pelanggan: tambah/edit/hapus | ✓ | ✓ | – | – | – |
| Kendaraan: tambah/edit/hapus | ✓ | ✓ | – | – | – |
| Pesanan & item: tambah/edit/hapus, ubah harga | ✓ | ✓ | – | – | – |
| Pesanan: batalkan (wajib alasan) / hapus permanen* | ✓ | ✓ | – | – | – |
| Progres produksi: tambah | ✓ | ✓ | – | – | ✓ (tugasnya) |
| Progres produksi: edit/hapus | ✓ semua | ✓ semua | – | – | ✓ catatan sendiri |
| Pemakaian bahan pada pesanan | ✓ | ✓ | – | ✓ | ✓ |
| Bahan & pemasok: tambah/edit/hapus** | ✓ | ✓ | – | ✓ | – |
| Mutasi stok manual (masuk/penyesuaian): tambah/edit/hapus | ✓ | ✓ | – | ✓ | – |
| Pembayaran: tambah/edit/hapus | ✓ | ✓ | ✓ | – | – |
| Invoice: buat/edit/batal | ✓ | ✓ | ✓ | – | – |
| Pengeluaran: tambah/edit/hapus | ✓ | ✓ | ✓ | – | – |
| Akun kas: tambah/edit/hapus** | ✓ | – | ✓ | – | – |
| Pengguna: tambah/edit/hapus** | ✓ | – | – | – | – |
| Pengaturan: simpan/reset | ✓ | ✓ | – | – | – |

\* Hapus permanen pesanan hanya bila belum ada pembayaran, invoice, atau pemakaian bahan; selain itu gunakan **Batal**.
\*\* Data yang sudah dipakai transaksi tidak dihapus permanen, melainkan dinonaktifkan (jejak audit tetap utuh). Pemilik aktif terakhir dan akun sendiri tidak bisa dihapus. Mutasi stok yang berasal dari pesanan hanya bisa dikoreksi lewat pembatalan pemakaian bahan.

Matriks lengkap per izin juga tampil di menu **Pengguna**.

## Modul

- **Dashboard**: ringkasan pesanan aktif, omzet, piutang, stok menipis, dan jadwal selesai.
- **Pelanggan**: ID otomatis `PLG-####` dan riwayat pesanan.
- **Kendaraan**: nopol, merek/tipe, tahun, warna, no. rangka, kondisi, dan foto.
- **Work Order**: nomor `BIM-YYYY-####`.
  - Rincian jasa/barang, diskon, DP dan sisa.
  - 10 status alur kerja, ditambah Dibatalkan (pembatalan butuh alasan dan konfirmasi).
  - Penugasan teknisi dan riwayat status.
- **Produksi**: papan kerja untuk teknisi, progres % dengan foto, pemakaian bahan yang langsung mengurangi stok, dan tombol status.
- **Persediaan**:
  - Master bahan dan supplier.
  - Barang masuk, yang bisa langsung dicatat sebagai biaya pembelian.
  - Barang keluar dan stok opname (wajib alasan).
  - Kartu stok dan peringatan stok minimum.
- **Keuangan**:
  - Pembayaran (DP/tahap/pelunasan) dengan kuitansi `KWT-YYYY-####`.
  - Invoice `INV-YYYY-####`, maksimal 1 invoice aktif per pesanan; terbitkan ulang otomatis membatalkan yang lama.
  - Pengeluaran per kategori, akun kas/bank, dan piutang.
- **Laporan**: ringkasan laba rugi, stok, status pesanan, piutang, dan unduh PDF.
- **Pengguna** (pemilik saja): tambah/ubah, reset password, nonaktifkan, matriks akses, dan log aktivitas.
- **Pengaturan**: nama usaha, tagline, alamat, telepon, email, kota, rekening, instruksi bayar, syarat penawaran, jatuh tempo, masa berlaku, dan **logo** (PNG/JPG ≤ 2 MB, dipakai di semua PDF).

## Dokumen & laporan PDF

| Dokumen | Isi | Dari |
|---|---|---|
| Surat penawaran | rincian & harga, total, masa berlaku, syarat & ketentuan, tanda tangan | Detail pesanan |
| Work order | identitas pelanggan/kendaraan, pekerjaan, jadwal, penanggung jawab/teknisi, bahan, checklist QC | Detail pesanan |
| Invoice | logo & identitas usaha, no. invoice, pelanggan, kendaraan, item, qty, harga, total, pembayaran sebelumnya, sisa, jatuh tempo, instruksi bayar | Detail pesanan / Keuangan |
| Kuitansi | penerimaan uang + terbilang, tanggal, metode/akun, referensi invoice, sisa | Detail pesanan / Keuangan |
| Surat serah terima | kondisi kendaraan masuk & diserahkan, pekerjaan selesai, tanggal, tanda tangan | Detail pesanan |
| Laporan stok | saldo awal, masuk, keluar, akhir, nilai persediaan + rincian mutasi | Laporan |
| Laporan transaksi | pemasukan & pengeluaran per periode dan kategori, saldo kas/bank | Laporan |
| Laporan laba rugi | pendapatan, HPP (bahan + tenaga kerja), biaya operasional, laba/rugi, margin per pesanan | Laporan |
| Laporan piutang | invoice belum lunas, umur piutang | Laporan / Keuangan |

URL: `/api/pdf/{penawaran|wo|serah-terima}?id=<id pesanan>`, `/api/pdf/invoice?id=<id invoice>`, `/api/pdf/kuitansi?id=<id pembayaran>`, `/api/pdf/{stok|transaksi|laba-rugi}?from=YYYY-MM-DD&to=YYYY-MM-DD`, `/api/pdf/piutang`. Semua butuh login dan hak akses sesuai peran.

## Aturan perhitungan

- **Pendapatan** diakui dari invoice yang terbit pada periode tersebut (yang dibatalkan tidak dihitung). Uang muka adalah kas masuk, bukan laba.
- **HPP** terdiri dari:
  - pemakaian bahan pada pesanan (qty × harga beli saat dipakai);
  - pengeluaran kategori *Tenaga kerja*.
- **Biaya operasional** adalah pengeluaran selain *Tenaga kerja* dan *Pembelian bahan*. Pembelian bahan masuk ke persediaan dan baru menjadi biaya saat bahan dipakai.
- **Piutang** = total invoice aktif − seluruh pembayaran pesanan.

## Keamanan

- Password di-hash dengan bcrypt.
- Sesi disimpan di database dengan cookie httpOnly selama 12 jam.
- RBAC diperiksa di server untuk setiap halaman, aksi, dan PDF.
- Teknisi hanya bisa membuka pesanan yang ditugaskan kepadanya.
- Semua perubahan penting tercatat di log aktivitas.

## Struktur

```
app/(app)/...      halaman per modul + server actions
app/api/pdf/[doc]  generator PDF
lib/db.ts          skema SQLite & pengaturan     lib/seed.ts   data contoh
lib/rbac.ts        matriks hak akses             lib/biz.ts    perhitungan stok/keuangan
lib/pdf.ts         kop & komponen PDF            lib/documents.ts  isi tiap dokumen
data/              database SQLite               public/uploads    foto & logo
```

## Keterbatasan yang diketahui

- File di `public/uploads` juga bisa diakses langsung lewat `/uploads/<nama-file>` tanpa login, karena nama filenya acak dan sulit ditebak. Untuk produksi, pindahkan folder upload ke luar `public/`.
- Belum ada notifikasi WhatsApp/email otomatis.
- Satu invoice aktif per pesanan; tagihan bertahap dicatat sebagai pembayaran, bukan beberapa invoice.
- Belum ada modul hutang ke supplier dan PPN.
- Aplikasi ditujukan untuk jaringan lokal/localhost. Sebelum dibuka ke internet, tambahkan HTTPS dan backup terjadwal untuk `data/bengkel.db`.
