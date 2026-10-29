import { NextRequest } from 'next/server';
import { currentUser } from '@/lib/auth';
import { can, Perm } from '@/lib/rbac';
import { one } from '@/lib/db';
import { pdfResponse } from '@/lib/pdf';
import { periodFromSp } from '@/lib/util';
import * as D from '@/lib/documents';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PERM: Record<string, Perm> = { penawaran: 'dokumen.pesanan', wo: 'dokumen.pesanan', 'serah-terima': 'dokumen.pesanan', invoice: 'dokumen.keuangan', kuitansi: 'dokumen.keuangan', stok: 'laporan.stok', transaksi: 'laporan.transaksi', 'laba-rugi': 'laporan.labarugi', piutang: 'laporan.piutang' };
const txt = (m: string, status: number) => new Response(m, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

export async function GET(req: NextRequest, { params }: { params: { doc: string } }) {
  const u = currentUser();
  if (!u) return txt('Silakan login terlebih dahulu.', 401);
  const perm = PERM[params.doc];
  if (!perm) return txt('Dokumen tidak dikenal.', 404);
  if (!can(u.role, perm)) return txt('Anda tidak memiliki akses ke dokumen ini.', 403);
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const id = Number(sp.id) || 0;
  const { from, to } = periodFromSp(sp);
  // teknisi hanya dokumen pesanan yang ditugaskan; harga penawaran tidak untuk teknisi/gudang
  if (['penawaran', 'wo', 'serah-terima'].includes(params.doc)) {
    const w = one('SELECT teknisi_id FROM work_orders WHERE id=?', id);
    if (!w) return txt('Pesanan tidak ditemukan.', 404);
    if (!can(u.role, 'pesanan.semua') && w.teknisi_id !== u.id) return txt('Pesanan ini tidak ditugaskan kepada Anda.', 403);
    if (params.doc === 'penawaran' && ['teknisi', 'gudang'].includes(u.role)) return txt('Anda tidak memiliki akses ke dokumen harga.', 403);
  }
  try {
    let out;
    switch (params.doc) {
      case 'penawaran': out = await D.penawaran(u, id); break;
      case 'wo': out = await D.workOrder(u, id); break;
      case 'serah-terima': out = await D.serahTerima(u, id); break;
      case 'invoice': out = await D.invoice(u, id); break;
      case 'kuitansi': out = await D.kuitansi(u, id); break;
      case 'stok': out = await D.laporanStok(u, from, to, can(u.role, 'stok.lihat_biaya')); break;
      case 'transaksi': out = await D.laporanTransaksi(u, from, to); break;
      case 'laba-rugi': out = await D.laporanLabaRugi(u, from, to); break;
      default: out = await D.laporanPiutang(u);
    }
    return pdfResponse(out.buf, out.filename);
  } catch (e: any) {
    console.error(e);
    return txt('Gagal membuat PDF: ' + (e?.message || 'kesalahan'), 400);
  }
}
