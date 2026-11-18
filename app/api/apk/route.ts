import fs from 'fs';
import { APK_FILE, APK_PATH } from '@/lib/apk';
export const dynamic = 'force-dynamic';
// Unduhan APK Android bersifat publik (ditautkan dari halaman login, tanpa perlu masuk).
export async function GET() {
  if (!fs.existsSync(APK_PATH)) return new Response('APK belum tersedia', { status: 404 });
  const buf = fs.readFileSync(APK_PATH);
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="${APK_FILE}"`,
      'Content-Length': String(buf.length),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
