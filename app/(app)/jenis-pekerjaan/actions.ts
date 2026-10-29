'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePerm, audit } from '@/lib/auth';
import { insert, update, one, run, tx } from '@/lib/db';
import { s, nowStr, withMsg } from '@/lib/util';

const BASE = '/jenis-pekerjaan';
const refresh = () => { revalidatePath(BASE); revalidatePath('/pesanan', 'layout'); };
const backOf = (fd: FormData) => { const b = s(fd, 'back'); return b.startsWith(BASE) ? b : BASE; };

export async function saveJobType(fd: FormData) {
  const u = requirePerm('jenis.kelola');
  const id = Number(fd.get('id') || 0);
  const nama = s(fd, 'nama').replace(/\s+/g, ' ');
  const deskripsi = s(fd, 'deskripsi');
  const urutanRaw = s(fd, 'urutan');
  const back = id ? `${BASE}?edit=${id}` : BASE, hash = id ? '#edit' : '#tambah';
  if (!nama) redirect(withMsg(back, 'err', 'Nama jenis pekerjaan wajib diisi.', hash));
  if (nama.length > 80) redirect(withMsg(back, 'err', 'Nama jenis pekerjaan maksimal 80 karakter.', hash));
  const dup = one('SELECT id FROM job_types WHERE lower(nama)=lower(?) AND id!=?', nama, id);
  if (dup) redirect(withMsg(back, 'err', `Jenis pekerjaan "${nama}" sudah ada.`, hash));
  let urutan = Number(urutanRaw);
  if (!urutanRaw || !Number.isFinite(urutan)) urutan = id ? one('SELECT urutan FROM job_types WHERE id=?', id)?.urutan ?? 0 : (one('SELECT COALESCE(MAX(urutan),0) m FROM job_types').m + 10);
  let newId = id, renamed = 0;
  if (id) {
    const old = one('SELECT * FROM job_types WHERE id=?', id);
    if (!old) redirect(withMsg(BASE, 'err', 'Jenis pekerjaan tidak ditemukan.'));
    tx(() => {
      update('job_types', id, { nama, deskripsi, urutan: Math.round(urutan) });
      if (old.nama !== nama && s(fd, 'ganti_pesanan')) renamed = run('UPDATE work_orders SET jenis_pekerjaan=? WHERE jenis_pekerjaan=?', nama, old.nama).changes;
    });
    audit(u, 'UBAH', 'job_types', id, old.nama !== nama ? `${old.nama} → ${nama}${renamed ? ` (${renamed} pesanan ikut diganti)` : ''}` : nama);
  } else {
    newId = insert('job_types', { nama, deskripsi, urutan: Math.round(urutan), aktif: 1, created_at: nowStr() });
    audit(u, 'TAMBAH', 'job_types', newId, nama);
  }
  refresh();
  if (id) redirect(withMsg(`${BASE}?hl=${id}`, 'ok', `Jenis pekerjaan "${nama}" diperbarui.${renamed ? ` ${renamed} pesanan lama ikut memakai nama baru.` : ''}`));
  redirect(withMsg(`${BASE}?hl=${newId}`, 'ok', `Jenis pekerjaan "${nama}" ditambahkan dan langsung muncul di form pesanan.`));
}

export async function toggleJobType(fd: FormData) {
  const u = requirePerm('jenis.kelola');
  const id = Number(fd.get('id'));
  const j = one('SELECT * FROM job_types WHERE id=?', id);
  if (!j) redirect(withMsg(BASE, 'err', 'Jenis pekerjaan tidak ditemukan.'));
  run('UPDATE job_types SET aktif=1-aktif WHERE id=?', id);
  audit(u, j.aktif ? 'NONAKTIF' : 'AKTIF', 'job_types', id, j.nama);
  refresh();
  redirect(withMsg(backOf(fd), 'ok', j.aktif ? `"${j.nama}" dinonaktifkan; tidak muncul lagi di form pesanan baru.` : `"${j.nama}" diaktifkan kembali.`));
}

/** Hapus: permanen bila belum dipakai pesanan; bila sudah dipakai, hanya dinonaktifkan agar riwayat tetap utuh. */
export async function deleteJobType(fd: FormData) {
  const u = requirePerm('jenis.kelola');
  const id = Number(fd.get('id'));
  const j = one('SELECT * FROM job_types WHERE id=?', id);
  if (!j) redirect(withMsg(BASE, 'err', 'Jenis pekerjaan tidak ditemukan.'));
  const used = one('SELECT COUNT(*) n FROM work_orders WHERE jenis_pekerjaan=?', j.nama).n;
  if (used) {
    run('UPDATE job_types SET aktif=0 WHERE id=?', id);
    audit(u, 'NONAKTIF', 'job_types', id, `${j.nama} (dipakai ${used} pesanan)`);
    refresh();
    redirect(withMsg(backOf(fd), 'ok', `"${j.nama}" sudah dipakai ${used} pesanan, jadi dinonaktifkan (tidak dihapus permanen).`));
  }
  run('DELETE FROM job_types WHERE id=?', id);
  audit(u, 'HAPUS', 'job_types', id, j.nama);
  refresh();
  redirect(withMsg(backOf(fd), 'ok', `Jenis pekerjaan "${j.nama}" dihapus.`));
}
