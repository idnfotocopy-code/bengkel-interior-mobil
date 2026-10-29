import { requireUser } from '@/lib/auth';
import { settings } from '@/lib/db';
import { can } from '@/lib/rbac';
import { Card, Flash, PageHeader, Field } from '@/components/ui';
import { saveSettings, resetSettings } from './actions';
import { ConfirmButton } from '@/components/Confirm';
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: any }) {
  const u = requireUser('pengaturan');
  const st = settings();
  const edit = can(u.role, 'pengaturan.kelola');
  return (<div>
    <PageHeader title="Pengaturan usaha" desc="Data ini tampil pada kop seluruh dokumen PDF (penawaran, work order, invoice, kuitansi, serah terima, dan laporan).">{edit ? <span className="badge bg-emerald-100 text-emerald-800">✏️ Mode edit</span> : <span className="badge bg-stone-100 text-stone-600">Hanya lihat</span>}</PageHeader>
    <Flash sp={searchParams} />
    <form action={saveSettings} className="space-y-5 max-w-4xl"><fieldset disabled={!edit} className="space-y-5">
      <Card title="Identitas bengkel"><div className="grid-form">
        <Field label="Nama usaha"><input name="nama_usaha" defaultValue={st.nama_usaha} className="input" required /></Field>
        <Field label="Tagline" className="sm:col-span-2"><input name="tagline" defaultValue={st.tagline} className="input" /></Field>
        <Field label="Alamat" className="sm:col-span-2"><input name="alamat" defaultValue={st.alamat} className="input" /></Field>
        <Field label="Kota (untuk tanda tangan)"><input name="kota" defaultValue={st.kota} className="input" /></Field>
        <Field label="Telepon / WhatsApp"><input name="telepon" defaultValue={st.telepon} className="input" /></Field>
        <Field label="Email"><input name="email" defaultValue={st.email} className="input" /></Field>
      </div></Card>
      <Card title="Logo"><div className="flex flex-wrap items-center gap-4">
        {st.logo ? <img src={`/api/logo?v=${encodeURIComponent(st.logo)}`} alt="logo" className="h-20 rounded border bg-white p-1" /> : <div className="h-20 w-20 rounded border grid place-items-center text-xs text-slate-400">tanpa logo</div>}
        <div className="space-y-2"><input type="file" name="logo" accept="image/png,image/jpeg" className="text-sm" /><p className="text-xs text-slate-500">PNG/JPG, maks 2 MB.</p>
          {st.logo && <label className="text-sm flex items-center gap-2"><input type="checkbox" name="hapus_logo" value="1" /> Hapus logo</label>}</div>
      </div></Card>
      <Card title="Dokumen & pembayaran"><div className="grid gap-3 sm:grid-cols-2">
        <Field label="Rekening pembayaran"><input name="rekening" defaultValue={st.rekening} className="input" /></Field>
        <div className="grid grid-cols-2 gap-2"><Field label="Jatuh tempo invoice (hari)"><input name="jatuh_tempo_hari" type="number" defaultValue={st.jatuh_tempo_hari} className="input" /></Field><Field label="Masa berlaku penawaran (hari)"><input name="masa_berlaku_hari" type="number" defaultValue={st.masa_berlaku_hari} className="input" /></Field></div>
        <Field label="Instruksi pembayaran (invoice)" className="sm:col-span-2"><textarea name="instruksi_bayar" defaultValue={st.instruksi_bayar} rows={2} className="input" /></Field>
        <Field label="Syarat & ketentuan (surat penawaran)" className="sm:col-span-2"><textarea name="syarat_penawaran" defaultValue={st.syarat_penawaran} rows={4} className="input" /></Field>
      </div></Card>
      {edit && <div className="flex flex-wrap gap-2"><button className="btn btn-primary px-6">💾 Simpan perubahan</button><ConfirmButton className="btn text-red-600" formAction={resetSettings} msg="Kembalikan semua teks pengaturan ke nilai bawaan? Logo tidak ikut dihapus.">↺ Reset ke bawaan</ConfirmButton></div>}
    </fieldset></form>
  </div>);
}
