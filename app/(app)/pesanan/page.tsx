import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { can } from '@/lib/rbac';
import { woSummary } from '@/lib/biz';
import { WO_STATUSES, WO_CANCELLED } from '@/lib/constants';
import { rp, tgl, today } from '@/lib/util';
import { Card, Flash, PageHeader, Empty, TableWrap, StatusBadge } from '@/components/ui';
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: any }) {
  const u = requireUser('pesanan');
  const status = String(searchParams?.status || '');
  const cari = String(searchParams?.q || '').trim();
  const semua = can(u.role, 'pesanan.semua');
  const where: string[] = []; const p: any[] = [];
  if (status === 'aktif') where.push("w.status NOT IN ('Selesai','Dibatalkan')");
  else if (status) { where.push('w.status=?'); p.push(status); }
  if (cari) { where.push('(w.nomor LIKE ? OR c.nama LIKE ? OR v.nopol LIKE ? OR w.jenis_pekerjaan LIKE ?)'); p.push(...Array(4).fill(`%${cari}%`)); }
  if (!semua) { where.push('w.teknisi_id=?'); p.push(u.id); }
  const rows = all(`SELECT w.*, c.nama pelanggan, v.nopol, v.merek, v.tipe, t.nama teknisi FROM work_orders w JOIN customers c ON c.id=w.customer_id JOIN vehicles v ON v.id=w.vehicle_id LEFT JOIN users t ON t.id=w.teknisi_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY w.id DESC`, ...p);
  const showMoney = u.role !== 'teknisi' && u.role !== 'gudang';
  return (<div>
    <PageHeader title="Pesanan / Work Order" desc="Setiap pekerjaan memiliki nomor unik BIM-YYYY-#### yang dipakai pada pemakaian bahan, invoice, pembayaran, dan laporan.">
      {can(u.role, 'pesanan.kelola') && <Link href="/pesanan/baru" className="btn btn-primary">+ Pesanan baru</Link>}
    </PageHeader>
    <Flash sp={searchParams} />
    <Card pad={false} title={`${rows.length} pesanan`} actions={<form className="flex flex-wrap gap-2">
      <select name="status" defaultValue={status} className="input py-1 w-auto"><option value="">Semua status</option><option value="aktif">Semua yang aktif</option>{[...WO_STATUSES, WO_CANCELLED].map(s => <option key={s}>{s}</option>)}</select>
      <input name="q" defaultValue={cari} placeholder="Cari nomor / pelanggan / nopol" className="input py-1 w-56" /><button className="btn btn-sm">Filter</button></form>}>
      {rows.length ? <TableWrap><table className="tbl"><thead><tr><th>No. WO</th><th>Pelanggan / Kendaraan</th><th>Pekerjaan</th><th>Masuk / Target</th><th>Status</th>{showMoney && <><th className="num">Total</th><th className="num">Dibayar</th><th className="num">Sisa</th></>}</tr></thead><tbody>
        {rows.map((w: any) => { const sm = showMoney ? woSummary(w.id) : null; return (<tr key={w.id}>
          <td className="whitespace-nowrap"><Link className="link" href={`/pesanan/${w.id}`}>{w.nomor}</Link></td>
          <td>{w.pelanggan}<div className="text-xs text-slate-500">{w.nopol} · {w.merek} {w.tipe}</div></td>
          <td>{w.jenis_pekerjaan}<div className="text-xs text-slate-500">{w.teknisi ? '👷 ' + w.teknisi : 'Belum ada teknisi'}</div></td>
          <td className="whitespace-nowrap text-xs">{tgl(w.tgl_masuk)}<div className={!['Selesai', 'Dibatalkan'].includes(w.status) && w.target_selesai < today() ? 'text-red-600 font-semibold' : 'text-slate-500'}>→ {tgl(w.target_selesai)}</div></td>
          <td><StatusBadge status={w.status} /></td>
          {sm && <><td className="num">{rp(sm.total)}</td><td className="num">{rp(sm.paid)}</td><td className={`num ${sm.sisa > 0 ? 'text-red-600' : ''}`}>{rp(sm.sisa)}</td></>}
        </tr>); })}
      </tbody></table></TableWrap> : <Empty>Tidak ada pesanan.</Empty>}
    </Card>
  </div>);
}
