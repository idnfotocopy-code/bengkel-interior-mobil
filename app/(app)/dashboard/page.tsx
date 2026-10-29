import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { all, one } from '@/lib/db';
import { periodFinance, receivables, woSummary } from '@/lib/biz';
import { rp, num, tgl, monthRange, today } from '@/lib/util';
import { Stat, Card, Flash, PageHeader, StatusBadge, Empty, TableWrap, Badge } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/rbac';
import { WO_STATUSES } from '@/lib/constants';
export const dynamic = 'force-dynamic';

export default function Dashboard({ searchParams }: { searchParams: any }) {
  const u = requireUser('dashboard');
  const { from, to } = monthRange();
  const f = periodFinance(from, to);
  const piutang = receivables();
  const aktifWhere = "status NOT IN ('Selesai','Dibatalkan')";
  const aktif = one(`SELECT COUNT(*) n FROM work_orders WHERE ${aktifWhere}`).n;
  const selesaiBulan = one("SELECT COUNT(*) n FROM work_orders WHERE status='Selesai' AND tgl_selesai BETWEEN ? AND ?", from, to).n;
  const low = all('SELECT * FROM materials WHERE aktif=1 AND stok<=minimum ORDER BY kode');
  const perStatus = all(`SELECT status, COUNT(*) n FROM work_orders WHERE ${aktifWhere} GROUP BY status`);
  const telat = all(`SELECT w.*, c.nama pelanggan, v.nopol FROM work_orders w JOIN customers c ON c.id=w.customer_id JOIN vehicles v ON v.id=w.vehicle_id WHERE ${aktifWhere} AND target_selesai < ? ORDER BY target_selesai`, today());
  const isTek = u.role === 'teknisi';
  const woRows = all(`SELECT w.*, c.nama pelanggan, v.nopol, v.merek, v.tipe, t.nama teknisi FROM work_orders w JOIN customers c ON c.id=w.customer_id JOIN vehicles v ON v.id=w.vehicle_id LEFT JOIN users t ON t.id=w.teknisi_id
    WHERE ${aktifWhere} ${isTek ? 'AND w.teknisi_id=' + Number(u.id) : ''} ORDER BY w.target_selesai LIMIT 10`);
  const nilaiStok = one('SELECT COALESCE(SUM(stok*harga_beli),0) v FROM materials WHERE aktif=1').v;
  const mutasi = all('SELECT s.*, m.nama, m.satuan, m.kode FROM stock_movements s JOIN materials m ON m.id=s.material_id ORDER BY s.id DESC LIMIT 8');
  const periodLabel = `${tgl(from)} – ${tgl(to)}`;

  return (<div>
    <PageHeader title={`Dashboard ${ROLE_LABEL[u.role]}`} desc={`Halo, ${u.nama}. Semua angka dihitung langsung dari transaksi di sistem · periode ${periodLabel}.`} />
    <Flash sp={searchParams} />

    {u.role === 'pemilik' && (<div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-5">
      <Stat label="Omzet bulan ini" value={rp(f.omzet)} sub="Total invoice terbit" href="/keuangan?tab=invoice" />
      <Stat label="Pengeluaran" value={rp(f.pengeluaran)} sub="Semua kas keluar (termasuk beli bahan)" color="red" href="/keuangan?tab=pengeluaran" />
      <Stat label="Laba sementara" value={rp(f.laba)} sub={`Omzet − bahan ${rp(f.bahan)} − TK ${rp(f.tenaga)} − ops ${rp(f.ops)}`} color="green" href="/laporan" />
      <Stat label="Pekerjaan aktif" value={`${aktif} mobil`} sub={`${selesaiBulan} selesai bulan ini`} color="sky" href="/pesanan" />
      <Stat label="Tagihan belum lunas" value={rp(piutang.total)} sub={`${piutang.rows.length} invoice`} color="accent" href="/keuangan?tab=piutang" />
    </div>)}
    {u.role === 'admin' && (<div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-5">
      <Stat label="Pekerjaan aktif" value={`${aktif} mobil`} href="/pesanan" color="sky" />
      <Stat label="Selesai bulan ini" value={selesaiBulan} color="green" />
      <Stat label="Melewati target" value={telat.length} color="red" />
      <Stat label="Tagihan belum lunas" value={`${piutang.rows.length} invoice`} color="accent" href="/keuangan?tab=piutang" />
    </div>)}
    {u.role === 'keuangan' && (<div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-5">
      <Stat label="Omzet bulan ini" value={rp(f.omzet)} sub="Total invoice terbit" />
      <Stat label="Kas masuk" value={rp(f.pemasukan)} sub="Pembayaran pelanggan" color="green" />
      <Stat label="Pengeluaran" value={rp(f.pengeluaran)} color="red" />
      <Stat label="Piutang" value={rp(piutang.total)} sub={`${piutang.rows.length} invoice`} color="accent" href="/keuangan?tab=piutang" />
    </div>)}
    {u.role === 'gudang' && (<div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-5">
      <Stat label="Jenis bahan" value={one('SELECT COUNT(*) n FROM materials WHERE aktif=1').n} href="/persediaan" />
      <Stat label="Stok menipis" value={low.length} color="red" href="/persediaan?filter=menipis" />
      <Stat label="Nilai persediaan" value={rp(nilaiStok)} color="green" />
      <Stat label="Pesanan menunggu bahan" value={one("SELECT COUNT(*) n FROM work_orders WHERE status='Menunggu bahan'").n} color="accent" href="/pesanan?status=Menunggu+bahan" />
    </div>)}
    {isTek && (<div className="grid gap-3 grid-cols-2 lg:grid-cols-3 mb-5">
      <Stat label="Tugas aktif saya" value={woRows.length} href="/produksi" color="sky" />
      <Stat label="Sedang dikerjakan" value={woRows.filter((w: any) => w.status === 'Sedang dikerjakan').length} />
      <Stat label="Lewat target" value={woRows.filter((w: any) => w.target_selesai < today()).length} color="red" />
    </div>)}

    <div className="grid gap-5 lg:grid-cols-3">
      <Card title={isTek ? 'Tugas saya' : 'Pekerjaan aktif (target terdekat)'} className="lg:col-span-2" pad={false} actions={<Link href={isTek ? '/produksi' : '/pesanan'} className="btn btn-sm">Lihat semua</Link>}>
        {woRows.length ? <TableWrap><table className="tbl"><thead><tr><th>No. WO</th><th>Pelanggan / Kendaraan</th><th>Status</th><th>Target</th>{u.role === 'pemilik' && <th className="num">Sisa tagihan</th>}</tr></thead><tbody>
          {woRows.map((w: any) => (<tr key={w.id}>
            <td><Link className="link" href={`/pesanan/${w.id}`}>{w.nomor}</Link><div className="text-xs text-slate-500">{w.jenis_pekerjaan}</div></td>
            <td>{w.pelanggan}<div className="text-xs text-slate-500">{w.nopol} · {w.merek} {w.tipe}</div></td>
            <td><StatusBadge status={w.status} /><div className="text-xs text-slate-500">{w.teknisi || 'Belum ada teknisi'}</div></td>
            <td className={w.target_selesai < today() ? 'text-red-600 font-semibold' : ''}>{tgl(w.target_selesai)}</td>
            {u.role === 'pemilik' && <td className="num">{rp(woSummary(w.id).sisa)}</td>}
          </tr>))}</tbody></table></TableWrap> : <Empty>Tidak ada pekerjaan aktif.</Empty>}
      </Card>
      <div className="space-y-5">
        {!isTek && <Card title="Pesanan per status">
          <div className="space-y-1.5">{WO_STATUSES.filter(s => s !== 'Selesai').map(s => { const n = perStatus.find((p: any) => p.status === s)?.n || 0; return (
            <Link key={s} href={`/pesanan?status=${encodeURIComponent(s)}`} className="flex items-center justify-between text-sm hover:bg-stone-50 rounded px-1"><span>{s}</span><b className={n ? 'text-brand-800' : 'text-slate-300'}>{n}</b></Link>); })}</div>
        </Card>}
        {['pemilik', 'gudang', 'admin'].includes(u.role) && <Card title="⚠ Stok di bawah minimum">
          {low.length ? <ul className="text-sm space-y-1">{low.map((m: any) => <li key={m.id} className="flex justify-between"><span>{m.kode} · {m.nama}</span><span className="text-red-600 font-semibold">{num(m.stok)} / min {num(m.minimum)} {m.satuan}</span></li>)}</ul> : <Empty>Semua stok aman.</Empty>}
        </Card>}
        {['pemilik', 'keuangan'].includes(u.role) && <Card title="Tagihan jatuh tempo">
          {piutang.rows.length ? <ul className="text-sm space-y-1.5">{piutang.rows.slice(0, 6).map((r: any) => <li key={r.id} className="flex justify-between gap-2"><span>{r.nomor}<div className="text-xs text-slate-500">{r.pelanggan} · {tgl(r.jatuh_tempo)} {r.umur > 0 && <Badge color="red">{r.umur} hari lewat</Badge>}</div></span><b>{rp(r.sisa)}</b></li>)}</ul> : <Empty>Tidak ada piutang.</Empty>}
        </Card>}
        {u.role === 'gudang' && <Card title="Mutasi stok terakhir">
          <ul className="text-sm space-y-1">{mutasi.map((m: any) => <li key={m.id} className="flex justify-between"><span>{m.kode} {m.nama}<div className="text-xs text-slate-500">{tgl(m.tanggal)} · {m.alasan}</div></span><b className={m.qty < 0 ? 'text-red-600' : 'text-emerald-700'}>{m.qty > 0 ? '+' : ''}{num(m.qty)}</b></li>)}</ul>
        </Card>}
      </div>
    </div>
    {u.role === 'pemilik' && telat.length > 0 && <Card title="Pekerjaan melewati target" className="mt-5"><ul className="text-sm space-y-1">{telat.map((w: any) => <li key={w.id}><Link className="link" href={`/pesanan/${w.id}`}>{w.nomor}</Link> · {w.pelanggan} · {w.nopol} · target {tgl(w.target_selesai)} · <StatusBadge status={w.status} /></li>)}</ul></Card>}
  </div>);
}
