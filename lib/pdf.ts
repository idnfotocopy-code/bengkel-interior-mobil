import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { settings, one, all, signatory } from './db';
import { SIGNATORY_TITLE } from './constants';
import { uploadPath } from './upload';
import { tgl, tglJam, nowStr } from './util';

export type Doc = PDFKit.PDFDocument;
export const M = 45;
export const PW = 595.28;
export const CW = PW - M * 2;
export const BRAND = '#5b4330';
export const BRAND_LIGHT = '#efe9e2';

export function createDoc(title: string, landscape = false): Doc {
  const doc = new PDFDocument({ size: 'A4', layout: landscape ? 'landscape' : 'portrait', margins: { top: 40, bottom: 60, left: M, right: M }, bufferPages: true, info: { Title: title, Author: 'idnindonesia @nickibnu', Creator: '© 2026 idnindonesia @nickibnu' } });
  doc.font('Helvetica');
  return doc;
}
/** Tandai dokumen dengan cabangnya: kop, kota tanda tangan, dan footer memakai data cabang (fallback ke Pengaturan usaha). */
export function setDocBranch(doc: Doc, branchId: number | null | undefined) {
  (doc as any).__branch = branchId ? one('SELECT * FROM branches WHERE id=?', branchId) : null;
  return doc;
}
const docBranch = (doc: Doc): any => (doc as any).__branch || null;
/** Identitas efektif dokumen: identitas usaha global + alamat/telepon/kota cabang bila diisi. */
function ident(doc: Doc): Record<string, any> {
  const s: Record<string, any> = settings(); const b = docBranch(doc);
  return { ...s, alamat: (b?.alamat || s.alamat || ''), telepon: (b?.telepon || s.telepon || ''), kota: (b?.kota || s.kota || ''), cabang: b ? `Cabang ${b.nama}${b.kota && b.kota !== b.nama ? ' — ' + b.kota : ''}` : '' };
}
const pageW = (doc: Doc) => doc.page.width;
const cw = (doc: Doc) => pageW(doc) - M * 2;

/** Kop dokumen: logo + identitas usaha + judul dokumen di kanan. */
export function kop(doc: Doc, title: string, meta: [string, string][] = []) {
  const s = ident(doc);
  const top = 36; const W = pageW(doc);
  const logo = uploadPath(s.logo);
  let x = M;
  if (logo && fs.existsSync(logo) && !logo.endsWith('.webp')) { try { doc.image(logo, M, top, { fit: [60, 60] }); x = M + 70; } catch {} }
  else { doc.roundedRect(M, top, 56, 56, 8).fill(BRAND); doc.fillColor('#fff').font('Helvetica-Bold').fontSize(20).text('BIM', M, top + 18, { width: 56, align: 'center' }); x = M + 66; }
  const leftW = W - M - x - 200;
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(15).text(s.nama_usaha, x, top, { width: leftW });
  doc.fillColor('#555').font('Helvetica-Oblique').fontSize(8).text(s.tagline || '', x, doc.y + 1, { width: leftW });
  if (s.cabang) doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(8.5).text(s.cabang, x, doc.y + 1, { width: leftW });
  doc.font('Helvetica').fontSize(8).fillColor('#333').text(s.alamat || '', x, doc.y + 2, { width: leftW });
  doc.text([s.telepon && `Telp/WA ${s.telepon}`, s.email].filter(Boolean).join(' • '), x, doc.y, { width: leftW });
  const leftBottom = doc.y;
  // judul kanan
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(16).text(title.toUpperCase(), W - M - 200, top, { width: 200, align: 'right' });
  doc.font('Helvetica').fontSize(8.5).fillColor('#222');
  for (const [k, v] of meta) { const y = doc.y + 1; doc.font('Helvetica').text(k, W - M - 200, y, { width: 95, align: 'right' }); doc.font('Helvetica-Bold').text(v || '-', W - M - 100, y, { width: 100, align: 'right' }); }
  const y = Math.max(leftBottom, doc.y, top + 60) + 8;
  doc.moveTo(M, y).lineTo(W - M, y).lineWidth(2).strokeColor(BRAND).stroke();
  doc.lineWidth(1).strokeColor('#000').fillColor('#000');
  doc.x = M; doc.y = y + 12;
}

