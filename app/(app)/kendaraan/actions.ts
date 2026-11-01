'use server';
import { redirect } from 'next/navigation';
import { requirePerm, audit } from '@/lib/auth';
import { insert, update, one, run } from '@/lib/db';
import { saveImage } from '@/lib/upload';
import { s, n, q, nowStr } from '@/lib/util';
import { guardRow } from '@/lib/branch';

/** Kendaraan ikut cabang pemiliknya (pelanggan). */
const vehBranch = (id: number) => one('SELECT c.branch_id FROM vehicles v JOIN customers c ON c.id=v.customer_id WHERE v.id=?', id)?.branch_id;

export async function saveVehicle(fd: FormData) {
  const u = requirePerm('kendaraan.kelola');
  const id = Number(fd.get('id') || 0);
  const back = id ? `/kendaraan/${id}` : '/kendaraan';
  const data: any = { customer_id: Number(fd.get('customer_id')), nopol: s(fd, 'nopol').toUpperCase(), merek: s(fd, 'merek'), tipe: s(fd, 'tipe'), tahun: n(fd, 'tahun') || null, warna: s(fd, 'warna'), no_rangka: s(fd, 'no_rangka'), kondisi: s(fd, 'kondisi') };
  if (!data.customer_id || !data.nopol) redirect(`${back}?err=${q('Pelanggan dan nomor polisi wajib diisi.')}`);
  guardRow(u, 'customers', data.customer_id, back);
  if (id) { const vb = vehBranch(id); const cb = one('SELECT branch_id FROM customers WHERE id=?', data.customer_id)?.branch_id; if (vb != null && cb !== vb) redirect(`${back}?err=${q('Pemilik baru harus pelanggan dari cabang yang sama dengan kendaraan ini.')}`); }
  let foto: string | null = null;
  try { foto = await saveImage(fd.get('foto'), 'kendaraan'); } catch (e: any) { redirect(`${back}?err=${q(e.message)}`); }
  if (foto) data.foto = foto;
  if (id) { update('vehicles', id, data); audit(u, 'UBAH', 'vehicles', id, data.nopol); redirect(`/kendaraan/${id}?ok=${q('Data kendaraan disimpan.')}`); }
  const newId = insert('vehicles', { ...data, created_at: nowStr() });
  audit(u, 'TAMBAH', 'vehicles', newId, data.nopol);
  redirect(`/kendaraan/${newId}?ok=${q('Kendaraan ditambahkan.')}`);
}
export async function deleteVehicle(fd: FormData) {
  const u = requirePerm('kendaraan.kelola');
  const id = Number(fd.get('id'));
  const back = s(fd, 'back') === '/kendaraan' ? '/kendaraan' : `/kendaraan/${id}`;
  const vb = vehBranch(id); if (vb != null) guardRow(u, 'customers', one('SELECT customer_id FROM vehicles WHERE id=?', id).customer_id, back);
  if (one('SELECT COUNT(*) n FROM work_orders WHERE vehicle_id=?', id).n) redirect(`${back}?err=${q('Kendaraan memiliki riwayat pesanan sehingga tidak dapat dihapus.')}`);
  run('DELETE FROM vehicles WHERE id=?', id);
  audit(u, 'HAPUS', 'vehicles', id);
  redirect(`/kendaraan?ok=${q('Kendaraan dihapus.')}`);
}
