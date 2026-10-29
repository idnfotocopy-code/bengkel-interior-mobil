import fs from 'fs';
import path from 'path';
import { currentUser } from '@/lib/auth';
import { uploadPath } from '@/lib/upload';
export const dynamic = 'force-dynamic';
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
// Foto disajikan lewat route ber-login (pembatasan akses foto pelanggan) dan tetap berfungsi pada `next start`.
export async function GET(_: Request, { params }: { params: { name: string } }) {
  if (!currentUser()) return new Response('Unauthorized', { status: 401 });
  const p = uploadPath(params.name);
  if (!p || !fs.existsSync(p)) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(p)), { headers: { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'private, max-age=3600' } });
}
