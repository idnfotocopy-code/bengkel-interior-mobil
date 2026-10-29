import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { PATHS, db, one, tx } from './db';

export const BACKUP_DIR = path.join(path.dirname(PATHS.db), 'backups');
export const MAX_RESTORE_BYTES = 100 * 1024 * 1024;
export const RESTORE_PHRASE = 'PULIHKAN';
export const WIPE_PHRASE = 'HAPUS TRANSAKSI';

/** Cap waktu lokal server: YYYYMMDD-HHmmss */
export function stamp(d = new Date()) {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Salinan DB yang konsisten (SQLite online backup API, isi WAL ikut). Mengembalikan path file sementara/tujuan. */
export async function snapshotTo(dest: string) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const d = db();
  try { d.pragma('wal_checkpoint(TRUNCATE)'); } catch { /* abaikan bila sedang sibuk */ }
  await d.backup(dest);
  return dest;
}

/** Nama file backup otomatis yang aman untuk diunduh. */
export const isBackupName = (n: string) => /^[A-Za-z0-9._-]+\.db$/.test(n) && !n.includes('..');
export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [] as { name: string; size: number; mtime: Date }[];
  return fs.readdirSync(BACKUP_DIR).filter(isBackupName).filter(n => !n.startsWith('tmp-'))
    .map(name => { const st = fs.statSync(path.join(BACKUP_DIR, name)); return { name, size: st.size, mtime: st.mtime }; })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

class BackupError extends Error {}

/** Validasi file SQLite hasil upload. Lempar Error berbahasa Indonesia bila tidak valid. */
export function validateBackupFile(file: string) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(16);
  fs.readSync(fd, head, 0, 16, 0);
  fs.closeSync(fd);
  if (head.toString('latin1') !== 'SQLite format 3\u0000') throw new BackupError('File bukan database SQLite yang valid.');
  let d: Database.Database | null = null;
  try {
    d = new Database(file, { readonly: true, fileMustExist: true });
    const ok = (d.pragma('quick_check', { simple: true }) as any);
    if (ok !== 'ok') throw new BackupError('File database rusak (quick_check: ' + ok + ').');
    const tables = new Set((d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).map(r => r.name));
    if (!tables.has('users') || !(tables.has('work_orders') || tables.has('settings'))) throw new BackupError('File ini bukan backup aplikasi Bengkel (tabel users / work_orders / settings tidak ada).');
    const users = (d.prepare('SELECT COUNT(*) n FROM users').get() as any).n;
    if (!users) throw new BackupError('Backup tidak berisi akun pengguna — restore dibatalkan.');
    return { users, pesanan: tables.has('work_orders') ? (d.prepare('SELECT COUNT(*) n FROM work_orders').get() as any).n : 0 };
  } catch (e: any) {
    if (e instanceof BackupError) throw e;
    throw new Error('Database tidak dapat dibuka: ' + (e?.message || e));
  } finally { d?.close(); }
}

/** Ganti DB aktif dengan file `src` (sudah divalidasi). Membuat backup pre-restore dulu. */
export async function replaceDatabase(src: string) {
  const pre = path.join(BACKUP_DIR, `pre-restore-${stamp()}.db`);
  if (fs.existsSync(PATHS.db)) await snapshotTo(pre);
  const g = globalThis as any;
  if (g.__bimdb) { try { g.__bimdb.pragma('wal_checkpoint(TRUNCATE)'); } catch {} try { g.__bimdb.close(); } catch {} g.__bimdb = undefined; }
  for (const ext of ['-wal', '-shm', '-journal']) fs.rmSync(PATHS.db + ext, { force: true });
  fs.copyFileSync(src, PATHS.db);
  fs.rmSync(src, { force: true });
  // Buka ulang: skema yang belum ada dibuat otomatis, sesi lama diputus agar semua login ulang.
  const d = db();
  d.prepare('DELETE FROM sessions').run();
  return path.basename(pre);
}

/** Tabel transaksi yang dikosongkan (urutan aman FK). */
export const TRANSAKSI_TABLES = ['work_order_items', 'wo_status_history', 'work_progress', 'material_usage', 'stock_movements', 'payments', 'invoices', 'expenses', 'work_orders', 'audit_logs', 'sessions'] as const;

export function transaksiCounts() {
  const c = (t: string) => (one<{ n: number }>(`SELECT COUNT(*) n FROM ${t}`)?.n || 0);
  return { pesanan: c('work_orders'), pembayaran: c('payments'), invoice: c('invoices'), pengeluaran: c('expenses'), mutasi: c('stock_movements'), progres: c('work_progress'), pemakaian: c('material_usage'), log: c('audit_logs') };
}

/** Hapus seluruh data transaksi; master (pengguna, pengaturan, pelanggan, kendaraan, pemasok, bahan, akun kas, jenis pekerjaan) tetap. */
export function wipeTransaksi() {
  const before = transaksiCounts();
  tx(() => {
    for (const t of TRANSAKSI_TABLES) db().prepare(`DELETE FROM ${t}`).run();
    db().prepare('UPDATE materials SET stok=0').run();
  });
  try { db().pragma('wal_checkpoint(TRUNCATE)'); } catch {}
  return before;
}
