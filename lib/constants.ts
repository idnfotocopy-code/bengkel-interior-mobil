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
