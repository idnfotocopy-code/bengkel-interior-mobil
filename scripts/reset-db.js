// Hapus database agar data awal (pengaturan bawaan + akun pemilik) dibuat ulang otomatis saat aplikasi dijalankan berikutnya.
// PERINGATAN: seluruh data (pelanggan, pesanan, keuangan, pengguna) akan hilang. Backup dulu dari menu Pengaturan.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data');
let n = 0;
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (/^bengkel\.db/.test(f)) { fs.rmSync(path.join(dir, f)); n++; }
console.log(n ? `Database dihapus (${n} file). Jalankan "npm run dev" untuk membuat ulang data awal (akun pemilik / password123).` : 'Database belum ada; akan dibuat otomatis saat "npm run dev".');
