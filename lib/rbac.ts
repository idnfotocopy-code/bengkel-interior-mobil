export const ROLES = ['pemilik', 'admin', 'keuangan', 'gudang', 'teknisi'] as const;
export type Role = typeof ROLES[number];
export const ROLE_LABEL: Record<string, string> = { pemilik: 'Pemilik', admin: 'Admin', keuangan: 'Keuangan', gudang: 'Gudang', teknisi: 'Teknisi' };

export type MenuKey = 'dashboard' | 'pelanggan' | 'kendaraan' | 'pesanan' | 'produksi' | 'persediaan' | 'keuangan' | 'laporan' | 'users' | 'pengaturan';
export const MENUS: { key: MenuKey; href: string; label: string; icon: string; group: string; roles: Role[] }[] = [
  { key: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: '📊', group: 'Utama', roles: ['pemilik', 'admin', 'keuangan', 'gudang', 'teknisi'] },
  { key: 'pelanggan', href: '/pelanggan', label: 'Pelanggan', icon: '👤', group: 'Operasional', roles: ['pemilik', 'admin'] },
  { key: 'kendaraan', href: '/kendaraan', label: 'Kendaraan', icon: '🚗', group: 'Operasional', roles: ['pemilik', 'admin', 'teknisi'] },
  { key: 'pesanan', href: '/pesanan', label: 'Pesanan / Work Order', icon: '🧾', group: 'Operasional', roles: ['pemilik', 'admin', 'keuangan', 'gudang', 'teknisi'] },
  { key: 'produksi', href: '/produksi', label: 'Produksi', icon: '🛠️', group: 'Operasional', roles: ['pemilik', 'admin', 'teknisi'] },
  { key: 'persediaan', href: '/persediaan', label: 'Persediaan', icon: '📦', group: 'Gudang & Keuangan', roles: ['pemilik', 'admin', 'keuangan', 'gudang'] },
  { key: 'keuangan', href: '/keuangan', label: 'Keuangan', icon: '💰', group: 'Gudang & Keuangan', roles: ['pemilik', 'admin', 'keuangan'] },
  { key: 'laporan', href: '/laporan', label: 'Laporan', icon: '📑', group: 'Gudang & Keuangan', roles: ['pemilik', 'admin', 'keuangan', 'gudang'] },
  { key: 'users', href: '/users', label: 'Pengguna', icon: '🔐', group: 'Sistem', roles: ['pemilik'] },
  { key: 'pengaturan', href: '/pengaturan', label: 'Pengaturan', icon: '⚙️', group: 'Sistem', roles: ['pemilik', 'admin'] },
];
export const canMenu = (role: string, key: MenuKey) => !!MENUS.find(m => m.key === key)?.roles.includes(role as Role);
export const menusFor = (role: string) => MENUS.filter(m => m.roles.includes(role as Role));

