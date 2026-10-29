import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { all, one } from '@/lib/db';
import { can } from '@/lib/rbac';
import { rp, num, tgl, today } from '@/lib/util';
import { Card, Flash, PageHeader, Empty, TableWrap, Field, Badge } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { saveMaterial, toggleMaterial, stockMove } from '../actions';
export const dynamic = 'force-dynamic';

export default function Page({ params, searchParams }: { params: { id: string }; searchParams: any }) {
  const u = requireUser('persediaan');
  const m = one('SELECT m.*, s.nama supplier FROM materials m LEFT JOIN suppliers s ON s.id=m.supplier_id WHERE m.id=?', Number(params.id));
  if (!m) redirect('/persediaan?err=' + encodeURIComponent('Bahan tidak ditemukan.'));
  const cost = can(u.role, 'stok.lihat_biaya');
  const suppliers = all('SELECT * FROM suppliers ORDER BY nama');
  let saldo = 0;
  const mov = all(`SELECT s.*, w.nomor wo_nomor, us.nama oleh FROM stock_movements s LEFT JOIN work_orders w ON w.id=s.wo_id LEFT JOIN users us ON us.id=s.user_id WHERE s.material_id=? ORDER BY s.tanggal, s.id`, m.id).map((r: any) => ({ ...r, saldo: (saldo += r.qty) })).reverse();
  const back = `/persediaan/${m.id}`;
  return (<div>
    <PageHeader title={`${m.kode} · ${m.nama}`} desc={`Stok saat ini ${num(m.stok)} ${m.satuan} · minimum ${num(m.minimum)}${m.lokasi ? ' · lokasi ' + m.lokasi : ''}`}><Link className="btn" href="/persediaan">← Persediaan</Link></PageHeader>
    <Flash sp={searchParams} />
    {m.stok <= m.minimum && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">⚠ Stok di bawah/sama dengan minimum — segera lakukan pembelian.</div>}
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2"><Card pad={false} title="Kartu stok">
        {mov.length ? <TableWrap><table className="tbl"><thead><tr><th>Tanggal</th><th>Jenis</th><th className="num">Qty</th><th className="num">Saldo</th>{cost && <th className="num">Harga</th>}<th>Pesanan</th><th>Alasan</th><th>Oleh</th></tr></thead><tbody>
          {mov.map((s: any) => <tr key={s.id}><td className="whitespace-nowrap">{tgl(s.tanggal)}</td><td><Badge color={s.tipe === 'masuk' ? 'green' : s.tipe === 'keluar' ? 'red' : 'amber'}>{s.tipe}</Badge></td><td className={`num ${s.qty < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{s.qty > 0 ? '+' : ''}{num(s.qty)}</td><td className="num font-semibold">{num(s.saldo)}</td>{cost && <td className="num">{rp(s.harga)}</td>}<td>{s.wo_nomor ? <Link className="link" href={`/pesanan/${s.wo_id}`}>{s.wo_nomor}</Link> : '-'}</td><td className="text-xs">{s.alasan}</td><td className="text-xs">{s.oleh}</td></tr>)}
        </tbody></table></TableWrap> : <Empty>Belum ada mutasi.</Empty>}
      </Card></div>
      <div className="space-y-5">
        {can(u.role, 'stok.penyesuaian') && <Card title="Penyesuaian cepat (stok opname)"><form action={stockMove} className="space-y-2">
          <input type="hidden" name="material_id" value={m.id} /><input type="hidden" name="tipe" value="penyesuaian" /><input type="hidden" name="mode" value="set" /><input type="hidden" name="back" value={back} /><input type="hidden" name="tanggal" value={today()} />
          <Field label={`Stok fisik hasil hitung (${m.satuan})`}><input name="qty" type="number" step="0.01" defaultValue={m.stok} className="input" required /></Field>
          <Field label="Alasan"><input name="alasan" className="input" required defaultValue="Stok opname" /></Field>
          <button className="btn btn-primary w-full">Simpan penyesuaian</button></form></Card>}
        <Card title="Data bahan"><form action={saveMaterial} className="space-y-2">
          <input type="hidden" name="id" value={m.id} />
          <fieldset disabled={!can(u.role, 'stok.master')} className="space-y-2">
            <div className="grid grid-cols-2 gap-2"><Field label="Kode"><input name="kode" defaultValue={m.kode} className="input" /></Field><Field label="Satuan"><input name="satuan" defaultValue={m.satuan} className="input" /></Field></div>
            <Field label="Nama"><input name="nama" defaultValue={m.nama} className="input" /></Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Minimum"><input name="minimum" type="number" step="0.01" defaultValue={m.minimum} className="input" /></Field>
              {cost ? <Field label="Harga beli"><input name="harga_beli" type="number" defaultValue={m.harga_beli} className="input" /></Field> : <input type="hidden" name="harga_beli" value={m.harga_beli} />}</div>
            <Field label="Pemasok"><select name="supplier_id" defaultValue={m.supplier_id || ''} className="input"><option value="">—</option>{suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.nama}</option>)}</select></Field>
            <Field label="Lokasi"><input name="lokasi" defaultValue={m.lokasi} className="input" /></Field>
            {can(u.role, 'stok.master') && <button className="btn btn-primary w-full">Simpan</button>}
          </fieldset></form>
          {can(u.role, 'stok.master') && <form action={toggleMaterial} className="mt-3"><input type="hidden" name="id" value={m.id} /><ConfirmButton className="btn w-full" msg={m.aktif ? 'Nonaktifkan bahan ini? Bahan tidak akan muncul di pilihan pemakaian.' : 'Aktifkan kembali bahan ini?'}>{m.aktif ? 'Nonaktifkan bahan' : 'Aktifkan bahan'}</ConfirmButton></form>}
        </Card>
      </div>
    </div>
  </div>);
}
