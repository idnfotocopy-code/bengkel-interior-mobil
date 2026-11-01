import { ItemLineInputs } from '@/components/ItemLineInputs';
import { itemSuggestions } from '@/lib/items';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { all } from '@/lib/db';
import { can } from '@/lib/rbac';
import { WO_STATUSES } from '@/lib/constants';
import { today, addDays } from '@/lib/util';
import { Card, Flash, PageHeader, Field } from '@/components/ui';
import { VehiclePicker } from '@/components/VehiclePicker';
import { createWO } from '../actions';
import { activeBranchId } from '@/lib/branch';
import { BranchBadge } from '@/components/BranchBadge';
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: any }) {
  const u = requireUser('pesanan');
  if (!can(u.role, 'pesanan.kelola')) redirect('/pesanan?err=' + encodeURIComponent('Anda tidak berhak membuat pesanan.'));
  const cab = activeBranchId(u);
  const customers = all('SELECT id, kode, nama, telepon FROM customers WHERE branch_id=? ORDER BY nama', cab);
  const vehicles = all('SELECT v.id, v.customer_id, v.nopol, v.merek, v.tipe FROM vehicles v JOIN customers c ON c.id=v.customer_id WHERE c.branch_id=? ORDER BY v.nopol', cab);
  const teknisi = all("SELECT id, nama FROM users WHERE role='teknisi' AND aktif=1 AND (branch_id=? OR branch_id IS NULL) ORDER BY nama", cab);
  const jobs = all<{ nama: string }>('SELECT nama FROM job_types WHERE aktif=1 ORDER BY urutan, nama');
  return (<div>
    <PageHeader title="Pesanan baru" desc="Nomor pesanan dibuat otomatis (BIM-YYYY-####) saat disimpan."><Link href="/pesanan" className="btn">← Kembali</Link></PageHeader>
    <Flash sp={searchParams} />
    <form action={createWO} className="space-y-5 max-w-4xl">
      <BranchBadge />
      <Card title="Pelanggan & kendaraan"><div className="grid gap-3 sm:grid-cols-2">
        <VehiclePicker customers={customers} vehicles={vehicles} customerId={Number(searchParams?.customer_id) || undefined} vehicleId={Number(searchParams?.vehicle_id) || undefined} />
      </div><p className="text-xs text-slate-500 mt-2">Pelanggan/kendaraan belum ada? <Link className="link" href="/pelanggan">Tambah pelanggan</Link> · <Link className="link" href="/kendaraan">Tambah kendaraan</Link></p></Card>
      <Card title="Pekerjaan & jadwal"><div className="grid-form">
        <Field label="Jenis pekerjaan *"><select name="jenis_pekerjaan" className="input" required defaultValue=""><option value="" disabled>— pilih jenis pekerjaan —</option>{jobs.map(j => <option key={j.nama} value={j.nama}>{j.nama}</option>)}</select>{can(u.role, 'jenis.kelola') && <p className="text-xs text-slate-500 mt-1">Belum ada di daftar? <Link className="link" href="/jenis-pekerjaan#tambah">Tambah jenis pekerjaan</Link></p>}</Field>
        <Field label="Tanggal masuk"><input type="date" name="tgl_masuk" defaultValue={today()} className="input" /></Field>
        <Field label="Target selesai"><input type="date" name="target_selesai" defaultValue={addDays(today(), 7)} className="input" /></Field>
        <Field label="Status awal"><select name="status" className="input">{WO_STATUSES.slice(0, 4).map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Teknisi"><select name="teknisi_id" className="input"><option value="">— belum ditentukan —</option>{teknisi.map((t: any) => <option key={t.id} value={t.id}>{t.nama}</option>)}</select></Field>
        <Field label="Catatan" className="sm:col-span-2 lg:col-span-1"><input name="catatan" className="input" /></Field>
        <Field label="Deskripsi / permintaan pelanggan" className="sm:col-span-2 lg:col-span-3"><textarea name="deskripsi" className="input" rows={2} /></Field>
      </div></Card>
      <Card title="Item pertama (opsional — item lain bisa ditambah setelah disimpan)"><div className="grid gap-3 sm:grid-cols-6">
        <ItemLineInputs suggestions={itemSuggestions(cab)} prefix="item_" layout="grid" />
      </div></Card>
      <button className="btn btn-primary px-6">Simpan pesanan</button>
    </form>
  </div>);
}
