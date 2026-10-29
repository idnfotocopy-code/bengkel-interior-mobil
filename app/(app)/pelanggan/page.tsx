import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { can } from '@/lib/rbac';
import { tgl } from '@/lib/util';
import { Card, Flash, PageHeader, Empty, TableWrap, Field } from '@/components/ui';
import { saveCustomer } from './actions';
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: any }) {
  const u = requireUser('pelanggan');
  const cari = String(searchParams?.q || '').trim();
  const rows = all(`SELECT c.*, (SELECT COUNT(*) FROM vehicles v WHERE v.customer_id=c.id) kendaraan, (SELECT COUNT(*) FROM work_orders w WHERE w.customer_id=c.id) pesanan
    FROM customers c WHERE (?='' OR c.nama LIKE ? OR c.telepon LIKE ? OR c.kode LIKE ?) ORDER BY c.id DESC`, cari, `%${cari}%`, `%${cari}%`, `%${cari}%`);
  return (<div>
    <PageHeader title="Pelanggan" desc="Profil pelanggan, kontak, catatan preferensi, dan riwayat transaksi." />
    <Flash sp={searchParams} />
    <div className="grid gap-5 lg:grid-cols-3">
      <Card title={`Daftar pelanggan (${rows.length})`} className="lg:col-span-2" pad={false} actions={<form className="flex gap-2"><input name="q" defaultValue={cari} placeholder="Cari nama / telepon / ID" className="input py-1" /><button className="btn btn-sm">Cari</button></form>}>
        {rows.length ? <TableWrap><table className="tbl"><thead><tr><th>ID</th><th>Nama</th><th>Telepon/WA</th><th>Pertama transaksi</th><th className="num">Kendaraan</th><th className="num">Pesanan</th></tr></thead><tbody>
          {rows.map((c: any) => <tr key={c.id}><td className="whitespace-nowrap">{c.kode}</td><td><Link className="link" href={`/pelanggan/${c.id}`}>{c.nama}</Link><div className="text-xs text-slate-500 line-clamp-1">{c.alamat}</div></td><td className="whitespace-nowrap">{c.telepon}</td><td className="whitespace-nowrap">{tgl(c.tgl_pertama)}</td><td className="num">{c.kendaraan}</td><td className="num">{c.pesanan}</td></tr>)}
        </tbody></table></TableWrap> : <Empty />}
      </Card>
      {can(u.role, 'pelanggan.kelola') && <Card title="Tambah pelanggan">
        <form action={saveCustomer} className="space-y-3">
          <Field label="Nama *"><input name="nama" className="input" required /></Field>
          <Field label="Telepon / WhatsApp"><input name="telepon" className="input" placeholder="08xx" /></Field>
          <Field label="Alamat"><textarea name="alamat" className="input" rows={2} /></Field>
          <Field label="Tanggal pertama transaksi"><input type="date" name="tgl_pertama" className="input" /></Field>
          <Field label="Catatan preferensi / permintaan khusus"><textarea name="catatan" className="input" rows={2} /></Field>
          <p className="text-xs text-slate-500">ID pelanggan dibuat otomatis (PLG-####).</p>
          <button className="btn btn-primary w-full">Simpan pelanggan</button>
        </form>
      </Card>}
    </div>
  </div>);
}
