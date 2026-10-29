'use server';
import { redirect } from 'next/navigation';
import { requirePerm, audit } from '@/lib/auth';
import { insert, update, one, run } from '@/lib/db';
import { saveImage } from '@/lib/upload';
import { s, n, q, nowStr } from '@/lib/util';

export async function saveVehicle(fd: FormData) {
  const u = requirePerm('kendaraan.kelola');
  const id = Number(fd.get('id') || 0);
  const back = id ? `/kendaraan/${id}` : '/kendaraan';
  const data: any = { customer_id: Number(fd.get('customer_id')), nopol: s(fd, 'nopol').toUpperCase(), merek: s(fd, 'merek'), tipe: s(fd, 'tipe'), tahun: n(fd, 'tahun') || null, warna: s(fd, 'warna'), no_rangka: s(fd, 'no_rangka'), kondisi: s(fd, 'kondisi') };
  if (!data.customer_id || !data.nopol) redirect(`${back}?err=${q('Pelanggan dan nomor polisi wajib diisi.')}`);
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
  if (one('SELECT COUNT(*) n FROM work_orders WHERE vehicle_id=?', id).n) redirect(`/kendaraan/${id}?err=${q('Kendaraan memiliki riwayat pesanan sehingga tidak dapat dihapus.')}`);
  run('DELETE FROM vehicles WHERE id=?', id);
  audit(u, 'HAPUS', 'vehicles', id);
  redirect(`/kendaraan?ok=${q('Kendaraan dihapus.')}`);
}
