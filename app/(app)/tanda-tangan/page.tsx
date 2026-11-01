import { requireUser } from '@/lib/auth';
import { all, seedSignatories } from '@/lib/db';
import { can } from '@/lib/rbac';
import { SIGNATORY_KODES, SIGNATORY_TITLE } from '@/lib/constants';
import { uploadUrl } from '@/lib/upload';
import { Card, Flash, PageHeader, Field, Badge } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { saveSignatory, deleteSignatureImage } from './actions';
export const dynamic = 'force-dynamic';

const PAKAI: Record<string, string> = {
  pemilik: 'Mengetahui / Disetujui pada Laporan Stok, Transaksi, Laba Rugi & Piutang; Hormat kami di invoice bila dicetak pemilik.',
  admin: 'Hormat kami di invoice bila dicetak admin; gambar ikut di WO / Penawaran / Serah Terima bila penanggung jawabnya admin.',
  keuangan: 'Dibuat oleh pada Laporan Transaksi, Laba Rugi & Piutang; Hormat kami di invoice (bawaan); Penerima di kuitansi.',
  gudang: 'Dibuat oleh pada Laporan Stok.',
};

export default function Page({ searchParams }: { searchParams: any }) {
  const u = requireUser('tanda-tangan');
  const kelola = can(u.role, 'tanda-tangan.kelola');
  seedSignatories();
  const rows = Object.fromEntries(all('SELECT * FROM signatories').map((r: any) => [r.kode, r]));
  const hl = String(searchParams?.hl || '');
  return (<div>
    <PageHeader title="Tanda tangan digital" desc="Nama & gambar ini dipakai otomatis pada blok tanda tangan PDF laporan dan transaksi. Pemilik wajib diisi supaya blok Mengetahui/Disetujui tidak kosong." />
    <Flash sp={searchParams} />
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 mb-4 max-w-5xl">✍️ Unggah foto/scan tanda tangan <b>PNG transparan</b> (disarankan) atau JPG berlatar putih, maks 2 MB. Gambar dicetak di atas garis nama. Tanpa gambar, PDF tetap menyisakan ruang untuk tanda tangan basah. Blok <b>Pelanggan</b> tidak pernah diisi otomatis.</div>
    <div className="grid gap-4 lg:grid-cols-2 max-w-5xl">
      {SIGNATORY_KODES.map(k => { const r = rows[k] || { nama: '', jabatan: SIGNATORY_TITLE[k], aktif: 1 }; const wajib = k === 'pemilik';
        return <Card key={k} id={k} className={hl === k ? 'border-amber-300' : ''} title={<span className="flex items-center gap-2">{SIGNATORY_TITLE[k]} {wajib ? <Badge color="violet">wajib</Badge> : r.aktif ? <Badge color="green">aktif</Badge> : <Badge color="red">nonaktif</Badge>}</span>}>
          <form action={saveSignatory} className="space-y-3"><fieldset disabled={!kelola} className="space-y-3">
            <input type="hidden" name="kode" value={k} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`Nama${wajib ? ' pemilik' : ''} *`}><input name="nama" defaultValue={r.nama} className="input" required maxLength={80} placeholder={wajib ? 'mis. Budi Santoso' : 'nama di bawah garis'} /></Field>
              <Field label="Jabatan (judul blok)"><input name="jabatan" defaultValue={r.jabatan || SIGNATORY_TITLE[k]} className="input" maxLength={60} placeholder={SIGNATORY_TITLE[k]} /></Field>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {r.gambar ? <img src={uploadUrl(r.gambar)} alt={`tanda tangan ${r.nama}`} className="h-20 max-w-[220px] object-contain rounded border bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-1" />
                : <div className="h-20 w-44 rounded border border-dashed grid place-items-center text-xs text-slate-400">belum ada gambar</div>}
              <div className="space-y-2 text-sm">
                <input type="file" name="gambar" accept="image/png,image/jpeg" className="text-sm" />
                <p className="text-xs text-slate-500">PNG transparan / JPG, maks 2 MB. {r.gambar ? 'Pilih file untuk mengganti.' : ''}</p>
                {r.gambar && <label className="flex items-center gap-2"><input type="checkbox" name="hapus_gambar" value="1" /> Hapus gambar saat simpan</label>}
                {!wajib && <label className="flex items-center gap-2"><input type="checkbox" name="aktif" value="1" defaultChecked={!!r.aktif} /> Aktif (dipakai di PDF)</label>}
              </div>
            </div>
            <p className="text-xs text-slate-500">Dipakai di: {PAKAI[k]}</p>
            {kelola && <div className="flex flex-wrap gap-2"><button className="btn btn-primary">💾 Simpan</button>
              {r.gambar && <ConfirmButton className="btn text-red-600" formAction={deleteSignatureImage} msg={`Hapus gambar tanda tangan ${SIGNATORY_TITLE[k]}?`}>🗑 Hapus gambar</ConfirmButton>}</div>}
          </fieldset></form>
        </Card>; })}
    </div>
    {!kelola && <p className="text-xs text-slate-500 mt-3">Peran Anda hanya dapat melihat. Ubah: Pemilik, Admin.</p>}
  </div>);
}
