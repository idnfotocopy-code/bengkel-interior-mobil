import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { one, run, insert } from './db';
import { nowStr } from './util';
import { canMenu, can, MenuKey, Perm } from './rbac';

export type User = { id: number; nama: string; username: string; role: string };
export const COOKIE = 'bim_sid';

export function currentUser(): User | null {
  const t = cookies().get(COOKIE)?.value;
  if (!t) return null;
  const u = one<User>('SELECT u.id,u.nama,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? AND u.aktif=1', t, Date.now());
  return u || null;
}
export function requireUser(menu?: MenuKey): User {
  const u = currentUser();
  if (!u) redirect('/login');
  if (menu && !canMenu(u.role, menu)) redirect('/dashboard?err=' + encodeURIComponent('Anda tidak memiliki hak akses ke menu tersebut.'));
  return u;
}
/** Untuk server action: lempar ke dashboard bila tidak berhak. */
export function requirePerm(p: Perm): User {
  const u = currentUser();
  if (!u) redirect('/login');
  if (!can(u.role, p)) redirect('/dashboard?err=' + encodeURIComponent('Akses ditolak untuk aksi ini.'));
  return u;
}
export function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString('hex');
  insert('sessions', { token, user_id: userId, expires_at: Date.now() + 1000 * 60 * 60 * 12 });
  run('UPDATE users SET last_login=? WHERE id=?', nowStr(), userId);
  run('DELETE FROM sessions WHERE expires_at<?', Date.now());
  return token;
}
export function destroySession() {
  const t = cookies().get(COOKIE)?.value;
  if (t) run('DELETE FROM sessions WHERE token=?', t);
}
export function audit(u: { id: number; username: string } | null, aksi: string, entitas = '', entitas_id: any = '', detail = '') {
  insert('audit_logs', { user_id: u?.id || null, username: u?.username || '-', aksi, entitas, entitas_id: String(entitas_id ?? ''), detail, at: nowStr() });
}
