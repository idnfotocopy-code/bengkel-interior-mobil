import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { all, one } from '@/lib/db';
import { can } from '@/lib/rbac';
import { tgl } from '@/lib/util';
import { uploadUrl } from '@/lib/upload';
import { Card, Flash, PageHeader, Empty, TableWrap, StatusBadge } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { VehicleForm } from '@/components/VehicleForm';
import { saveVehicle, deleteVehicle } from '../actions';
export const dynamic = 'force-dynamic';

export default function Page({ params, searchParams }: { params: { id: string }; searchParams: any }) {
  const u = requireUser('kendaraan');
  const v = one('SELECT v.*, c.nama pemilik FROM vehicles v JOIN customers c ON c.id=v.customer_id WHERE v.id=?', Number(params.id));
  if (!v) notFound();
  if (u.role === 'teknisi' && !one('SELECT 1 x FROM work_orders WHERE vehicle_id=? AND teknisi_id=?', v.id, u.id)) redirect('/kendaraan?err=' + encodeURIComponent('Kendaraan ini bukan bagian dari tugas Anda.'));
  const edit = can(u.role, 'kendaraan.kelola');
  const customers = all('SELECT id, kode, nama FROM customers ORDER BY nama');
  const wos = all('SELECT * FROM work_orders WHERE vehicle_id=? ORDER BY id DESC', v.id);
  const fotos = all('SELECT p.foto, p.catatan, p.at, w.nomor FROM work_progress p JOIN work_orders w ON w.id=p.wo_id WHERE w.vehicle_id=? AND p.foto IS NOT NULL ORDER BY p.id DESC', v.id);
  return (<div>
    <PageHeader title={`${v.nopol} · ${v.merek} ${v.tipe}`} desc={`Pemilik: ${v.pemilik}`}>
      <Link href="/kendaraan" className="btn">← Kembali</Link>
      {edit && <Link href={`/pesanan/baru?customer_id=${v.customer_id}&vehicle_id=${v.id}`} className="btn btn-primary">+ Pesanan untuk kendaraan ini</Link>}
    </PageHeader>
    <Flash sp={searchParams} />
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        <Card title="Foto kondisi awal">{v.foto ? <img src={uploadUrl(v.foto)} alt="Foto kendaraan" className="max-h-80 rounded-lg" /> : <Empty>Belum ada foto.</Empty>}</Card>
        <Card title="Riwayat pesanan" pad={false}>{wos.length ? <TableWrap><table className="tbl"><thead><tr><th>No. WO</th><th>Masuk</th><th>Pekerjaan</th><th>Status</th></tr></thead><tbody>
          {wos.map((w: any) => <tr key={w.id}><td><Link className="link" href={`/pesanan/${w.id}`}>{w.nomor}</Link></td><td>{tgl(w.tgl_masuk)}</td><td>{w.jenis_pekerjaan}</td><td><StatusBadge status={w.status} /></td></tr>)}
        </tbody></table></TableWrap> : <Empty />}</Card>
        {fotos.length > 0 && <Card title="Foto progres"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{fotos.map((f: any, i: number) => <figure key={i}><img src={uploadUrl(f.foto)} alt="" className="rounded h-28 w-full object-cover" /><figcaption className="text-[11px] text-slate-500 mt-1">{f.nomor} · {f.catatan}</figcaption></figure>)}</div></Card>}
      </div>
      <Card id="edit" title={edit ? '✏️ Edit data kendaraan' : 'Data kendaraan'}>
        <form action={saveVehicle} className="space-y-3">
          <input type="hidden" name="id" value={v.id} />
          <VehicleForm v={v} customers={customers} disabled={!edit} />
          {edit && <div className="flex gap-2"><button className="btn btn-primary flex-1">Simpan perubahan</button><ConfirmButton className="btn btn-danger" formAction={deleteVehicle} msg={`Hapus kendaraan ${v.nopol}?`}>🗑 Hapus</ConfirmButton></div>}
        </form>
      </Card>
    </div>
  </div>);
}