export function heading(doc: Doc, text: string, sub?: string) {
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#000').text(text, M, doc.y, { width: cw(doc), align: 'center' });
  if (sub) doc.font('Helvetica').fontSize(9.5).fillColor('#333').text(sub, M, doc.y + 1, { width: cw(doc), align: 'center' });
  doc.fillColor('#000').moveDown(0.8); doc.x = M;
}
export function section(doc: Doc, text: string) {
  if (doc.y > doc.page.height - 120) doc.addPage();
  doc.moveDown(0.3);
  const y = doc.y;
  doc.rect(M, y, cw(doc), 16).fill(BRAND_LIGHT);
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(9.5).text(text.toUpperCase(), M + 6, y + 4, { width: cw(doc) - 12 });
  doc.fillColor('#000'); doc.y = y + 22; doc.x = M;
}

/** Dua kolom data kiri/kanan (mis. pelanggan & kendaraan). */
export function twoCol(doc: Doc, left: { title: string; rows: [string, string][] }, right: { title: string; rows: [string, string][] }) {
  const W = cw(doc), half = (W - 14) / 2, y0 = doc.y;
  const block = (x: number, b: { title: string; rows: [string, string][] }) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND).text(b.title.toUpperCase(), x, y0, { width: half });
    doc.fillColor('#000');
    for (const [k, v] of b.rows) { const y = doc.y + 1.5; doc.font('Helvetica').fontSize(9).fillColor('#555').text(k, x, y, { width: 78 }); doc.fillColor('#000').text(v || '-', x + 80, y, { width: half - 80 }); doc.y = Math.max(doc.y, y + 11); }
    return doc.y;
  };
  const a = block(M, left); const b = block(M + half + 14, right);
  doc.y = Math.max(a, b) + 8; doc.x = M;
}

export function kv(doc: Doc, rows: [string, string][], labelW = 140, x = M) {
  doc.fontSize(9.5).font('Helvetica');
  for (const [k, v] of rows) {
    const y = doc.y;
    doc.text(k, x, y, { width: labelW }); doc.text(':', x + labelW, y);
    doc.text(v || '-', x + labelW + 10, y, { width: cw(doc) - labelW - 10 - (x - M) });
    doc.y = Math.max(doc.y, y + 13) + 1;
  }
  doc.x = M;
}

export type Col = { h: string; w: number; align?: 'left' | 'right' | 'center' };
export function table(doc: Doc, cols: Col[], rows: string[][], opts: { total?: string[][]; fontSize?: number } = {}) {
  const fs_ = opts.fontSize || 8.5;
  const W = cw(doc);
  const totalW = cols.reduce((a, c) => a + c.w, 0);
  const ws = cols.map(c => (c.w * W) / totalW);
  const drawRow = (cells: string[], kind: 'head' | 'row' | 'total', zebra = false) => {
    const bold = kind !== 'row';
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs_);
    const h = Math.max(16, ...cells.map((c, i) => doc.heightOfString(c ?? '', { width: ws[i] - 8 }) + 7));
    if (doc.y + h > doc.page.height - 70) { doc.addPage(); doc.y = 45; if (kind !== 'head') drawRow(cols.map(c => c.h), 'head'); doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs_); }
    const y = doc.y; let x = M;
    if (kind === 'head') doc.rect(M, y, W, h).fill(BRAND);
    else if (kind === 'total') doc.rect(M, y, W, h).fill(BRAND_LIGHT);
    else if (zebra) doc.rect(M, y, W, h).fill('#faf8f6');
    cells.forEach((c, i) => {
      doc.rect(x, y, ws[i], h).lineWidth(0.4).strokeColor('#b9aa9b').stroke();
      doc.fillColor(kind === 'head' ? '#fff' : '#000').text(c ?? '', x + 4, y + 4, { width: ws[i] - 8, align: cols[i].align || 'left' });
      x += ws[i];
    });
    doc.y = y + h; doc.x = M;
  };
  drawRow(cols.map(c => c.h), 'head');
  rows.forEach((r, i) => drawRow(r, 'row', i % 2 === 1));
  if (!rows.length) { doc.font('Helvetica-Oblique').fontSize(9).fillColor('#555').text('Tidak ada data.', M + 4, doc.y + 4); doc.fillColor('#000'); }
  (opts.total || []).forEach(t => drawRow(t, 'total'));
  doc.moveDown(0.6); doc.strokeColor('#000').fillColor('#000');
}