/** Izin aksi — mengikuti matriks hak akses pada rancangan (bab 7). */
const PERMS = {
  'pelanggan.kelola': ['pemilik', 'admin'],        // tambah / edit / hapus pelanggan
  'kendaraan.kelola': ['pemilik', 'admin'],        // tambah / edit / hapus kendaraan
  'pesanan.kelola': ['pemilik', 'admin'],          // buat/ubah pesanan, item (tambah/edit/hapus), teknisi
  'pesanan.harga': ['pemilik', 'admin'],           // ubah harga
  'pesanan.batal': ['pemilik', 'admin'],           // batalkan pesanan (wajib alasan)
  'pesanan.hapus': ['pemilik', 'admin'],           // hapus permanen pesanan tanpa transaksi
  'pesanan.semua': ['pemilik', 'admin', 'keuangan', 'gudang'], // lihat semua pesanan (teknisi hanya tugasnya)
  'status.semua': ['pemilik', 'admin'],
  'progres.tulis': ['pemilik', 'admin', 'teknisi'],  // tambah/edit/hapus catatan progres sendiri
  'progres.kelola': ['pemilik', 'admin'],          // edit/hapus catatan progres siapa pun
  'bahan.pakai': ['pemilik', 'admin', 'gudang', 'teknisi'],
  'bahan.batal': ['pemilik', 'admin', 'gudang'],
  'stok.master': ['pemilik', 'admin', 'gudang'],   // tambah / edit / hapus bahan & pemasok
  'stok.masuk': ['pemilik', 'admin', 'gudang'],
  'stok.penyesuaian': ['pemilik', 'admin', 'gudang'],
  'stok.lihat_biaya': ['pemilik', 'keuangan', 'gudang', 'admin'],
  'bayar.catat': ['pemilik', 'keuangan', 'admin'],
  'bayar.hapus': ['pemilik', 'keuangan', 'admin'],  // edit / hapus pembayaran
  'invoice.kelola': ['pemilik', 'keuangan', 'admin'],
  'biaya.kelola': ['pemilik', 'keuangan', 'admin'],
  'kas.kelola': ['pemilik', 'keuangan'],
  'dokumen.keuangan': ['pemilik', 'keuangan', 'admin'], // invoice & kuitansi PDF
  'dokumen.pesanan': ['pemilik', 'admin', 'keuangan', 'gudang', 'teknisi'],
  'laporan.stok': ['pemilik', 'admin', 'keuangan', 'gudang'],
  'laporan.transaksi': ['pemilik', 'admin', 'keuangan'],
  'laporan.labarugi': ['pemilik', 'keuangan'],
  'laporan.piutang': ['pemilik', 'admin', 'keuangan'],
  'users.kelola': ['pemilik'],
  'pengaturan.kelola': ['pemilik', 'admin'],
} as const;
export type Perm = keyof typeof PERMS;
export const can = (role: string | undefined, p: Perm) => !!role && (PERMS[p] as readonly string[]).includes(role);
export const PERM_LIST = PERMS;

/** Label ramah-pengguna untuk matriks hak akses aksi (halaman Pengguna & README). */
export const PERM_LABEL: Record<Perm, string> = {
  'pelanggan.kelola': 'Pelanggan: tambah / edit / hapus',
  'kendaraan.kelola': 'Kendaraan: tambah / edit / hapus',
  'pesanan.kelola': 'Pesanan: tambah / edit, atur teknisi',
  'pesanan.harga': 'Pesanan: tambah / edit / hapus item & harga',
  'pesanan.batal': 'Pesanan: batalkan',
  'pesanan.hapus': 'Pesanan: hapus permanen (tanpa transaksi)',
  'pesanan.semua': 'Pesanan: lihat semua (teknisi hanya tugasnya)',
  'status.semua': 'Pesanan: ubah ke semua status',
  'progres.tulis': 'Produksi: tambah / edit / hapus progres sendiri',
  'progres.kelola': 'Produksi: edit / hapus progres siapa pun',
  'bahan.pakai': 'Produksi: catat pemakaian bahan',
  'bahan.batal': 'Produksi: batalkan pemakaian bahan',
  'stok.master': 'Persediaan: tambah / edit / hapus bahan & pemasok',
  'stok.masuk': 'Persediaan: stok masuk (pembelian)',
  'stok.penyesuaian': 'Persediaan: penyesuaian / stok opname',
  'stok.lihat_biaya': 'Persediaan: lihat harga beli & nilai stok',
  'bayar.catat': 'Keuangan: tambah pembayaran',
  'bayar.hapus': 'Keuangan: edit / hapus pembayaran',
  'invoice.kelola': 'Keuangan: buat / edit / batalkan invoice',
  'biaya.kelola': 'Keuangan: tambah / edit / hapus pengeluaran',
  'kas.kelola': 'Keuangan: tambah / edit / hapus akun kas & bank',
  'dokumen.keuangan': 'PDF invoice & kuitansi',
  'dokumen.pesanan': 'PDF work order / serah terima',
  'laporan.stok': 'Laporan stok',
  'laporan.transaksi': 'Laporan transaksi',
  'laporan.labarugi': 'Laporan laba rugi',
  'laporan.piutang': 'Laporan piutang',
  'users.kelola': 'Pengguna: tambah / edit / nonaktifkan / hapus',
  'pengaturan.kelola': 'Pengaturan: edit profil bengkel',
};
