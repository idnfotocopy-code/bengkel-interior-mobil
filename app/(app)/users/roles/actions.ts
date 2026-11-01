'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser, audit } from '@/lib/auth';
import { db, one } from '@/lib/db';
import { can, ALL_PERMS, MENUS, LOCKED_PERMS, LOCKED_MENUS, ALWAYS_MENUS, ROLES, defaultCan, defaultMenu, ensureRbac, clearRbacCache, roleKodes, roleRow } from '@/lib/rbac';
import { s, nowStr, withMsg } from '@/lib/util';

const BASE = '/users/roles';
const COLORS = ['slate', 'violet', 'sky', 'green', 'amber', 'orange', 'red', 'teal'];
/** Pemilik, atau peran yang diberi menu Hak akses + izin kelola pengguna (mis. admin/owner yang disamakan dengan pemilik). */
const owner = () => { const u = requireUser('hak-akses'); if (u.role !== 'pemilik' && !can(u.role, 'users.kelola')) redirect(withMsg('/dashboard', 'err', 'Butuh izin "Pengguna: kelola" untuk mengubah hak akses.')); ensureRbac(); return u; };
const done = (msg: string) => { clearRbacCache(); revalidatePath('/', 'layout'); redirect(withMsg(BASE, 'ok', msg)); };

/** Simpan seluruh matriks (centang perm × role dan menu × role). Pemilik tidak disimpan — selalu akses penuh. */
export async function saveMatrix(fd: FormData) {
  const u = owner();
  const roles = roleKodes().filter(r => r !== 'pemilik');
  const d = db();
  let nP = 0, nM = 0;
  d.transaction(() => {
    for (const r of roles) {
      d.prepare('DELETE FROM role_perms WHERE role=?').run(r);
      d.prepare('DELETE FROM role_menus WHERE role=?').run(r);
      for (const p of ALL_PERMS) if (!LOCKED_PERMS.includes(p) && fd.get(`p|${r}|${p}`)) { d.prepare('INSERT INTO role_perms(role,perm) VALUES(?,?)').run(r, p); nP++; }
      for (const m of MENUS) if (!LOCKED_MENUS.includes(m.key) && (ALWAYS_MENUS.includes(m.key) || fd.get(`m|${r}|${m.key}`))) { d.prepare('INSERT INTO role_menus(role,menu) VALUES(?,?)').run(r, m.key); nM++; }
    }
  })();
  audit(u, 'UBAH', 'hak_akses', '', `matriks disimpan: ${nP} izin, ${nM} menu untuk ${roles.length} peran`);
  done('Matriks hak akses disimpan dan langsung berlaku.');
}

/** Kembalikan satu peran dasar (atau semua) ke matriks bawaan aplikasi. */
export async function resetMatrix(fd: FormData) {
  const u = owner();
  const target = s(fd, 'kode'); // dari kartu peran (hidden kode); kosong = semua peran dasar
  const roles = (target ? [target] : roleKodes()).filter(r => r !== 'pemilik' && (ROLES as readonly string[]).includes(r));
  if (!roles.length) redirect(withMsg(BASE, 'err', 'Hanya peran dasar yang punya pengaturan bawaan.'));
  const d = db();
  d.transaction(() => {
    for (const r of roles) {
      d.prepare('DELETE FROM role_perms WHERE role=?').run(r);
      d.prepare('DELETE FROM role_menus WHERE role=?').run(r);
      for (const p of ALL_PERMS) if (!LOCKED_PERMS.includes(p) && defaultCan(r, p)) d.prepare('INSERT INTO role_perms(role,perm) VALUES(?,?)').run(r, p);
      for (const m of MENUS) if (!LOCKED_MENUS.includes(m.key) && (defaultMenu(r, m.key) || ALWAYS_MENUS.includes(m.key))) d.prepare('INSERT INTO role_menus(role,menu) VALUES(?,?)').run(r, m.key);
    }
  })();
  audit(u, 'UBAH', 'hak_akses', target, `reset ke bawaan: ${roles.join(', ')}`);
  done(`Hak akses ${roles.join(', ')} dikembalikan ke bawaan.`);
}

