// Hapus database agar data awal (pengaturan bawaan + akun pemilik) dibuat ulang otomatis saat aplikasi dijalankan berikutnya.
// PERINGATAN: seluruh data (pelanggan, pesanan, keuangan, pengguna) akan hilang. Backup dulu dari menu Pengaturan.
const fs = require('fs');
const path = require('path');
// Hormati DB_PATH (sama seperti lib/db.ts) agar tidak menghapus file yang salah.
const dbFile = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'bengkel.db');
const dir = path.dirname(dbFile), base = path.basename(dbFile);
let n = 0;
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f === base || f === base + '-wal' || f === base + '-shm') { fs.rmSync(path.join(dir, f)); n++; }
console.log(n ? `Database dihapus (${n} file). Jalankan "npm run dev" untuk membuat ulang data awal (akun pemilik / password123).` : 'Database belum ada; akan dibuat otomatis saat "npm run dev".');
