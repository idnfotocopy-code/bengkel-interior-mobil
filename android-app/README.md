# Aplikasi Android — Bengkel Interior Mobil

Pembungkus WebView untuk website Sistem Administrasi Bengkel Interior Mobil.
Semua data tetap di server (PC bengkel / hosting); server harus menyala & online.

- ID aplikasi : `com.idnindonesia.bengkelinterior` · minSdk 21 (Android 5.0) · targetSdk 34
- Alamat server **tidak dikunci**: saat pertama dibuka, aplikasi meminta alamat server
  (sudah terisi alamat bawaan dari `config.properties` → `DEFAULT_URL`).
- Ubah alamat server kapan saja:
  - tombol **⚙** di pojok kanan bawah halaman login aplikasi,
  - halaman **Tidak dapat terhubung** (muncul otomatis bila server tidak bisa dihubungi),
  - tombol **Menu** HP (jika ada).
- Fitur: login tersimpan (cookie), unggah foto (galeri / kamera di Android 10+), unduh PDF ke folder
  **Download** (dibuka otomatis setelah selesai), tombol Kembali, tautan WhatsApp/telepon dibuka di aplikasinya.

## Build

Kebutuhan: JDK 17, Android SDK (platforms;android-34, build-tools;34.0.0), Gradle 8.7
(atau buka folder ini di Android Studio).

```
bash build-apk.sh                      # pakai DEFAULT_URL di config.properties
bash build-apk.sh https://alamat-baru  # timpa alamat bawaan
```
Naikkan `VERSION_CODE`/`VERSION_NAME` di `config.properties` untuk versi baru.
Hasil disalin ke `public/download/bengkel-interior-mobil.apk` web app + `apk.json` (info versi),
lalu tombol **Download Aplikasi Android (APK)** di halaman login otomatis muncul (`/api/apk`).

## Tanda tangan (PENTING)

Kunci rilis ada di `keystore/bengkel-release.jks` + `keystore/keystore.properties` (sandi).
Folder `keystore/` TIDAK disimpan di git. Simpan cadangannya baik-baik: update APK hanya bisa
dipasang menimpa versi lama bila ditandatangani dengan kunci yang sama.

© 2026 idnindonesia @nickibnu
