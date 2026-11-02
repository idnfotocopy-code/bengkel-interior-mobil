'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePerm, audit } from '@/lib/auth';
import fs from 'fs';
import { insert, update, one, run, tx, JOB_PHOTO_COLS } from '@/lib/db';
import { saveImage, uploadPath } from '@/lib/upload';
import { s, nowStr, withMsg } from '@/lib/util';

const MAX_FOTO = 3 * 1024 * 1024;
/** Hapus file foto bila tidak dipakai lagi oleh jenis pekerjaan lain. */
function dropFile(name?: string | null) {
  if (!name) return;
  const used = one(`SELECT COUNT(*) n FROM job_types WHERE ${JOB_PHOTO_COLS.map(c => `${c}=?`).join(' OR ')}`, ...JOB_PHOTO_COLS.map(() => name)).n;
  if (!used) fs.rmSync(uploadPath(name), { force: true });
}

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
  const old = id ? one('SELECT * FROM job_types WHERE id=?', id) : null;
  if (id && !old) redirect(withMsg(BASE, 'err', 'Jenis pekerjaan tidak ditemukan.'));
  // Foto sampel (maks. 3): unggah baru menggantikan slot, centang hapus mengosongkan slot.
  const fotos: Record<string, string | null> = {}, saved: string[] = [];
  for (const c of JOB_PHOTO_COLS) {
    let v: string | null = old?.[c] || null;
    const f: any = fd.get(c);
    if (f && typeof f !== 'string' && f.size) {
      let name: string | null = null;
      try { name = await saveImage(f, 'sampel', MAX_FOTO); } catch (e: any) { saved.forEach(n => fs.rmSync(uploadPath(n), { force: true })); redirect(withMsg(back, 'err', e.message, hash)); }
      if (name && name.toLowerCase().endsWith('.webp')) { fs.rmSync(uploadPath(name), { force: true }); saved.forEach(n => fs.rmSync(uploadPath(n), { force: true })); redirect(withMsg(back, 'err', 'Foto sampel harus PNG atau JPG agar dapat dicetak di PDF.', hash)); }
      if (name) { v = name; saved.push(name); }
    } else if (fd.get(`hapus_${c}`)) v = null;
    fotos[c] = v;
  }
  // rapatkan slot supaya foto selalu berurutan foto → foto2 → foto3
  const packed = JOB_PHOTO_COLS.map(c => fotos[c]).filter(Boolean) as string[];
  JOB_PHOTO_COLS.forEach((c, i) => { fotos[c] = packed[i] || null; });
  if (id) {
    tx(() => {
      update('job_types', id, { nama, deskripsi, urutan: Math.round(urutan), ...fotos });
      if (old.nama !== nama && s(fd, 'ganti_pesanan')) renamed = run('UPDATE work_orders SET jenis_pekerjaan=? WHERE jenis_pekerjaan=?', nama, old.nama).changes;
    });
    for (const c of JOB_PHOTO_COLS) if (old[c] && !packed.includes(old[c])) dropFile(old[c]);
    audit(u, 'UBAH', 'job_types', id, (old.nama !== nama ? `${old.nama} → ${nama}${renamed ? ` (${renamed} pesanan ikut diganti)` : ''}` : nama) + (saved.length || JOB_PHOTO_COLS.some(c => (old[c] || null) !== fotos[c]) ? ` (foto sampel: ${packed.length})` : ''));
  } else {
    newId = insert('job_types', { nama, deskripsi, urutan: Math.round(urutan), aktif: 1, created_at: nowStr(), ...fotos });
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
  for (const c of JOB_PHOTO_COLS) dropFile(j[c]);
  audit(u, 'HAPUS', 'job_types', id, j.nama);
  refresh();
  redirect(withMsg(backOf(fd), 'ok', `Jenis pekerjaan "${j.nama}" dihapus.`));
}
