import fs from 'fs';
import path from 'path';
import { settings } from '@/lib/db';
import { uploadPath } from '@/lib/upload';
export const dynamic = 'force-dynamic';
// Logo usaha bersifat publik (dipakai di halaman login).
export async function GET() {
  const p = uploadPath(settings().logo);
  if (!p || !fs.existsSync(p)) return new Response('Not found', { status: 404 });
  const ext = path.extname(p).toLowerCase();
  return new Response(new Uint8Array(fs.readFileSync(p)), { headers: { 'Content-Type': ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg', 'Cache-Control': 'no-store' } });
}