/** Ringkasan angka rata kanan (subtotal/total/sisa). */
export function totals(doc: Doc, rows: [string, string, boolean?][], width = 250) {
  const x = pageW(doc) - M - width;
  for (const [k, v, strong] of rows) {
    const y = doc.y;
    if (strong) doc.rect(x, y - 2, width, 17).fill(BRAND_LIGHT).fillColor('#000');
    doc.font(strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(strong ? 10.5 : 9.5).text(k, x + 6, y + 1, { width: width / 2 }).text(v, x + width / 2, y + 1, { width: width / 2 - 6, align: 'right' });
    doc.y = y + 17;
  }
  doc.x = M; doc.moveDown(0.4);
}

export function paragraph(doc: Doc, text: string, size = 9.5) { doc.font('Helvetica').fontSize(size).fillColor('#000').text(text, M, doc.y, { width: cw(doc), align: 'justify' }); doc.moveDown(0.5); }
export function note(doc: Doc, text: string) { doc.font('Helvetica-Oblique').fontSize(8).fillColor('#444').text(text, M, doc.y, { width: cw(doc) }); doc.fillColor('#000').font('Helvetica'); doc.moveDown(0.5); }
export function box(doc: Doc, title: string, text: string) {
  if (doc.y > doc.page.height - 130) doc.addPage();
  const y = doc.y; const W = cw(doc);
  doc.font('Helvetica').fontSize(8.5);
  const h = doc.heightOfString(text, { width: W - 16 }) + 26;
  doc.roundedRect(M, y, W, h, 4).lineWidth(0.6).strokeColor('#b9aa9b').stroke();
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND).text(title, M + 8, y + 6, { width: W - 16 });
  doc.font('Helvetica').fontSize(8.5).fillColor('#000').text(text, M + 8, doc.y + 2, { width: W - 16 });
  doc.y = y + h + 8; doc.x = M; doc.strokeColor('#000');
}

export type SignBlock = { label?: string; title: string; name?: string; image?: string | null };
/** Gambar tanda tangan yang bisa dicetak (PNG/JPG). `img` = nama file upload atau path absolut. */
function signImagePath(img?: string | null): string {
  if (!img) return '';
  const p = path.isAbsolute(img) ? img : uploadPath(img);
  if (!p || !/\.(png|jpe?g)$/i.test(p)) return '';
  try { fs.accessSync(p, fs.constants.R_OK); return p; } catch { return ''; }
}
export function signatures(doc: Doc, blocks: SignBlock[], place?: string) {
  if (doc.y > doc.page.height - 170) doc.addPage();
  const W = cw(doc); const w = W / blocks.length; let y0 = doc.y + 8;
  if (place) { doc.font('Helvetica').fontSize(9.5).text(place, M, y0, { width: W, align: 'right' }); y0 = doc.y + 6; }
  blocks.forEach((b, i) => {
    if (!b.title.trim()) return;
    const x = M + i * w;
    doc.font('Helvetica').fontSize(9.5).fillColor('#000');
    doc.text(b.label || ' ', x, y0, { width: w, align: 'center' });
    doc.text(b.title, x, doc.y, { width: w, align: 'center' });
    const top = doc.y + 2; const bottom = y0 + 78;
    const img = signImagePath(b.image);
    if (img && bottom - top > 20) {
      const iw = Math.min(110, w - 10), ih = Math.min(50, bottom - top);
      try { doc.image(img, x + (w - iw) / 2, bottom - ih, { fit: [iw, ih], align: 'center', valign: 'bottom' }); } catch { /* gambar rusak: biarkan ruang kosong untuk tanda tangan basah */ }
    }
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000').text(b.name || '(.................................)', x, y0 + 80, { width: w, align: 'center', underline: !!b.name });
  });
  doc.font('Helvetica'); doc.x = M; doc.y = y0 + 105;
}

