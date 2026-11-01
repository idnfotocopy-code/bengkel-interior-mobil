import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { JOB_TYPES, CHECKLIST_DEFAULTS, ChecklistTipe, SIGNATORY_KODES, SIGNATORY_TITLE, SignatoryKode } from './constants';
import { nowStr } from './util';

export const ROOT = process.cwd();
export const PATHS = {
  data: path.join(ROOT, 'data'),
  db: process.env.DB_PATH || path.join(ROOT, 'data', 'bengkel.db'),
  uploads: path.join(ROOT, 'public', 'uploads'),
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, nama TEXT NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, aktif INTEGER NOT NULL DEFAULT 1, telepon TEXT, created_at TEXT, last_login TEXT);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY, kode TEXT UNIQUE, nama TEXT NOT NULL, telepon TEXT, alamat TEXT, tgl_pertama TEXT, catatan TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS vehicles(id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), nopol TEXT NOT NULL, merek TEXT, tipe TEXT, tahun INTEGER, warna TEXT, no_rangka TEXT, kondisi TEXT, foto TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS work_orders(id INTEGER PRIMARY KEY, nomor TEXT UNIQUE NOT NULL, customer_id INTEGER NOT NULL, vehicle_id INTEGER NOT NULL, jenis_pekerjaan TEXT, deskripsi TEXT, tgl_masuk TEXT, target_selesai TEXT, tgl_selesai TEXT, status TEXT NOT NULL DEFAULT 'Konsultasi', teknisi_id INTEGER, pj_id INTEGER, diskon REAL DEFAULT 0, biaya_tenaga_kerja REAL DEFAULT 0, biaya_ops REAL DEFAULT 0, catatan TEXT, kondisi_serah TEXT, created_by INTEGER, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS work_order_items(id INTEGER PRIMARY KEY, wo_id INTEGER NOT NULL, jenis TEXT NOT NULL DEFAULT 'jasa', deskripsi TEXT NOT NULL, qty REAL NOT NULL DEFAULT 1, satuan TEXT DEFAULT 'paket', harga REAL NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS wo_status_history(id INTEGER PRIMARY KEY, wo_id INTEGER NOT NULL, dari TEXT, ke TEXT NOT NULL, catatan TEXT, user_id INTEGER, at TEXT);
CREATE TABLE IF NOT EXISTS work_progress(id INTEGER PRIMARY KEY, wo_id INTEGER NOT NULL, user_id INTEGER, catatan TEXT NOT NULL, persen INTEGER, foto TEXT, at TEXT);
CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY, nama TEXT NOT NULL, telepon TEXT, alamat TEXT);
CREATE TABLE IF NOT EXISTS branches(id INTEGER PRIMARY KEY, kode TEXT UNIQUE NOT NULL, nama TEXT NOT NULL, kota TEXT, alamat TEXT, telepon TEXT, aktif INTEGER NOT NULL DEFAULT 1, created_at TEXT);
CREATE TABLE IF NOT EXISTS materials(id INTEGER PRIMARY KEY, branch_id INTEGER, kode TEXT NOT NULL, nama TEXT NOT NULL, satuan TEXT, stok REAL NOT NULL DEFAULT 0, minimum REAL NOT NULL DEFAULT 0, harga_beli REAL NOT NULL DEFAULT 0, supplier_id INTEGER, lokasi TEXT, aktif INTEGER NOT NULL DEFAULT 1, UNIQUE(branch_id, kode));
CREATE TABLE IF NOT EXISTS stock_movements(id INTEGER PRIMARY KEY, material_id INTEGER NOT NULL, tipe TEXT NOT NULL, qty REAL NOT NULL, harga REAL DEFAULT 0, wo_id INTEGER, alasan TEXT, user_id INTEGER, tanggal TEXT NOT NULL, at TEXT);
CREATE TABLE IF NOT EXISTS material_usage(id INTEGER PRIMARY KEY, wo_id INTEGER NOT NULL, material_id INTEGER NOT NULL, qty REAL NOT NULL, harga_satuan REAL NOT NULL, movement_id INTEGER, user_id INTEGER, tanggal TEXT, batal INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS cash_accounts(id INTEGER PRIMARY KEY, nama TEXT NOT NULL, jenis TEXT DEFAULT 'kas', no_rekening TEXT, saldo_awal REAL DEFAULT 0, aktif INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS invoices(id INTEGER PRIMARY KEY, nomor TEXT UNIQUE NOT NULL, wo_id INTEGER NOT NULL, tanggal TEXT NOT NULL, jatuh_tempo TEXT, total REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Belum lunas', catatan TEXT, created_by INTEGER, created_at TEXT);
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY, nomor TEXT UNIQUE NOT NULL, wo_id INTEGER, invoice_id INTEGER, tanggal TEXT NOT NULL, jenis TEXT NOT NULL, jumlah REAL NOT NULL, metode TEXT, cash_account_id INTEGER, catatan TEXT, user_id INTEGER, created_at TEXT);
CREATE TABLE IF NOT EXISTS expenses(id INTEGER PRIMARY KEY, tanggal TEXT NOT NULL, kategori TEXT NOT NULL, deskripsi TEXT, jumlah REAL NOT NULL, wo_id INTEGER, cash_account_id INTEGER, user_id INTEGER, created_at TEXT);
CREATE TABLE IF NOT EXISTS job_types(id INTEGER PRIMARY KEY, nama TEXT UNIQUE NOT NULL, deskripsi TEXT, aktif INTEGER NOT NULL DEFAULT 1, urutan INTEGER NOT NULL DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS checklist_items(id INTEGER PRIMARY KEY, tipe TEXT NOT NULL DEFAULT 'serah_terima', nama TEXT NOT NULL, deskripsi TEXT, urutan INTEGER NOT NULL DEFAULT 0, aktif INTEGER NOT NULL DEFAULT 1, created_at TEXT, UNIQUE(tipe, nama));
CREATE TABLE IF NOT EXISTS signatories(id INTEGER PRIMARY KEY, kode TEXT UNIQUE NOT NULL, nama TEXT NOT NULL, jabatan TEXT, gambar TEXT, aktif INTEGER NOT NULL DEFAULT 1, updated_at TEXT);
CREATE TABLE IF NOT EXISTS roles(kode TEXT PRIMARY KEY, label TEXT NOT NULL, deskripsi TEXT, warna TEXT, builtin INTEGER NOT NULL DEFAULT 0, urutan INTEGER NOT NULL DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS role_perms(role TEXT NOT NULL, perm TEXT NOT NULL, PRIMARY KEY(role, perm));
CREATE TABLE IF NOT EXISTS role_menus(role TEXT NOT NULL, menu TEXT NOT NULL, PRIMARY KEY(role, menu));
CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY, user_id INTEGER, username TEXT, aksi TEXT, entitas TEXT, entitas_id TEXT, detail TEXT, at TEXT);
CREATE INDEX IF NOT EXISTS ix_wo_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS ix_mov_mat ON stock_movements(material_id, tanggal);
CREATE INDEX IF NOT EXISTS ix_pay_wo ON payments(wo_id);
`;

const g = globalThis as any;
export function db(): Database.Database {
  if (!g.__bimdb) {
    fs.mkdirSync(PATHS.data, { recursive: true });
    fs.mkdirSync(PATHS.uploads, { recursive: true });
    const fresh = !fs.existsSync(PATHS.db);
    const d = new Database(PATHS.db);
    d.pragma('journal_mode = WAL');
    d.pragma('foreign_keys = ON');
    d.exec(SCHEMA);
    migrateBranches(d);
    g.__bimdb = d;
    const cnt = (d.prepare('SELECT COUNT(*) n FROM users').get() as any).n;
    if (fresh || cnt === 0) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { seed } = require('./seed');
      seed();
    }
    seedJobTypes(d);
    seedChecklist(d);
    seedSignatories(d);
  }
  return g.__bimdb;
}

/** Tabel operasional yang dipisah per cabang (kolom branch_id). */
export const BRANCH_TABLES = ['customers', 'work_orders', 'materials', 'stock_movements', 'cash_accounts', 'invoices', 'payments', 'expenses'] as const;
export const DEFAULT_BRANCHES = [
  { kode: 'BKS', nama: 'Bekasi', kota: 'Bekasi' },
  { kode: 'JKT', nama: 'Jakarta', kota: 'Jakarta' },
];

/**
 * Migrasi multi-cabang (aman dijalankan berulang):
 * - buat tabel branches + isi Bekasi & Jakarta bila kosong
 * - tambah kolom branch_id pada tabel operasional & users bila belum ada
 * - data lama dipindah ke cabang pertama (Bekasi); pemilik = semua cabang (NULL), pengguna lain = Bekasi
 * - kode bahan unik per cabang
 * - setiap cabang baru otomatis punya akun "Kas Tunai" (saldo 0)
 */
export function migrateBranches(d: Database.Database) {
  const cols = (t: string) => new Set((d.prepare(`PRAGMA table_info(${t})`).all() as any[]).map(c => c.name));
  d.transaction(() => {
    const now = nowStr();
    const newBranches: number[] = [];
    if (!(d.prepare('SELECT COUNT(*) n FROM branches').get() as any).n) {
      for (const b of DEFAULT_BRANCHES) newBranches.push(Number(d.prepare('INSERT INTO branches(kode,nama,kota,alamat,telepon,aktif,created_at) VALUES(?,?,?,?,?,1,?)').run(b.kode, b.nama, b.kota, '', '', now).lastInsertRowid));
    }
    const first = (d.prepare('SELECT id FROM branches ORDER BY id LIMIT 1').get() as any).id as number;
    // bahan: tabel lama punya UNIQUE(kode) global → bangun ulang dengan UNIQUE(branch_id,kode)
    if (!cols('materials').has('branch_id')) {
      d.pragma('foreign_keys = OFF');
      d.exec(`CREATE TABLE materials_new(id INTEGER PRIMARY KEY, branch_id INTEGER, kode TEXT NOT NULL, nama TEXT NOT NULL, satuan TEXT, stok REAL NOT NULL DEFAULT 0, minimum REAL NOT NULL DEFAULT 0, harga_beli REAL NOT NULL DEFAULT 0, supplier_id INTEGER, lokasi TEXT, aktif INTEGER NOT NULL DEFAULT 1, UNIQUE(branch_id, kode));
        INSERT INTO materials_new(id,branch_id,kode,nama,satuan,stok,minimum,harga_beli,supplier_id,lokasi,aktif) SELECT id,NULL,kode,nama,satuan,stok,minimum,harga_beli,supplier_id,lokasi,aktif FROM materials;
        DROP TABLE materials; ALTER TABLE materials_new RENAME TO materials;`);
      d.pragma('foreign_keys = ON');
    }
    for (const t of BRANCH_TABLES) {
      if (!cols(t).has('branch_id')) d.exec(`ALTER TABLE ${t} ADD COLUMN branch_id INTEGER`);
      d.prepare(`UPDATE ${t} SET branch_id=? WHERE branch_id IS NULL`).run(first);
      d.exec(`CREATE INDEX IF NOT EXISTS ix_${t}_branch ON ${t}(branch_id)`);
    }
    if (!cols('users').has('branch_id')) {
      d.exec('ALTER TABLE users ADD COLUMN branch_id INTEGER');
      d.prepare("UPDATE users SET branch_id=NULL WHERE role='pemilik'").run();
      d.prepare("UPDATE users SET branch_id=? WHERE role!='pemilik'").run(first);
    }
    for (const id of newBranches) {
      const has = (d.prepare('SELECT COUNT(*) n FROM cash_accounts WHERE branch_id=?').get(id) as any).n;
      if (!has) d.prepare("INSERT INTO cash_accounts(nama,jenis,saldo_awal,aktif,branch_id) VALUES('Kas Tunai','kas',0,1,?)").run(id);
    }
  })();
}

/** Isi master jenis pekerjaan dari daftar bawaan bila tabel masih kosong (instalasi baru / DB lama sebelum modul ini). */
export function seedJobTypes(d: Database.Database = db()) {
  const n = (d.prepare('SELECT COUNT(*) n FROM job_types').get() as any).n;
  if (n > 0) return;
  const now = nowStr();
  const ins = d.prepare('INSERT OR IGNORE INTO job_types(nama, deskripsi, aktif, urutan, created_at) VALUES(?,?,1,?,?)');
  d.transaction(() => JOB_TYPES.forEach((nama, i) => ins.run(nama, null, (i + 1) * 10, now)))();
}

/**
 * Isi master checklist (Pemeriksaan bersama & pemeriksaan kualitas) dengan daftar bawaan
 * satu kali per tipe — hanya bila tipe itu belum pernah diisi. Penanda disimpan di settings
 * agar item yang sengaja dihapus pengguna tidak muncul lagi saat aplikasi restart.
 */
export function seedChecklist(d: Database.Database = db()) {
  const now = nowStr();
  const ins = d.prepare('INSERT OR IGNORE INTO checklist_items(tipe, nama, deskripsi, urutan, aktif, created_at) VALUES(?,?,NULL,?,1,?)');
  d.transaction(() => {
    for (const [tipe, items] of Object.entries(CHECKLIST_DEFAULTS)) {
      const key = `checklist_seeded_${tipe}`;
      if (d.prepare('SELECT 1 FROM settings WHERE key=?').get(key)) continue;
      const n = (d.prepare('SELECT COUNT(*) n FROM checklist_items WHERE tipe=?').get(tipe) as any).n;
      if (!n) items.forEach((nama, i) => ins.run(tipe, nama, (i + 1) * 10, now));
      d.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, '1');
    }
  })();
}

/**
 * Isi master penanda tangan (pemilik/admin/keuangan/gudang) bila belum ada barisnya.
 * Nama awal diambil dari pengguna aktif pertama dengan peran tersebut, bila tidak ada pakai label peran.
 * Aman dijalankan berulang: baris yang sudah ada tidak disentuh.
 */
export function seedSignatories(d: Database.Database = db()) {
  const now = nowStr();
  d.transaction(() => {
    for (const kode of SIGNATORY_KODES) {
      if (d.prepare('SELECT 1 FROM signatories WHERE kode=?').get(kode)) continue;
      const u = d.prepare('SELECT nama FROM users WHERE role=? AND aktif=1 ORDER BY id LIMIT 1').get(kode) as any;
      d.prepare('INSERT INTO signatories(kode,nama,jabatan,gambar,aktif,updated_at) VALUES(?,?,?,NULL,1,?)').run(kode, (u?.nama || SIGNATORY_TITLE[kode]).trim(), SIGNATORY_TITLE[kode], now);
    }
  })();
}

export type Signatory = { kode: SignatoryKode; nama: string; jabatan: string; gambar: string | null };
/** Penanda tangan aktif untuk PDF (null bila nonaktif / tidak ada). */
export function signatory(kode: string): Signatory | null {
  if (!(SIGNATORY_KODES as readonly string[]).includes(kode)) return null;
  const r = one<any>('SELECT * FROM signatories WHERE kode=? AND aktif=1', kode);
  if (!r) return null;
  return { kode: r.kode, nama: (r.nama || '').trim(), jabatan: (r.jabatan || '').trim() || SIGNATORY_TITLE[r.kode as SignatoryKode], gambar: r.gambar || null };
}

/** Daftar checklist aktif untuk PDF; bila kosong, pakai daftar bawaan agar dokumen tidak pernah tanpa checklist. */
export function checklistFor(tipe: ChecklistTipe): string[] {
  const rows = all<{ nama: string }>('SELECT nama FROM checklist_items WHERE tipe=? AND aktif=1 ORDER BY urutan, nama', tipe).map(r => r.nama);
  return rows.length ? rows : [...CHECKLIST_DEFAULTS[tipe]];
}

export const all = <T = any>(sql: string, ...p: any[]): T[] => db().prepare(sql).all(...p) as T[];
export const one = <T = any>(sql: string, ...p: any[]): T => db().prepare(sql).get(...p) as T;
export const run = (sql: string, ...p: any[]) => db().prepare(sql).run(...p);
export function insert(table: string, obj: Record<string, any>): number {
  const keys = Object.keys(obj);
  const r = db().prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`).run(...keys.map(k => obj[k] ?? null));
  return Number(r.lastInsertRowid);
}
export function update(table: string, id: number, obj: Record<string, any>) {
  const keys = Object.keys(obj);
  if (!keys.length) return;
  db().prepare(`UPDATE ${table} SET ${keys.map(k => k + '=?').join(',')} WHERE id=?`).run(...keys.map(k => obj[k] ?? null), id);
}
export const nowStrSafe = () => nowStr();
export const tx = <T>(fn: () => T): T => db().transaction(fn)();

export const DEFAULT_SETTINGS: Record<string, string> = {
  nama_usaha: 'Bengkel Interior Mobil',
  tagline: 'Spesialis Jok, Plafon, Karpet & Restorasi Interior Mobil',
  alamat: '',
  telepon: '',
  email: '',
  kota: '',
  rekening: '',
  instruksi_bayar: 'Pembayaran dapat dilakukan tunai di bengkel atau transfer ke rekening di atas. Cantumkan nomor invoice pada berita transfer.',
  syarat_penawaran: '1. Harga dapat berubah bila ada tambahan pekerjaan yang disetujui pelanggan.\n2. Uang muka minimal 50% sebelum bahan dipesan.\n3. Garansi jahitan 6 bulan untuk pemakaian normal.',
  jatuh_tempo_hari: '7',
  masa_berlaku_hari: '14',
  logo: '',
};
export function settings(): Record<string, string> {
  const rows = all<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value ?? '';
  return out;
}
export function setSetting(key: string, value: string) {
  run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value);
}

/** Nomor berurutan: PREFIX-YYYY-#### */
export function nextNumber(prefix: string, table: string, year = new Date().getFullYear()) {
  const like = `${prefix}-${year}-%`;
  const r = one<{ m: string }>(`SELECT MAX(nomor) m FROM ${table} WHERE nomor LIKE ?`, like);
  const last = r?.m ? Number(r.m.split('-').pop()) : 0;
  return `${prefix}-${year}-${String(last + 1).padStart(4, '0')}`;
}
export function nextCustomerCode() {
  const r = one<{ m: number }>("SELECT MAX(CAST(substr(kode,5) AS INTEGER)) m FROM customers WHERE kode LIKE 'PLG-%'");
  return `PLG-${String((r?.m || 0) + 1).padStart(4, '0')}`;
}
