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
  'pelanggan.kelola': ['pemilik', 'admin'],
  'kendaraan.kelola': ['pemilik', 'admin'],
  'pesanan.kelola': ['pemilik', 'admin'],          // buat/ubah pesanan, item, teknisi
  'pesanan.harga': ['pemilik', 'admin'],           // ubah harga (admin: sesuai izin)
  'pesanan.batal': ['pemilik'],                    // batalkan pesanan
  'pesanan.semua': ['pemilik', 'admin', 'keuangan', 'gudang'], // lihat semua pesanan (teknisi hanya tugasnya)
  'status.semua': ['pemilik', 'admin'],
  'progres.tulis': ['pemilik', 'admin', 'teknisi'],
  'bahan.pakai': ['pemilik', 'admin', 'gudang', 'teknisi'],
  'bahan.batal': ['pemilik', 'gudang'],
  'stok.master': ['pemilik', 'gudang'],
  'stok.masuk': ['pemilik', 'gudang', 'admin'],
  'stok.penyesuaian': ['pemilik', 'gudang'],
  'stok.lihat_biaya': ['pemilik', 'keuangan', 'gudang', 'admin'],
  'bayar.catat': ['pemilik', 'keuangan', 'admin'],
  'bayar.hapus': ['pemilik', 'keuangan'],
  'invoice.kelola': ['pemilik', 'keuangan', 'admin'],
  'biaya.kelola': ['pemilik', 'keuangan'],
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
