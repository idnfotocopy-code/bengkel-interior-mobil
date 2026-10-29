import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { all, one } from '@/lib/db';
import { can } from '@/lib/rbac';
import { tgl, rp } from '@/lib/util';
import { woSummary } from '@/lib/biz';
import { Card, Flash, PageHeader, Empty, TableWrap, Field, StatusBadge } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { saveCustomer, deleteCustomer } from '../actions';
export const dynamic = 'force-dynamic';

export default function Page({ params, searchParams }: { params: { id: string }; searchParams: any }) {
  const u = requireUser('pelanggan');
  const c = one('SELECT * FROM customers WHERE id=?', Number(params.id));
  if (!c) notFound();
  const vehicles = all('SELECT * FROM vehicles WHERE customer_id=? ORDER BY id', c.id);
  const wos = all('SELECT w.*, v.nopol FROM work_orders w JOIN vehicles v ON v.id=w.vehicle_id WHERE w.customer_id=? ORDER BY w.id DESC', c.id);
  const pays = all('SELECT p.*, w.nomor wo FROM payments p JOIN work_orders w ON w.id=p.wo_id WHERE w.customer_id=? ORDER BY p.tanggal DESC', c.id);
  const edit = can(u.role, 'pelanggan.kelola');
  return (<div>
    <PageHeader title={c.nama} desc={`${c.kode} · pelanggan sejak ${tgl(c.tgl_pertama)}`}>
      <Link href="/pelanggan" className="btn">← Kembali</Link>
      {edit && <Link href={`/kendaraan?customer_id=${c.id}`} className="btn">+ Kendaraan</Link>}
      {edit && <Link href={`/pesanan/baru?customer_id=${c.id}`} className="btn btn-primary">+ Pesanan baru</Link>}
    </PageHeader>
    <Flash sp={searchParams} />
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        <Card title={`Kendaraan (${vehicles.length})`} pad={false}>
          {vehicles.length ? <TableWrap><table className="tbl"><thead><tr><th>Nopol</th><th>Kendaraan</th><th>Warna</th><th>Kondisi interior</th></tr></thead><tbody>
            {vehicles.map((v: any) => <tr key={v.id}><td><Link className="link" href={`/kendaraan/${v.id}`}>{v.nopol}</Link></td><td>{v.merek} {v.tipe} ({v.tahun})</td><td>{v.warna}</td><td className="text-xs">{v.kondisi}</td></tr>)}
          </tbody></table></TableWrap> : <Empty>Belum ada kendaraan.</Empty>}
        </Card>
        <Card title="Riwayat penawaran & pesanan" pad={false}>
          {wos.length ? <TableWrap><table className="tbl"><thead><tr><th>No. WO</th><th>Tanggal</th><th>Pekerjaan</th><th>Status</th><th className="num">Total</th><th className="num">Sisa</th></tr></thead><tbody>
            {wos.map((w: any) => { const sm = woSummary(w.id); return <tr key={w.id}><td><Link className="link" href={`/pesanan/${w.id}`}>{w.nomor}</Link><div className="text-xs text-slate-500">{w.nopol}</div></td><td>{tgl(w.tgl_masuk)}</td><td>{w.jenis_pekerjaan}</td><td><StatusBadge status={w.status} /></td><td className="num">{rp(sm.total)}</td><td className="num">{rp(sm.sisa)}</td></tr>; })}
          </tbody></table></TableWrap> : <Empty>Belum ada pesanan.</Empty>}
        </Card>
        <Card title="Riwayat pembayaran" pad={false}>
          {pays.length ? <TableWrap><table className="tbl"><thead><tr><th>No.</th><th>Tanggal</th><th>WO</th><th>Jenis</th><th className="num">Jumlah</th></tr></thead><tbody>
            {pays.map((p: any) => <tr key={p.id}><td>{p.nomor}</td><td>{tgl(p.tanggal)}</td><td>{p.wo}</td><td>{p.jenis}</td><td className="num">{rp(p.jumlah)}</td></tr>)}
          </tbody></table></TableWrap> : <Empty>Belum ada pembayaran.</Empty>}
        </Card>
      </div>
      <Card id="edit" title={edit ? '✏️ Edit profil pelanggan' : 'Profil pelanggan'}>
        <form action={saveCustomer} className="space-y-3">
          <input type="hidden" name="id" value={c.id} />
          <Field label="Nama *"><input name="nama" defaultValue={c.nama} className="input" required disabled={!edit} /></Field>
          <Field label="Telepon / WhatsApp"><input name="telepon" defaultValue={c.telepon} className="input" disabled={!edit} /></Field>
          {c.telepon && <a className="link text-xs" target="_blank" href={`https://wa.me/${String(c.telepon).replace(/\D/g, '').replace(/^0/, '62')}`}>Buka WhatsApp ↗</a>}
          <Field label="Alamat"><textarea name="alamat" defaultValue={c.alamat} className="input" rows={2} disabled={!edit} /></Field>
          <Field label="Tanggal pertama transaksi"><input type="date" name="tgl_pertama" defaultValue={c.tgl_pertama} className="input" disabled={!edit} /></Field>
          <Field label="Catatan preferensi / komplain"><textarea name="catatan" defaultValue={c.catatan} className="input" rows={3} disabled={!edit} /></Field>
          {edit && <div className="flex gap-2"><button className="btn btn-primary flex-1">Simpan perubahan</button><ConfirmButton className="btn btn-danger" formAction={deleteCustomer} msg={`Hapus pelanggan ${c.nama}? Tindakan ini tidak bisa dibatalkan.`}>🗑 Hapus</ConfirmButton></div>}
        </form>
      </Card>
    </div>
  </div>);
}
