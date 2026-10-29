import fs from 'fs';
import path from 'path';
import { currentUser, audit } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { BACKUP_DIR, isBackupName, snapshotTo, stamp } from '@/lib/backup';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/backup → unduh salinan database saat ini. GET /api/backup?file=<nama> → unduh backup otomatis (pre-restore). Pemilik saja. */
export async function GET(req: Request) {
  const u = currentUser();
  if (!u) return new Response('Silakan login.', { status: 401 });
  if (!can(u.role, 'data.backup')) return new Response('Akses ditolak.', { status: 403 });
  const file = new URL(req.url).searchParams.get('file');
  let buf: Buffer; let name: string;
  if (file) {
    if (!isBackupName(file)) return new Response('Nama file tidak valid.', { status: 400 });
    const p = path.join(BACKUP_DIR, file);
    if (!fs.existsSync(p)) return new Response('File backup tidak ditemukan.', { status: 404 });
    buf = fs.readFileSync(p); name = file;
  } else {
    name = `bengkel-backup-${stamp()}.db`;
    const tmp = path.join(BACKUP_DIR, `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    try { await snapshotTo(tmp); buf = fs.readFileSync(tmp); }
    finally { for (const e of ['', '-wal', '-shm', '-journal']) fs.rmSync(tmp + e, { force: true }); }
    audit(u, 'BACKUP', 'database', '', name);
  }
  return new Response(new Uint8Array(buf), { headers: {
    'Content-Type': 'application/vnd.sqlite3',
    'Content-Disposition': `attachment; filename="${name}"`,
    'Content-Length': String(buf.length),
    'Cache-Control': 'no-store',
  } });
}
