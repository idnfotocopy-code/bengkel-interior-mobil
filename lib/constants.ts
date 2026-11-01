export const WO_STATUSES = [
  'Konsultasi', 'Penawaran', 'Menunggu persetujuan', 'Menunggu uang muka', 'Menunggu bahan',
  'Siap dikerjakan', 'Sedang dikerjakan', 'Pemeriksaan kualitas', 'Siap diserahkan', 'Selesai',
] as const;
export const WO_CANCELLED = 'Dibatalkan';
export const TEKNISI_STATUSES = ['Sedang dikerjakan', 'Pemeriksaan kualitas', 'Siap diserahkan'];
export const STATUS_COLOR: Record<string, string> = {
  'Konsultasi': 'slate', 'Penawaran': 'sky', 'Menunggu persetujuan': 'violet', 'Menunggu uang muka': 'amber', 'Menunggu bahan': 'orange',
  'Siap dikerjakan': 'teal', 'Sedang dikerjakan': 'sky', 'Pemeriksaan kualitas': 'violet', 'Siap diserahkan': 'teal', 'Selesai': 'green', 'Dibatalkan': 'red',
};
export const EXPENSE_CATEGORIES = ['Pembelian bahan', 'Tenaga kerja', 'Listrik & air', 'Transportasi', 'Peralatan', 'Sewa tempat', 'Operasional lain'];
export const PAYMENT_TYPES = ['DP', 'Pembayaran tahap', 'Pelunasan', 'Jasa tambahan', 'Pendapatan lain'];
export const PAYMENT_METHODS = ['Tunai', 'Transfer bank', 'QRIS', 'Debit/Kartu'];
/** Daftar bawaan untuk mengisi master `job_types` pertama kali. Daftar aktif dikelola di menu Jenis pekerjaan. */
export const JOB_TYPES = ['Retrim jok kulit', 'Retrim jok sintetis', 'Ganti plafon', 'Pasang karpet dasar', 'Cover setir', 'Doortrim', 'Restorasi interior klasik', 'Peredam suara', 'Lainnya'];

/** Master checklist PDF. `serah_terima` = Pemeriksaan bersama (Surat Serah Terima), `kualitas` = Checklist pemeriksaan kualitas (Work Order). */
export const CHECKLIST_TIPE = { serah_terima: 'Pemeriksaan bersama (Surat Serah Terima)', kualitas: 'Pemeriksaan kualitas (Work Order)' } as const;
export type ChecklistTipe = keyof typeof CHECKLIST_TIPE;
/** Daftar bawaan untuk mengisi master `checklist_items` pertama kali. */
export const CHECKLIST_DEFAULTS: Record<ChecklistTipe, readonly string[]> = {
  serah_terima: ['Hasil pekerjaan sesuai pesanan', 'Kebersihan kabin', 'Barang pribadi pelanggan lengkap', 'Kunci & STNK diterima kembali'],
  kualitas: ['Jahitan rapi & kuat', 'Warna/material sesuai pesanan', 'Pemasangan presisi, tidak bergelombang', 'Fungsi jok/sabuk/kelistrikan normal', 'Kabin bersih dari sisa bahan'],
};

/** Master penanda tangan PDF (menu Tanda tangan). Kode tetap, satu baris per peran. */
export const SIGNATORY_KODES = ['pemilik', 'admin', 'keuangan', 'gudang'] as const;
export type SignatoryKode = typeof SIGNATORY_KODES[number];
/** Judul blok tanda tangan bawaan per kode (dipakai juga untuk mencocokkan blok PDF). */
export const SIGNATORY_TITLE: Record<SignatoryKode, string> = { pemilik: 'Pemilik', admin: 'Admin', keuangan: 'Bagian Keuangan', gudang: 'Bagian Gudang' };
