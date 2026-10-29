export const rp = (n: any) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
export const num = (n: any) => (Number(n) || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export function tgl(s?: string | null) {
  if (!s) return '-';
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(s);
  return `${d} ${BULAN[m - 1]} ${y}`;
}
export function tglJam(s?: string | null) { if (!s) return '-'; return `${tgl(s)} ${String(s).slice(11, 16)}`; }
const pad = (n: number) => String(n).padStart(2, '0');
export function localDate(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function nowStr(d = new Date()) { return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
export const today = () => localDate();
export function addDays(s: string, n: number) { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return localDate(d); }
export function monthRange(d = new Date()) {
  const from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from, to: localDate(last) };
}
export function periodFromSp(sp: any) {
  const m = monthRange();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp?.from || '') ? sp.from : m.from;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp?.to || '') ? sp.to : m.to;
  return { from, to };
}
export const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
export const n = (fd: FormData, k: string) => { const v = Number(String(fd.get(k) ?? '').replace(/[^0-9.\-]/g, '')); return isFinite(v) ? v : 0; };
export const q = (msg: string) => encodeURIComponent(msg);
/** Tambahkan pesan flash ke URL (aman untuk URL yang sudah berisi query). */
export const safePath = (url: string) => (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\') ? url : '/dashboard');
export const withMsg = (url: string, kind: 'ok' | 'err', msg: string, extra = '') => safePath(url).split('#')[0] + (safePath(url).includes('?') ? '&' : '?') + kind + '=' + encodeURIComponent(msg) + extra;
