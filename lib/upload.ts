import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PATHS } from './db';

/** Simpan gambar ke public/uploads. Return nama file, null bila kosong; lempar Error bila tidak valid. */
export async function saveImage(file: any, prefix: string, max = 4 * 1024 * 1024): Promise<string | null> {
  if (!file || typeof file === 'string' || !file.size) return null;
  const ext = path.extname(file.name || '').toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) throw new Error('Format foto harus PNG/JPG/WEBP.');
  if (file.size > max) throw new Error(`Ukuran foto maksimal ${Math.round(max / 1024 / 1024)} MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const isPng = buf.slice(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  const isWebp = buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
  if (!(isPng || isJpg || isWebp)) throw new Error('Isi file bukan gambar yang valid.');
  const name = `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`;
  fs.mkdirSync(PATHS.uploads, { recursive: true });
  fs.writeFileSync(path.join(PATHS.uploads, name), buf);
  return name;
}
export const uploadUrl = (name?: string | null) => (name ? `/api/file/${encodeURIComponent(name)}` : '');
export const uploadPath = (name?: string | null) => (name ? path.join(PATHS.uploads, path.basename(name)) : '');
