'use server';
import fs from 'fs';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePerm, audit } from '@/lib/auth';
import { one, run, seedSignatories } from '@/lib/db';
import { SIGNATORY_KODES, SIGNATORY_TITLE, SignatoryKode } from '@/lib/constants';
import { saveImage, uploadPath } from '@/lib/upload';
import { s, nowStr, withMsg } from '@/lib/util';

const BASE = '/tanda-tangan';
const MAX = 2 * 1024 * 1024;
const kodeOf = (v: string): SignatoryKode | null => ((SIGNATORY_KODES as readonly string[]).includes(v) ? (v as SignatoryKode) : null);
/** Hapus file gambar lama bila tidak dipakai baris lain. */
function dropFile(name?: string | null) {
  if (!name) return;
  const used = one('SELECT COUNT(*) n FROM signatories WHERE gambar=?', name).n;
  if (!used) fs.rmSync(uploadPath(name), { force: true });
}

export async function saveSignatory(fd: FormData) {
  const u = requirePerm('tanda-tangan.kelola');
  seedSignatories();
  const kode = kodeOf(s(fd, 'kode'));
  if (!kode) redirect(withMsg(BASE, 'err', 'Penanda tangan tidak dikenal.'));
  const back = `${BASE}?hl=${kode}`, hash = `#${kode}`;
  const nama = s(fd, 'nama').replace(/\s+/g, ' ');
  const jabatan = s(fd, 'jabatan').replace(/\s+/g, ' ');
  const aktif = kode === 'pemilik' ? 1 : (fd.get('aktif') ? 1 : 0);
  if (!nama) redirect(withMsg(back, 'err', kode === 'pemilik' ? 'Nama pemilik wajib diisi supaya blok Mengetahui/Disetujui di PDF tidak kosong.' : 'Nama wajib diisi.', hash));
  if (nama.length > 80 || jabatan.length > 60) redirect(withMsg(back, 'err', 'Nama maksimal 80 karakter, jabatan maksimal 60 karakter.', hash));
  const old = one('SELECT * FROM signatories WHERE kode=?', kode);
  let gambar: string | null = old?.gambar || null;
  const f: any = fd.get('gambar');
  if (f && typeof f !== 'string' && f.size) {
    let name: string | null = null;
    try { name = await saveImage(f, `ttd_${kode}`, MAX); } catch (e: any) { redirect(withMsg(back, 'err', e.message, hash)); }
    if (name && name.toLowerCase().endsWith('.webp')) { fs.rmSync(uploadPath(name), { force: true }); redirect(withMsg(back, 'err', 'Gambar tanda tangan harus PNG atau JPG agar dapat dicetak di PDF.', hash)); }
    if (name) gambar = name;
  } else if (fd.get('hapus_gambar')) gambar = null;
  run('UPDATE signatories SET nama=?, jabatan=?, gambar=?, aktif=?, updated_at=? WHERE kode=?', nama, jabatan || SIGNATORY_TITLE[kode], gambar, aktif, nowStr(), kode);
  if (old?.gambar && old.gambar !== gambar) dropFile(old.gambar);
  audit(u, 'UBAH', 'signatories', kode, `${nama}${gambar !== (old?.gambar || null) ? (gambar ? ' (gambar diganti)' : ' (gambar dihapus)') : ''}`);
  revalidatePath(BASE);
  redirect(withMsg(back, 'ok', `Tanda tangan ${SIGNATORY_TITLE[kode]} disimpan — langsung dipakai di PDF.`, hash));
}

export async function deleteSignatureImage(fd: FormData) {
  const u = requirePerm('tanda-tangan.kelola');
  const kode = kodeOf(s(fd, 'kode'));
  if (!kode) redirect(withMsg(BASE, 'err', 'Penanda tangan tidak dikenal.'));
  const old = one('SELECT * FROM signatories WHERE kode=?', kode);
  if (!old?.gambar) redirect(withMsg(`${BASE}?hl=${kode}`, 'err', 'Belum ada gambar tanda tangan.', `#${kode}`));
  run('UPDATE signatories SET gambar=NULL, updated_at=? WHERE kode=?', nowStr(), kode);
  dropFile(old.gambar);
  audit(u, 'HAPUS', 'signatories', kode, 'gambar tanda tangan');
  revalidatePath(BASE);
  redirect(withMsg(`${BASE}?hl=${kode}`, 'ok', `Gambar tanda tangan ${SIGNATORY_TITLE[kode]} dihapus. PDF kembali menyisakan ruang tanda tangan basah.`, `#${kode}`));
}
