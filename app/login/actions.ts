'use server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { one } from '@/lib/db';
import { createSession, audit, destroySession, COOKIE } from '@/lib/auth';

export async function loginAction(fd: FormData) {
  const username = String(fd.get('username') || '').trim().toLowerCase();
  const password = String(fd.get('password') || '');
  const u = one('SELECT * FROM users WHERE lower(username)=?', username);
  const ok = u && u.aktif === 1 && bcrypt.compareSync(password, u.password_hash);
  if (!ok) { audit(null, 'LOGIN_GAGAL', 'users', '', username); redirect('/login?err=' + encodeURIComponent(u && u.aktif !== 1 ? 'Akun dinonaktifkan.' : 'Username atau password salah.')); }
  const token = createSession(u.id);
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12 });
  audit({ id: u.id, username: u.username }, 'LOGIN', 'users', u.id);
  redirect('/dashboard');
}
export async function logoutAction() {
  destroySession();
  cookies().delete(COOKIE);
  redirect('/login?ok=' + encodeURIComponent('Anda telah keluar.'));
}