const eqName = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
/** Blok tanda tangan dari master Tanda tangan (nama + gambar). Bila penanda tangan nonaktif/kosong, pakai `fallbackName`. */
export function signBlock(kode: string, label: string, opts: { title?: string; fallbackName?: string } = {}): SignBlock {
  const s = signatory(kode);
  const title = opts.title || s?.jabatan || (SIGNATORY_TITLE as any)[kode] || kode;
  if (!s) return { label, title, name: opts.fallbackName || '' };
  // nama masih label bawaan (belum diisi di menu Tanda tangan) → pakai nama pencetak bila ada
  const unset = !s.nama || eqName(s.nama, (SIGNATORY_TITLE as any)[kode]);
  return { label, title, name: unset && opts.fallbackName ? opts.fallbackName : s.nama, image: s.gambar };
}
/**
 * Blok untuk orang tertentu (mis. penanggung jawab / penerima pembayaran): nama orang tetap dipakai,
 * gambar tanda tangan dilampirkan bila ada penanda tangan aktif dengan nama yang sama, atau dari peran orang tersebut.
 */
export function personBlock(label: string, title: string, name: string, role?: string | null): SignBlock {
  const rows = all<any>('SELECT kode, nama, gambar FROM signatories WHERE aktif=1');
  const byName = rows.find(r => eqName(r.nama, name));
  if (byName) return { label, title, name, image: byName.gambar };
  const byRole = role ? rows.find(r => r.kode === role) : null;
  return { label, title, name, image: byRole?.gambar || null };
}

/** Gambar foto (PNG/JPG) yang bisa dibaca pdfkit; '' bila tidak ada / format lain. */
function printableImage(name?: string | null): string {
  const p = uploadPath(name);
  if (!p || !/\.(png|jpe?g)$/i.test(p)) return '';
  try { fs.accessSync(p, fs.constants.R_OK); return p; } catch { return ''; }
}
/**
 * Bagian "Sampel pekerjaan": foto contoh dari master Jenis pekerjaan (maks. 3), di tengah halaman
 * dengan keterangan nama jenis. Dilewati diam-diam bila tidak ada file yang bisa dicetak.
 */
