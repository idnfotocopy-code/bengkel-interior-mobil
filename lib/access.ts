import { redirect } from 'next/navigation';
import { one } from './db';
import { can } from './rbac';
import type { User } from './auth';
import { canAccessBranch } from './branch';

/** Ambil WO & pastikan user boleh melihatnya (teknisi: hanya yang ditugaskan). */
export function woForUser(u: User, id: number, back = '/pesanan') {
  const wo = one('SELECT * FROM work_orders WHERE id=?', id);
  if (!wo) redirect(`${back}?err=${encodeURIComponent('Pesanan tidak ditemukan.')}`);
  if (!canAccessBranch(u, wo.branch_id)) redirect(`${back}?err=${encodeURIComponent('Pesanan ini milik cabang lain — Anda tidak memiliki akses.')}`);
  if (!can(u.role, 'pesanan.semua') && wo.teknisi_id !== u.id) redirect(`/produksi?err=${encodeURIComponent('Pesanan ini tidak ditugaskan kepada Anda.')}`);
  return wo;
}