/** Samakan satu peran (bawaan: admin) dengan pemilik: semua menu & aksi dicentang. Tetap bisa diubah lagi di matriks. */
export async function samakanDenganPemilik(fd: FormData) {
  const u = owner();
  const kode = s(fd, 'kode') || 'admin';
  if (kode === 'pemilik' || !roleRow(kode)) redirect(withMsg(BASE, 'err', 'Peran tidak valid.'));
  const d = db();
  d.transaction(() => {
    d.prepare('DELETE FROM role_perms WHERE role=?').run(kode);
    d.prepare('DELETE FROM role_menus WHERE role=?').run(kode);
    for (const p of ALL_PERMS) d.prepare('INSERT INTO role_perms(role,perm) VALUES(?,?)').run(kode, p);
    for (const m of MENUS) d.prepare('INSERT INTO role_menus(role,menu) VALUES(?,?)').run(kode, m.key);
  })();
  audit(u, 'UBAH', 'hak_akses', kode, `disamakan dengan pemilik: ${ALL_PERMS.length} izin, ${MENUS.length} menu`);
  done(`Hak akses ${roleRow(kode)!.label} sekarang sama dengan pemilik (semua menu & aksi). Masih bisa diubah di matriks.`);
}

/** Ganti label tampilan / keterangan / warna peran (kode tetap). */
export async function saveRoleInfo(fd: FormData) {
  const u = owner();
  const kode = s(fd, 'kode');
  if (!roleRow(kode)) redirect(withMsg(BASE, 'err', 'Peran tidak ditemukan.'));
  const label = s(fd, 'label').slice(0, 40);
  if (!label) redirect(withMsg(BASE, 'err', 'Label peran wajib diisi.'));
  const warna = COLORS.includes(s(fd, 'warna')) ? s(fd, 'warna') : 'slate';
  db().prepare('UPDATE roles SET label=?, deskripsi=?, warna=? WHERE kode=?').run(label, s(fd, 'deskripsi').slice(0, 300), warna, kode);
  audit(u, 'UBAH', 'roles', kode, `label=${label}`);
  done(`Peran "${label}" disimpan (kode tetap: ${kode}).`);
}

/** Tambah peran custom; izin disalin dari peran lain (opsional). */
export async function addRole(fd: FormData) {
  const u = owner();
  const kode = s(fd, 'kode').toLowerCase();
  const label = s(fd, 'label').slice(0, 40);
  if (!/^[a-z][a-z0-9_]{2,19}$/.test(kode)) redirect(withMsg(BASE, 'err', 'Kode peran 3–20 karakter: huruf kecil, angka, garis bawah, diawali huruf.'));
  if (!label) redirect(withMsg(BASE, 'err', 'Label peran wajib diisi.'));
  if (roleRow(kode) || kode === 'pemilik') redirect(withMsg(BASE, 'err', `Kode "${kode}" sudah dipakai.`));
  const from = s(fd, 'salin');
  const d = db();
  d.transaction(() => {
    const max = (one('SELECT COALESCE(MAX(urutan),0) m FROM roles').m as number) + 10;
    d.prepare('INSERT INTO roles(kode,label,deskripsi,warna,builtin,urutan,created_at) VALUES(?,?,?,?,0,?,?)').run(kode, label, s(fd, 'deskripsi').slice(0, 300), COLORS.includes(s(fd, 'warna')) ? s(fd, 'warna') : 'slate', max, nowStr());
    if (from && from !== 'pemilik' && roleRow(from)) {
      d.prepare('INSERT INTO role_perms(role,perm) SELECT ?, perm FROM role_perms WHERE role=?').run(kode, from);
      d.prepare('INSERT INTO role_menus(role,menu) SELECT ?, menu FROM role_menus WHERE role=?').run(kode, from);
    }
    for (const m of ALWAYS_MENUS) d.prepare('INSERT OR IGNORE INTO role_menus(role,menu) VALUES(?,?)').run(kode, m);
  })();
  audit(u, 'TAMBAH', 'roles', kode, `${label}${from ? ' salin dari ' + from : ''}`);
  done(`Peran "${label}" ditambahkan. Atur centangnya di matriks lalu Simpan.`);
}

/** Hapus peran custom (peran dasar tidak bisa dihapus; harus tidak dipakai akun mana pun). */
export async function deleteRole(fd: FormData) {
  const u = owner();
  const kode = s(fd, 'kode');
  const r = roleRow(kode);
  if (!r) redirect(withMsg(BASE, 'err', 'Peran tidak ditemukan.'));
  if (r!.builtin) redirect(withMsg(BASE, 'err', 'Peran dasar tidak dapat dihapus.'));
  const n = one('SELECT COUNT(*) n FROM users WHERE role=?', kode).n;
  if (n) redirect(withMsg(BASE, 'err', `Peran masih dipakai ${n} akun — pindahkan akun tersebut ke peran lain dulu.`));
  const d = db();
  d.transaction(() => {
    d.prepare('DELETE FROM role_perms WHERE role=?').run(kode);
    d.prepare('DELETE FROM role_menus WHERE role=?').run(kode);
    d.prepare('DELETE FROM roles WHERE kode=?').run(kode);
  })();
  audit(u, 'HAPUS', 'roles', kode, r!.label);
  done(`Peran "${r!.label}" dihapus.`);
}
