'use server';
import fs from 'fs';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requirePerm, audit, COOKIE } from '@/lib/auth';
import { wipeTransaksi, WIPE_PHRASE } from '@/lib/backup';
import { setSetting, settings, DEFAULT_SETTINGS } from '@/lib/db';
import { saveImage, uploadPath } from '@/lib/upload';
import { s, withMsg } from '@/lib/util';

export async function saveSettings(fd: FormData) {
  const u = requirePerm('pengaturan.kelola');
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (k === 'logo') continue;
    if (fd.has(k)) setSetting(k, s(fd, k));
  }
  const f: any = fd.get('logo');
  if (f && typeof f !== 'string' && f.size) {
    let name: string | null = null;
    try { name = await saveImage(f, 'logo', 2 * 1024 * 1024); } catch (e: any) { redirect(withMsg('/pengaturan', 'err', e.message)); }
    if (name && name.endsWith('.webp')) { fs.rmSync(uploadPath(name), { force: true }); redirect(withMsg('/pengaturan', 'err', 'Logo harus PNG atau JPG agar dapat dicetak di PDF.')); }
    if (name) setSetting('logo', name);
  }
  if (fd.get('hapus_logo')) setSetting('logo', '');
  audit(u, 'UBAH', 'settings', '', settings().nama_usaha);
  redirect(withMsg('/pengaturan', 'ok', 'Pengaturan disimpan.'));
}

/** Kembalikan teks pengaturan ke nilai bawaan (logo tidak disentuh). */
export async function resetSettings() {
  const u = requirePerm('pengaturan.kelola');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) if (k !== 'logo') setSetting(k, String(v));
  audit(u, 'RESET', 'settings', '', 'kembali ke bawaan');
  redirect(withMsg('/pengaturan', 'ok', 'Pengaturan dikembalikan ke nilai bawaan.'));
}

/** Hapus seluruh data transaksi (pemilik saja). Master data tetap; stok bahan di-nol-kan; semua sesi diputus. */
export async function wipeTransaksiAction(fd: FormData) {
  const u = requirePerm('data.hapus_transaksi');
  if (s(fd, 'konfirmasi').toUpperCase() !== WIPE_PHRASE) redirect(withMsg('/pengaturan', 'err', `Ketik ${WIPE_PHRASE} untuk mengonfirmasi penghapusan.`) + '#data');
  const c = wipeTransaksi();
  audit(u, 'HAPUS_TRANSAKSI', 'database', '', `${c.pesanan} pesanan, ${c.pembayaran} pembayaran, ${c.invoice} invoice, ${c.pengeluaran} pengeluaran, ${c.mutasi} mutasi stok dihapus; stok bahan di-nol-kan`);
  cookies().delete(COOKIE);
  redirect(withMsg('/login', 'ok', `Seluruh data transaksi dihapus (${c.pesanan} pesanan, ${c.pembayaran} pembayaran, ${c.invoice} invoice, ${c.pengeluaran} pengeluaran, ${c.mutasi} mutasi stok). Silakan login ulang.`));
}
