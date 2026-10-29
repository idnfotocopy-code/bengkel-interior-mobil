import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { can } from '@/lib/rbac';
import { periodFinance, receivables, stockReport } from '@/lib/biz';
import { rp, num, tgl, periodFromSp } from '@/lib/util';
import { Card, Flash, PageHeader, TableWrap, PeriodFilter, Stat } from '@/components/ui';
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: any }) {
  const u = requireUser('laporan');
  const { from, to } = periodFromSp(searchParams);
  const qs = `from=${from}&to=${to}`;
  const docs = [
    { perm: 'laporan.stok', doc: 'stok', title: 'Laporan Stok Bahan', desc: 'Stok awal, masuk, keluar, akhir, dan nilai persediaan per bahan.' },
    { perm: 'laporan.transaksi', doc: 'transaksi', title: 'Laporan Transaksi', desc: 'Seluruh pembayaran masuk dan pengeluaran pada periode, beserta saldo bersih.' },
    { perm: 'laporan.labarugi', doc: 'laba-rugi', title: 'Laporan Laba Rugi', desc: 'Omzet − biaya bahan − tenaga kerja − operasional = laba bersih.' },
    { perm: 'laporan.piutang', doc: 'piutang', title: 'Laporan Piutang', desc: 'Tagihan pelanggan yang belum lunas per tanggal cetak, dengan umur piutang.' },
  ].filter(d => can(u.role, d.perm as any));
  const f = can(u.role, 'laporan.labarugi') ? periodFinance(from, to) : null;
  const pr = can(u.role, 'laporan.piutang') ? receivables() : null;
  const stok = can(u.role, 'laporan.stok') ? stockReport(from, to) : null;
  const wo = all(`SELECT status, COUNT(*) n FROM work_orders WHERE tgl_masuk BETWEEN ? AND ? GROUP BY status`, from, to);
  return (<div>
    <PageHeader title="Laporan" desc="Pilih periode, lalu unduh laporan PDF. Semua angka dihitung langsung dari transaksi." />
    <Flash sp={searchParams} />
    <PeriodFilter from={from} to={to} />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
      {docs.map(d => <div key={d.doc} className="card p-4 flex flex-col"><div className="font-semibold text-brand-900">📄 {d.title}</div><p className="text-xs text-slate-500 mt-1 flex-1">{d.desc}</p>
        <a className="btn btn-primary mt-3" target="_blank" href={`/api/pdf/${d.doc}?${qs}`}>Unduh PDF</a></div>)}
    </div>
    {f && <><h2 className="font-semibold text-brand-900 mb-2">Ringkasan laba rugi {tgl(from)} – {tgl(to)}</h2>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-6">
        <Stat label="Omzet" value={rp(f.omzet)} /><Stat label="Biaya bahan" value={rp(f.bahan)} color="red" /><Stat label="Tenaga kerja" value={rp(f.tenaga)} color="red" /><Stat label="Operasional" value={rp(f.ops)} color="red" /><Stat label="Laba bersih" value={rp(f.laba)} color="green" />
      </div></>}
    <div className="grid gap-5 lg:grid-cols-2">
      {stok && <Card pad={false} title="Stok bahan (periode)"><TableWrap><table className="tbl"><thead><tr><th>Bahan</th><th className="num">Awal</th><th className="num">Masuk</th><th className="num">Keluar</th><th className="num">Akhir</th>{can(u.role, 'stok.lihat_biaya') && <th className="num">Nilai</th>}</tr></thead><tbody>
        {stok.map((r: any) => <tr key={r.id}><td>{r.kode} · {r.nama}</td><td className="num">{num(r.awal)}</td><td className="num">{num(r.masuk)}</td><td className="num">{num(r.keluar)}</td><td className="num font-semibold">{num(r.akhir)} {r.satuan}</td>{can(u.role, 'stok.lihat_biaya') && <td className="num">{rp(r.nilai)}</td>}</tr>)}
      </tbody></table></TableWrap></Card>}
      <div className="space-y-5">
        <Card title="Pesanan masuk pada periode">{wo.length ? <ul className="text-sm space-y-1">{wo.map((w: any) => <li key={w.status} className="flex justify-between"><span>{w.status}</span><b>{w.n}</b></li>)}</ul> : <p className="text-sm text-slate-500">Tidak ada pesanan masuk.</p>}</Card>
        {pr && <Card title={`Piutang saat ini — ${rp(pr.total)}`}><ul className="text-sm space-y-1">{pr.rows.map((r: any) => <li key={r.id} className="flex justify-between"><span>{r.nomor} · {r.pelanggan}</span><b className="text-red-600">{rp(r.sisa)}</b></li>)}{!pr.rows.length && <li className="text-slate-500">Tidak ada piutang.</li>}</ul></Card>}
      </div>
    </div>
  </div>);
}
