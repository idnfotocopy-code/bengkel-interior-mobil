import bcrypt from 'bcryptjs';
import { db, insert, DEFAULT_SETTINGS, setSetting, seedJobTypes } from './db';
import { nowStr } from './util';

/**
 * Data awal untuk database baru (siap pakai, tanpa data contoh/demo).
 * - Pengaturan bawaan + master jenis pekerjaan bawaan
 * - Satu akun pemilik (username `pemilik`, password awal `password123` — segera ganti di Pengguna & Role)
 * - Satu akun kas "Kas Tunai" dengan saldo awal 0
 */
export function seed() {
  const d = db();
  d.transaction(() => {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) setSetting(k, v);
    seedJobTypes(d);
    insert('users', { username: 'pemilik', nama: 'Pemilik', role: 'pemilik', password_hash: bcrypt.hashSync('password123', 10), aktif: 1, created_at: nowStr() });
    insert('cash_accounts', { nama: 'Kas Tunai', jenis: 'kas', saldo_awal: 0 });
  })();
}
