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
