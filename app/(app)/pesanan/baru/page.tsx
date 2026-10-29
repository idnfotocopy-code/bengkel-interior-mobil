import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { all } from '@/lib/db';
import { can } from '@/lib/rbac';
import { WO_STATUSES, JOB_TYPES } from '@/lib/constants';
import { today, addDays } from '@/lib/util';
import { Card, Flash, PageHeader, Field } from '@/components/ui';
import { VehiclePicker } from '@/components/VehiclePicker';
import { createWO } from '../actions';
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: any }) {
  const u = requireUser('pesanan');
  if (!can(u.role, 'pesanan.kelola')) redirect('/pesanan?err=' + encodeURIComponent('Anda tidak berhak membuat pesanan.'));
  const customers = all('SELECT id, kode, nama FROM customers ORDER BY nama');
  const vehicles = all('SELECT id, customer_id, nopol, merek, tipe FROM vehicles ORDER BY nopol');
  const teknisi = all("SELECT id, nama FROM users WHERE role='teknisi' AND aktif=1 ORDER BY nama");
  return (<div>
    <PageHeader title="Pesanan baru" desc="Nomor pesanan dibuat otomatis (BIM-YYYY-####) saat disimpan."><Link href="/pesanan" className="btn">← Kembali</Link></PageHeader>
    <Flash sp={searchParams} />
    <form action={createWO} className="space-y-5 max-w-4xl">
      <Card title="Pelanggan & kendaraan"><div className="grid gap-3 sm:grid-cols-2">
        <VehiclePicker customers={customers} vehicles={vehicles} customerId={Number(searchParams?.customer_id) || undefined} vehicleId={Number(searchParams?.vehicle_id) || undefined} />
      </div><p className="text-xs text-slate-500 mt-2">Pelanggan/kendaraan belum ada? <Link className="link" href="/pelanggan">Tambah pelanggan</Link> · <Link className="link" href="/kendaraan">Tambah kendaraan</Link></p></Card>
      <Card title="Pekerjaan & jadwal"><div className="grid-form">
        <Field label="Jenis pekerjaan *"><input name="jenis_pekerjaan" list="jobs" className="input" required placeholder="mis. Retrim jok kulit" /><datalist id="jobs">{JOB_TYPES.map(j => <option key={j} value={j} />)}</datalist></Field>
        <Field label="Tanggal masuk"><input type="date" name="tgl_masuk" defaultValue={today()} className="input" /></Field>
        <Field label="Target selesai"><input type="date" name="target_selesai" defaultValue={addDays(today(), 7)} className="input" /></Field>
        <Field label="Status awal"><select name="status" className="input">{WO_STATUSES.slice(0, 4).map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Teknisi"><select name="teknisi_id" className="input"><option value="">— belum ditentukan —</option>{teknisi.map((t: any) => <option key={t.id} value={t.id}>{t.nama}</option>)}</select></Field>
        <Field label="Catatan" className="sm:col-span-2 lg:col-span-1"><input name="catatan" className="input" /></Field>
        <Field label="Deskripsi / permintaan pelanggan" className="sm:col-span-2 lg:col-span-3"><textarea name="deskripsi" className="input" rows={2} /></Field>
      </div></Card>
      <Card title="Item pertama (opsional — item lain bisa ditambah setelah disimpan)"><div className="grid gap-3 sm:grid-cols-6">
        <Field label="Jenis"><select name="item_jenis" className="input"><option value="jasa">Jasa</option><option value="barang">Barang</option></select></Field>
        <Field label="Deskripsi" className="sm:col-span-2"><input name="item_deskripsi" className="input" /></Field>
        <Field label="Qty"><input name="item_qty" type="number" step="0.01" defaultValue={1} className="input" /></Field>
        <Field label="Satuan"><input name="item_satuan" defaultValue="paket" className="input" /></Field>
        <Field label="Harga satuan (Rp)"><input name="item_harga" type="number" min={0} className="input" /></Field>
      </div></Card>
      <button className="btn btn-primary px-6">Simpan pesanan</button>
    </form>
  </div>);
}
