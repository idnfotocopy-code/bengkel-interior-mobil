// Hapus database agar data demo dibuat ulang otomatis saat aplikasi dijalankan berikutnya.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data');
let n = 0;
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (/^bengkel\.db/.test(f)) { fs.rmSync(path.join(dir, f)); n++; }
console.log(n ? `Database dihapus (${n} file). Jalankan "npm run dev" untuk membuat ulang data demo.` : 'Database belum ada; akan dibuat otomatis saat "npm run dev".');
