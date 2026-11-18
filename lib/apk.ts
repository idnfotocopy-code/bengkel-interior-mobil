import fs from 'fs';
import path from 'path';

/** File APK Android disimpan di public/download (tidak masuk git; ikut paket deploy). */
export const APK_FILE = 'bengkel-interior-mobil.apk';
export const APK_DIR = path.join(process.cwd(), 'public', 'download');
export const APK_PATH = path.join(APK_DIR, APK_FILE);

export type ApkInfo = { versionName: string; versionCode: number; size: number; sizeLabel: string; updated: string; package: string };

/** Info APK (versi dari apk.json, ukuran dari file). null bila APK belum tersedia. */
export function apkInfo(): ApkInfo | null {
  try {
    if (!fs.existsSync(APK_PATH)) return null;
    const st = fs.statSync(APK_PATH);
    let meta: any = {};
    try { meta = JSON.parse(fs.readFileSync(path.join(APK_DIR, 'apk.json'), 'utf8')); } catch {}
    const mb = st.size / 1024 / 1024;
    return {
      versionName: String(meta.versionName || '1.0.0'),
      versionCode: Number(meta.versionCode || 1),
      package: String(meta.package || 'com.idnindonesia.bengkelinterior'),
      size: st.size,
      sizeLabel: mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(st.size / 1024))} KB`,
      updated: String(meta.updated || st.mtime.toISOString().slice(0, 10)),
    };
  } catch { return null; }
}
