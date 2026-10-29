import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { can } from '@/lib/rbac';
import { uploadUrl } from '@/lib/upload';
import { Card, Flash, PageHeader, Empty, TableWrap } from '@/components/ui';
import { VehicleForm } from '@/components/VehicleForm';
import { saveVehicle, deleteVehicle } from './actions';
import { ConfirmButton } from '@/components/Confirm';
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: any }) {
  const u = requireUser('kendaraan');
  const cari = String(searchParams?.q || '').trim();
  const tek = u.role === 'teknisi';
  const rows = all(`SELECT v.*, c.nama pemilik, c.kode FROM vehicles v JOIN customers c ON c.id=v.customer_id
    WHERE (?='' OR v.nopol LIKE ? OR v.merek LIKE ? OR v.tipe LIKE ? OR c.nama LIKE ?) ${tek ? `AND v.id IN (SELECT vehicle_id FROM work_orders WHERE teknisi_id=${Number(u.id)})` : ''} ORDER BY v.id DESC`, cari, ...Array(4).fill(`%${cari}%`));
  const customers = all('SELECT id, kode, nama FROM customers ORDER BY nama');
  const kelola = can(u.role, 'kendaraan.kelola');
  return (<div>
    <PageHeader title="Kendaraan" desc={tek ? 'Kendaraan pada pekerjaan yang ditugaskan kepada Anda.' : 'Data kendaraan pelanggan: nomor polisi, merek, tipe, tahun, warna, kondisi awal interior, dan foto.'}>{kelola && <Link className="btn btn-primary" href="/kendaraan#tambah">+ Tambah kendaraan</Link>}</PageHeader>
    <Flash sp={searchParams} />
    <div className="grid gap-5 lg:grid-cols-3">
      <Card title={`Daftar kendaraan (${rows.length})`} className="lg:col-span-2" pad={false} actions={<form className="flex gap-2"><input name="q" defaultValue={cari} placeholder="Cari nopol / merek / pemilik" className="input py-1" /><button className="btn btn-sm">Cari</button></form>}>
        {rows.length ? <TableWrap><table className="tbl"><thead><tr><th>Foto</th><th>Nopol</th><th>Kendaraan</th><th>Pemilik</th><th>Kondisi</th>{kelola && <th className="text-right">Aksi</th>}</tr></thead><tbody>
          {rows.map((v: any) => <tr key={v.id}>
            <td>{v.foto ? <img src={uploadUrl(v.foto)} alt="" className="w-14 h-10 object-cover rounded" /> : <div className="w-14 h-10 rounded bg-stone-100 grid place-items-center text-lg">🚗</div>}</td>
            <td className="whitespace-nowrap"><Link className="link" href={`/kendaraan/${v.id}`}>{v.nopol}</Link></td>
            <td>{v.merek} {v.tipe}<div className="text-xs text-slate-500">{v.tahun} · {v.warna}</div></td>
            <td>{tek ? v.pemilik : <Link className="link" href={`/pelanggan/${v.customer_id}`}>{v.pemilik}</Link>}</td>
            <td className="text-xs max-w-xs">{v.kondisi}</td>
            {kelola && <td className="whitespace-nowrap text-right"><Link className="btn btn-sm" href={`/kendaraan/${v.id}#edit`}>✏️ Edit</Link> <form action={deleteVehicle} className="inline"><input type="hidden" name="id" value={v.id} /><input type="hidden" name="back" value="/kendaraan" /><ConfirmButton className="btn btn-sm text-red-600" msg={`Hapus kendaraan ${v.nopol}?`}>🗑 Hapus</ConfirmButton></form></td>}</tr>)}
        </tbody></table></TableWrap> : <Empty />}
      </Card>
      {kelola && <Card id="tambah" title="➕ Tambah kendaraan">
        <form action={saveVehicle} className="space-y-3"><VehicleForm customers={customers} customerId={Number(searchParams?.customer_id) || undefined} /><button className="btn btn-primary w-full">Simpan kendaraan</button></form>
      </Card>}
    </div>
  </div>);
}
