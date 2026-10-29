'use server';
import { redirect } from 'next/navigation';
import { requirePerm, audit } from '@/lib/auth';
import { insert, update, one, run } from '@/lib/db';
import { can } from '@/lib/rbac';
import { woForUser } from '@/lib/access';
import { saveImage } from '@/lib/upload';
import { s, nowStr, withMsg } from '@/lib/util';

export async function addProgress(fd: FormData) {
  const u = requirePerm('progres.tulis');
  const wo = woForUser(u, Number(fd.get('wo_id')), '/produksi');
  const back = s(fd, 'back') || '/produksi';
  const catatan = s(fd, 'catatan');
  if (!catatan) redirect(withMsg(back, 'err', 'Catatan progres wajib diisi.'));
  let foto: string | null = null;
  try { foto = await saveImage(fd.get('foto'), 'progres'); } catch (e: any) { redirect(withMsg(back, 'err', e.message)); }
  const p = s(fd, 'persen');
  const persen = p === '' ? null : Math.max(0, Math.min(100, Math.round(Number(p) || 0)));
  insert('work_progress', { wo_id: wo.id, user_id: u.id, catatan, persen, foto, at: nowStr() });
  audit(u, 'PROGRES', 'work_orders', wo.id, catatan);
  redirect(withMsg(back, 'ok', `Progres ${wo.nomor} dicatat.`));
}

function progressFor(fd: FormData) {
  const u = requirePerm('progres.tulis');
  const id = Number(fd.get('id'));
  const back = s(fd, 'back') || '/produksi';
  const p = one('SELECT * FROM work_progress WHERE id=?', id);
  if (!p) redirect(withMsg(back, 'err', 'Catatan progres tidak ditemukan.'));
  const wo = woForUser(u, p.wo_id, '/produksi');
  if (!can(u.role, 'progres.kelola') && p.user_id !== u.id) redirect(withMsg(back, 'err', 'Anda hanya boleh mengubah/menghapus catatan progres milik sendiri.'));
  return { u, p, wo, back };
}

export async function updateProgress(fd: FormData) {
  const { u, p, wo, back } = progressFor(fd);
  const catatan = s(fd, 'catatan');
  if (!catatan) redirect(withMsg(back, 'err', 'Catatan progres wajib diisi.'));
  const ps = s(fd, 'persen');
  const persen = ps === '' ? null : Math.max(0, Math.min(100, Math.round(Number(ps) || 0)));
  let foto: string | null = p.foto;
  try { foto = (await saveImage(fd.get('foto'), 'progres')) || p.foto; } catch (e: any) { redirect(withMsg(back, 'err', e.message)); }
  if (s(fd, 'hapus_foto') === '1') foto = null;
  update('work_progress', p.id, { catatan, persen, foto });
  audit(u, 'UBAH_PROGRES', 'work_orders', wo.id, `${p.catatan} → ${catatan}`);
  redirect(withMsg(back, 'ok', `Catatan progres ${wo.nomor} diperbarui.`));
}

export async function deleteProgress(fd: FormData) {
  const { u, p, wo, back } = progressFor(fd);
  run('DELETE FROM work_progress WHERE id=?', p.id);
  audit(u, 'HAPUS_PROGRES', 'work_orders', wo.id, p.catatan);
  redirect(withMsg(back, 'ok', `Catatan progres ${wo.nomor} dihapus.`));
}
