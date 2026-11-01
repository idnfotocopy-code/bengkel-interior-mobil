import bcrypt from 'bcryptjs';
import { db, insert, DEFAULT_SETTINGS, setSetting, seedJobTypes, seedChecklist } from './db';
import { nowStr } from './util';

/**
 * Data awal untuk database baru (siap pakai, tanpa data contoh/demo).
 * - Pengaturan bawaan + master jenis pekerjaan bawaan + master checklist (Pemeriksaan bersama & kualitas) bawaan
 * - Satu akun pemilik (username `pemilik`, password awal `password123` — segera ganti di Pengguna & Role)
 * - Dua cabang bawaan (Bekasi & Jakarta) — dibuat oleh migrasi cabang di lib/db.ts
 * - Satu akun kas "Kas Tunai" (saldo awal 0) per cabang
 */
export function seed() {
  const d = db();
  d.transaction(() => {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) setSetting(k, v);
    seedJobTypes(d);
    seedChecklist(d);
    insert('users', { username: 'pemilik', nama: 'Pemilik', role: 'pemilik', password_hash: bcrypt.hashSync('password123', 10), aktif: 1, branch_id: null, created_at: nowStr() });
    // pastikan tiap cabang punya Kas Tunai
    for (const b of d.prepare('SELECT id FROM branches').all() as any[]) {
      const n = (d.prepare('SELECT COUNT(*) n FROM cash_accounts WHERE branch_id=?').get(b.id) as any).n;
      if (!n) insert('cash_accounts', { nama: 'Kas Tunai', jenis: 'kas', saldo_awal: 0, branch_id: b.id });
    }
  })();
}
