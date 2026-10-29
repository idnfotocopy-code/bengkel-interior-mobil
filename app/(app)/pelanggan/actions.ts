'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePerm, audit } from '@/lib/auth';
import { insert, update, one, run, nextCustomerCode } from '@/lib/db';
import { s, q, nowStr, today } from '@/lib/util';

export async function saveCustomer(fd: FormData) {
  const u = requirePerm('pelanggan.kelola');
  const id = Number(fd.get('id') || 0);
  const data = { nama: s(fd, 'nama'), telepon: s(fd, 'telepon'), alamat: s(fd, 'alamat'), catatan: s(fd, 'catatan'), tgl_pertama: s(fd, 'tgl_pertama') || null };
  if (!data.nama) redirect(`/pelanggan${id ? '/' + id : ''}?err=${q('Nama wajib diisi.')}`);
  if (id) { update('customers', id, data); audit(u, 'UBAH', 'customers', id, data.nama); revalidatePath('/pelanggan'); redirect(`/pelanggan/${id}?ok=${q('Data pelanggan disimpan.')}`); }
  const newId = insert('customers', { ...data, kode: nextCustomerCode(), tgl_pertama: data.tgl_pertama || today(), created_at: nowStr() });
  audit(u, 'TAMBAH', 'customers', newId, data.nama);
  redirect(`/pelanggan/${newId}?ok=${q('Pelanggan ditambahkan. Lanjutkan dengan menambah kendaraan.')}`);
}
export async function deleteCustomer(fd: FormData) {
  const u = requirePerm('pelanggan.kelola');
  const id = Number(fd.get('id'));
  const used = one('SELECT COUNT(*) n FROM work_orders WHERE customer_id=?', id).n;
  const back = s(fd, 'back') === '/pelanggan' ? '/pelanggan' : `/pelanggan/${id}`;
  if (used) redirect(`${back}?err=${q('Pelanggan memiliki riwayat pesanan sehingga tidak dapat dihapus. Batalkan/hapus pesanannya dulu.')}`);
  run('DELETE FROM vehicles WHERE customer_id=?', id);
  run('DELETE FROM customers WHERE id=?', id);
  audit(u, 'HAPUS', 'customers', id);
  redirect(`/pelanggan?ok=${q('Pelanggan dihapus.')}`);
}