export function samplePhotos(doc: Doc, info: { nama: string; deskripsi?: string; fotos: string[] } | null) {
  if (!info) return;
  const files = info.fotos.map(printableImage).filter(Boolean).slice(0, 3);
  if (!files.length) return;
  const W = cw(doc), gap = 12, n = files.length;
  const iw = Math.min(n === 1 ? 220 : 200, (W - gap * (n - 1)) / n), ih = n === 1 ? 160 : 130;
  if (doc.y + 22 + ih + 30 > doc.page.height - 70) doc.addPage();
  section(doc, `Sampel pekerjaan — ${info.nama}`);
  const y = doc.y, totalW = iw * n + gap * (n - 1); let x = M + (W - totalW) / 2;
  for (const f of files) {
    try { doc.image(f, x, y, { fit: [iw, ih], align: 'center', valign: 'center' }); } catch { /* file rusak: lewati */ }
    doc.rect(x, y, iw, ih).lineWidth(0.4).strokeColor('#d6ccc2').stroke();
    x += iw + gap;
  }
  doc.strokeColor('#000');
  doc.font('Helvetica-Oblique').fontSize(8).fillColor('#444').text(`Contoh hasil pekerjaan: ${info.nama}${info.deskripsi ? ' — ' + info.deskripsi : ''}. Foto sebagai ilustrasi, hasil akhir menyesuaikan kendaraan & bahan.`, M, y + ih + 5, { width: W, align: 'center' });
  doc.fillColor('#000').font('Helvetica'); doc.x = M; doc.moveDown(0.6);
}
/** Versi kecil (thumbnail) untuk invoice. */
export function sampleThumb(doc: Doc, info: { nama: string; fotos: string[] } | null) {
  if (!info) return;
  const f = info.fotos.map(printableImage).find(Boolean);
  if (!f) return;
  const ih = 60, iw = 90;
  if (doc.y + ih + 10 > doc.page.height - 70) return;
  const y = doc.y;
  try { doc.image(f, M, y, { fit: [iw, ih], align: 'center', valign: 'center' }); } catch { return; }
  doc.rect(M, y, iw, ih).lineWidth(0.4).strokeColor('#d6ccc2').stroke().strokeColor('#000');
  doc.font('Helvetica-Oblique').fontSize(8).fillColor('#444').text(`Sampel pekerjaan: ${info.nama}`, M + iw + 8, y + ih / 2 - 5, { width: cw(doc) - iw - 8 });
  doc.fillColor('#000').font('Helvetica'); doc.x = M; doc.y = y + ih + 8;
}

export function finalize(doc: Doc, info: { by: string; docNo?: string }): Promise<Buffer> {
  const s = ident(doc);
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const mb = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    const W = pageW(doc); const y = doc.page.height - 42;
    doc.moveTo(M, y - 4).lineTo(W - M, y - 4).lineWidth(0.4).strokeColor('#999').stroke();
    doc.font('Helvetica').fontSize(7).fillColor('#555');
    doc.text(`Dicetak: ${tglJam(nowStr())} WIB oleh ${info.by}${info.docNo ? ' • No. Dok: ' + info.docNo : ''}`, M, y, { width: W - M * 2 - 80, lineBreak: false });
    doc.text(`Hal. ${i + 1}/${range.count}`, W - M - 80, y, { width: 80, align: 'right', lineBreak: false });
    doc.text([s.nama_usaha + (s.cabang ? ' — ' + s.cabang : ''), s.alamat, s.telepon].filter(Boolean).join(' • '), M, y + 10, { width: W - M * 2, lineBreak: false });
    doc.page.margins.bottom = mb;
  }
  doc.fillColor('#000');
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export function placeDate(doc: Doc, dateStr?: string) { return `${ident(doc).kota || 'Jakarta'}, ${tgl(dateStr || nowStr())}`; }
export function pdfResponse(buf: Buffer, filename: string) {
  return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename.replace(/[^\w.\-]/g, '_')}"`, 'Cache-Control': 'no-store' } });
}

/** Terbilang (Rupiah) untuk kuitansi. */
export function terbilang(n: number): string {
  const a = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  n = Math.floor(Math.abs(n));
  const f = (x: number): string => {
    if (x < 12) return a[x];
    if (x < 20) return f(x - 10) + ' belas';
    if (x < 100) return f(Math.floor(x / 10)) + ' puluh ' + f(x % 10);
    if (x < 200) return 'seratus ' + f(x - 100);
    if (x < 1000) return f(Math.floor(x / 100)) + ' ratus ' + f(x % 100);
    if (x < 2000) return 'seribu ' + f(x - 1000);
    if (x < 1e6) return f(Math.floor(x / 1000)) + ' ribu ' + f(x % 1000);
    if (x < 1e9) return f(Math.floor(x / 1e6)) + ' juta ' + f(x % 1e6);
    if (x < 1e12) return f(Math.floor(x / 1e9)) + ' miliar ' + f(x % 1e9);
    return f(Math.floor(x / 1e12)) + ' triliun ' + f(x % 1e12);
  };
  const r = f(n).replace(/\s+/g, ' ').trim();
  return (r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Nol') + ' rupiah';
}
