import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { all, one } from './db';
import type { User } from './auth';
import { withMsg } from './util';

export type Branch = { id: number; kode: string; nama: string; kota: string | null; alamat: string | null; telepon: string | null; aktif: number; created_at?: string };
export const BRANCH_COOKIE = 'bim_cabang';

export function listBranches(activeOnly = false): Branch[] {
  return all<Branch>(`SELECT * FROM branches ${activeOnly ? 'WHERE aktif=1' : ''} ORDER BY id`);
}
export function getBranch(id: number | null | undefined): Branch | undefined {
  if (!id) return undefined;
  return one<Branch>('SELECT * FROM branches WHERE id=?', id);
}
/** Pengguna tanpa cabang tetap (branch_id NULL, mis. pemilik) boleh berpindah cabang. */
export function canSwitchBranch(u: User) { return u.branch_id == null; }
/** Boleh mengakses data milik cabang `branchId`? */
export function canAccessBranch(u: User, branchId: number | null | undefined) { return canSwitchBranch(u) || (branchId != null && u.branch_id === branchId); }

/** Cabang aktif untuk request ini: cabang tetap milik pengguna, atau pilihan terakhir (cookie), atau cabang aktif pertama (Bekasi). */
export function activeBranch(u: User): Branch {
  if (u.branch_id != null) { const b = getBranch(u.branch_id); if (b) return b; }
  let id = 0;
  try { id = Number(cookies().get(BRANCH_COOKIE)?.value) || 0; } catch { /* di luar request */ }
  const b = id ? one<Branch>('SELECT * FROM branches WHERE id=? AND aktif=1', id) : undefined;
  return b || one<Branch>('SELECT * FROM branches WHERE aktif=1 ORDER BY id LIMIT 1') || one<Branch>('SELECT * FROM branches ORDER BY id LIMIT 1')!;
}
export function activeBranchId(u: User): number { return activeBranch(u).id; }
/** Cabang yang dapat dipilih pengguna di pemilih cabang. */
export function branchesFor(u: User): Branch[] {
  return canSwitchBranch(u) ? listBranches(true) : listBranches().filter(b => b.id === u.branch_id);
}
/** Hentikan aksi/halaman bila data milik cabang lain yang tidak boleh diakses pengguna. */
export function requireBranch(u: User, branchId: number | null | undefined, back: string) {
  if (!canAccessBranch(u, branchId)) redirect(withMsg(back, 'err', 'Data ini milik cabang lain — Anda tidak memiliki akses.'));
}
/** Cabang milik baris data tertentu (tabel yang punya kolom branch_id). */
export function rowBranch(table: 'customers' | 'work_orders' | 'materials' | 'stock_movements' | 'cash_accounts' | 'invoices' | 'payments' | 'expenses', id: number): number | null {
  return one<{ branch_id: number }>(`SELECT branch_id FROM ${table} WHERE id=?`, id)?.branch_id ?? null;
}
/** Gabungan: pastikan baris ada di cabang yang boleh diakses. */
export function guardRow(u: User, table: Parameters<typeof rowBranch>[0], id: number, back: string) {
  if (!id) return;
  const b = rowBranch(table, id);
  if (b != null) requireBranch(u, b, back);
}
export const branchLabel = (b?: Partial<Branch> | null) => b ? `${b.nama}${b.kota && b.kota !== b.nama ? ' (' + b.kota + ')' : ''}` : '-';

/** Jumlah data yang terkait dengan cabang (dipakai untuk memblokir hapus). */
export function branchUsage(id: number) {
  const c = (sql: string) => one<{ n: number }>(sql, id)?.n || 0;
  return {
    pelanggan: c('SELECT COUNT(*) n FROM customers WHERE branch_id=?'),
    pesanan: c('SELECT COUNT(*) n FROM work_orders WHERE branch_id=?'),
    bahan: c('SELECT COUNT(*) n FROM materials WHERE branch_id=?'),
    mutasi: c('SELECT COUNT(*) n FROM stock_movements WHERE branch_id=?'),
    invoice: c('SELECT COUNT(*) n FROM invoices WHERE branch_id=?'),
    pembayaran: c('SELECT COUNT(*) n FROM payments WHERE branch_id=?'),
    pengeluaran: c('SELECT COUNT(*) n FROM expenses WHERE branch_id=?'),
    // akun kas "terisi" = selain Kas Tunai kosong bawaan (punya saldo awal, nomor rekening, atau akun tambahan)
    kas: c("SELECT COUNT(*) n FROM cash_accounts WHERE branch_id=? AND (COALESCE(saldo_awal,0)<>0 OR nama<>'Kas Tunai' OR COALESCE(no_rekening,'')<>'')"),
    pengguna: c('SELECT COUNT(*) n FROM users WHERE branch_id=?'),
  };
}
