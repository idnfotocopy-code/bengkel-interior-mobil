'use server';
import fs from 'fs';
import { redirect } from 'next/navigation';
import { requirePerm, audit } from '@/lib/auth';
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
