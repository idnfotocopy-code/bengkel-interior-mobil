'use server';
import { redirect } from 'next/navigation';
import { requirePerm, audit } from '@/lib/auth';
import { insert } from '@/lib/db';
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
