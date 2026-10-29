'use server';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { requirePerm, audit } from '@/lib/auth';
import { insert, update, one, run } from '@/lib/db';
import { ROLES } from '@/lib/rbac';
import { s, nowStr, withMsg } from '@/lib/util';

export async function saveUser(fd: FormData) {
  const u = requirePerm('users.kelola');
  const id = Number(fd.get('id') || 0);
  const role = s(fd, 'role');
  if (!(ROLES as readonly string[]).includes(role)) redirect(withMsg('/users', 'err', 'Peran tidak valid.'));
  const aktif = fd.get('aktif') ? 1 : 0;
  if (id === u.id && (!aktif || role !== 'pemilik')) redirect(withMsg('/users', 'err', 'Anda tidak dapat menonaktifkan atau menurunkan peran akun sendiri.'));
  if (id) {
    const old = one('SELECT * FROM users WHERE id=?', id);
    if (!old) redirect(withMsg('/users', 'err', 'Pengguna tidak ditemukan.'));
    if (old.role === 'pemilik' && old.aktif && (role !== 'pemilik' || !aktif) && one("SELECT COUNT(*) n FROM users WHERE role='pemilik' AND aktif=1").n <= 1) redirect(withMsg('/users', 'err', 'Harus ada minimal satu pemilik aktif.'));
  }
  const pw = s(fd, 'password');
  if (pw && pw.length < 8) redirect(withMsg('/users', 'err', 'Kata sandi minimal 8 karakter.'));
  if (id) {
    const data: any = { nama: s(fd, 'nama'), role, aktif, telepon: s(fd, 'telepon') };
    if (pw) data.password_hash = bcrypt.hashSync(pw, 10);
    update('users', id, data);
    if (!aktif || pw) run('DELETE FROM sessions WHERE user_id=?', id);
    audit(u, 'UBAH', 'users', id, `${role} aktif=${aktif}${pw ? ' reset-sandi' : ''}`);
  } else {
    const username = s(fd, 'username').toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) redirect(withMsg('/users', 'err', 'Username 3–30 karakter (huruf kecil, angka, titik, garis bawah).'));
    if (one('SELECT id FROM users WHERE username=?', username)) redirect(withMsg('/users', 'err', 'Username sudah dipakai.'));
    if (!pw) redirect(withMsg('/users', 'err', 'Kata sandi wajib untuk pengguna baru.'));
    const nid = insert('users', { username, nama: s(fd, 'nama') || username, role, aktif: 1, telepon: s(fd, 'telepon'), password_hash: bcrypt.hashSync(pw, 10), created_at: nowStr() });
    audit(u, 'TAMBAH', 'users', nid, `${username} ${role}`);
  }
  redirect(withMsg('/users', 'ok', 'Pengguna disimpan.'));
}

/** Hapus pengguna. Bila sudah punya jejak transaksi/aktivitas, akun dinonaktifkan agar riwayat tetap utuh. */
export async function deleteUser(fd: FormData) {
  const u = requirePerm('users.kelola');
  const id = Number(fd.get('id'));
  const x = one('SELECT * FROM users WHERE id=?', id);
  if (!x) redirect(withMsg('/users', 'err', 'Pengguna tidak ditemukan.'));
  if (id === u.id) redirect(withMsg('/users', 'err', 'Anda tidak dapat menghapus akun sendiri.'));
  if (x.role === 'pemilik' && x.aktif && one("SELECT COUNT(*) n FROM users WHERE role='pemilik' AND aktif=1").n <= 1) redirect(withMsg('/users', 'err', 'Harus ada minimal satu pemilik aktif.'));
  const used = one(`SELECT
    (SELECT COUNT(*) FROM work_orders WHERE teknisi_id=? OR pj_id=? OR created_by=?) +
    (SELECT COUNT(*) FROM wo_status_history WHERE user_id=?) + (SELECT COUNT(*) FROM work_progress WHERE user_id=?) +
    (SELECT COUNT(*) FROM stock_movements WHERE user_id=?) + (SELECT COUNT(*) FROM material_usage WHERE user_id=?) +
    (SELECT COUNT(*) FROM payments WHERE user_id=?) + (SELECT COUNT(*) FROM expenses WHERE user_id=?) +
    (SELECT COUNT(*) FROM invoices WHERE created_by=?) n`, ...Array(10).fill(id)).n;
  run('DELETE FROM sessions WHERE user_id=?', id);
  if (used) {
    run('UPDATE users SET aktif=0 WHERE id=?', id);
    audit(u, 'NONAKTIF', 'users', id, x.username);
    redirect(withMsg('/users', 'ok', `${x.username} sudah punya riwayat transaksi, jadi akunnya dinonaktifkan (tidak bisa login) agar riwayat tetap utuh.`));
  }
  run('DELETE FROM users WHERE id=?', id);
  audit(u, 'HAPUS', 'users', id, x.username);
  redirect(withMsg('/users', 'ok', `Pengguna ${x.username} dihapus.`));
}
