'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePerm, audit } from '@/lib/auth';
import { insert, update, one, run } from '@/lib/db';
import { CHECKLIST_TIPE, ChecklistTipe } from '@/lib/constants';
import { s, nowStr, withMsg } from '@/lib/util';

const BASE = '/checklist';
const refresh = () => revalidatePath(BASE);
const backOf = (fd: FormData) => { const b = s(fd, 'back'); return b.startsWith(BASE) ? b : BASE; };
const tipeOf = (v: string): ChecklistTipe => (v in CHECKLIST_TIPE ? v : 'serah_terima') as ChecklistTipe;

export async function saveChecklist(fd: FormData) {
  const u = requirePerm('checklist.kelola');
  const id = Number(fd.get('id') || 0);
  const tipe = tipeOf(s(fd, 'tipe'));
  const nama = s(fd, 'nama').replace(/\s+/g, ' ');
  const deskripsi = s(fd, 'deskripsi');
  const urutanRaw = s(fd, 'urutan');
  const back = id ? `${BASE}?tipe=${tipe}&edit=${id}` : `${BASE}?tipe=${tipe}`, hash = id ? '#edit' : '#tambah';
  if (!nama) redirect(withMsg(back, 'err', 'Nama item pemeriksaan wajib diisi.', hash));
  if (nama.length > 100) redirect(withMsg(back, 'err', 'Nama item pemeriksaan maksimal 100 karakter.', hash));
  const dup = one('SELECT id FROM checklist_items WHERE tipe=? AND lower(nama)=lower(?) AND id!=?', tipe, nama, id);
  if (dup) redirect(withMsg(back, 'err', `Item "${nama}" sudah ada.`, hash));
  let urutan = Number(urutanRaw);
  if (!urutanRaw || !Number.isFinite(urutan)) urutan = id ? one('SELECT urutan FROM checklist_items WHERE id=?', id)?.urutan ?? 0 : (one('SELECT COALESCE(MAX(urutan),0) m FROM checklist_items WHERE tipe=?', tipe).m + 10);
  let newId = id;
  if (id) {
    const old = one('SELECT * FROM checklist_items WHERE id=?', id);
    if (!old) redirect(withMsg(BASE, 'err', 'Item pemeriksaan tidak ditemukan.'));
    update('checklist_items', id, { tipe, nama, deskripsi, urutan: Math.round(urutan) });
    audit(u, 'UBAH', 'checklist_items', id, old.nama !== nama ? `${old.nama} → ${nama}` : nama);
  } else {
    newId = insert('checklist_items', { tipe, nama, deskripsi, urutan: Math.round(urutan), aktif: 1, created_at: nowStr() });
    audit(u, 'TAMBAH', 'checklist_items', newId, `${tipe}: ${nama}`);
  }
  refresh();
  redirect(withMsg(`${BASE}?tipe=${tipe}&hl=${newId}`, 'ok', id ? `Item "${nama}" diperbarui.` : `Item "${nama}" ditambahkan dan langsung tampil di PDF.`));
}

export async function toggleChecklist(fd: FormData) {
  const u = requirePerm('checklist.kelola');
  const id = Number(fd.get('id'));
  const c = one('SELECT * FROM checklist_items WHERE id=?', id);
  if (!c) redirect(withMsg(BASE, 'err', 'Item pemeriksaan tidak ditemukan.'));
  run('UPDATE checklist_items SET aktif=1-aktif WHERE id=?', id);
  audit(u, c.aktif ? 'NONAKTIF' : 'AKTIF', 'checklist_items', id, c.nama);
  refresh();
  redirect(withMsg(backOf(fd), 'ok', c.aktif ? `"${c.nama}" dinonaktifkan; tidak tampil lagi di PDF.` : `"${c.nama}" diaktifkan kembali.`));
}

/** Hapus permanen — item checklist tidak terikat ke data transaksi (dicetak kosong lalu dicentang tangan). */
export async function deleteChecklist(fd: FormData) {
  const u = requirePerm('checklist.kelola');
  const id = Number(fd.get('id'));
  const c = one('SELECT * FROM checklist_items WHERE id=?', id);
  if (!c) redirect(withMsg(BASE, 'err', 'Item pemeriksaan tidak ditemukan.'));
  run('DELETE FROM checklist_items WHERE id=?', id);
  audit(u, 'HAPUS', 'checklist_items', id, `${c.tipe}: ${c.nama}`);
  refresh();
  redirect(withMsg(backOf(fd), 'ok', `Item "${c.nama}" dihapus.`));
}
