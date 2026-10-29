import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { currentUser, audit, COOKIE } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { BACKUP_DIR, MAX_RESTORE_BYTES, RESTORE_PHRASE, replaceDatabase, validateBackupFile } from '@/lib/backup';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const go = (url: string) => new Response(null, { status: 303, headers: { Location: url } });
const back = (kind: 'ok' | 'err', msg: string, to = '/pengaturan') => go(`${to}?${kind}=${encodeURIComponent(msg)}#data`);

/** POST /api/restore (multipart: file, konfirmasi=PULIHKAN). Pemilik saja. */
export async function POST(req: Request) {
  const u = currentUser();
  if (!u) return go('/login');
  if (!can(u.role, 'data.restore')) return go('/dashboard?err=' + encodeURIComponent('Akses ditolak untuk aksi ini.'));
  let fd: FormData;
  try { fd = await req.formData(); } catch { return back('err', 'Upload gagal dibaca. Pastikan ukuran file ≤ 100 MB.'); }
  if (String(fd.get('konfirmasi') ?? '').trim().toUpperCase() !== RESTORE_PHRASE) return back('err', `Ketik ${RESTORE_PHRASE} untuk mengonfirmasi restore.`);
  const f: any = fd.get('file');
  if (!f || typeof f === 'string' || !f.size) return back('err', 'Pilih file backup (.db) terlebih dahulu.');
  if (f.size > MAX_RESTORE_BYTES) return back('err', 'File terlalu besar (maks 100 MB).');
  if (!/\.(db|sqlite|sqlite3)$/i.test(f.name || '')) return back('err', 'File harus berekstensi .db');
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const tmp = path.join(BACKUP_DIR, `tmp-restore-${Date.now()}.db`);
  const clean = () => { for (const e of ['', '-wal', '-shm', '-journal']) fs.rmSync(tmp + e, { force: true }); };
  let info: { users: number; pesanan: number };
  try {
    fs.writeFileSync(tmp, Buffer.from(await f.arrayBuffer()));
    info = validateBackupFile(tmp);
    for (const e of ['-wal', '-shm']) fs.rmSync(tmp + e, { force: true });
  } catch (e: any) { clean(); return back('err', e?.message || 'File backup tidak valid.'); }
  let pre = '';
  try { pre = await replaceDatabase(tmp); }
  catch (e: any) { clean(); return back('err', 'Restore gagal: ' + (e?.message || e) + '. Database lama tetap dipakai bila file belum tertimpa; cek folder data/backups.'); }
  try { audit({ id: 0, username: u.username }, 'RESTORE', 'database', '', `dari ${f.name} (${info.users} akun, ${info.pesanan} pesanan); backup sebelum restore: ${pre}`); } catch {}
  cookies().delete(COOKIE);
  return go('/login?ok=' + encodeURIComponent(`Database berhasil dipulihkan dari ${f.name}. Silakan login ulang dengan akun dari backup tersebut. Data sebelum restore disimpan di data/backups/${pre}.`));
}
