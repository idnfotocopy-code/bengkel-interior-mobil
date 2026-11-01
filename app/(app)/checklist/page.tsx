import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { all, one } from '@/lib/db';
import { can } from '@/lib/rbac';
import { CHECKLIST_TIPE, CHECKLIST_DEFAULTS, ChecklistTipe } from '@/lib/constants';
import { Card, Flash, PageHeader, Empty, TableWrap, Field, Badge, Stat } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { saveChecklist, deleteChecklist, toggleChecklist } from './actions';
export const dynamic = 'force-dynamic';

const TIPE_INFO: Record<ChecklistTipe, { judul: string; pdf: string; kolom: string }> = {
  serah_terima: { judul: 'Pemeriksaan bersama', pdf: 'Surat Serah Terima', kolom: 'Sesuai / Tidak' },
  kualitas: { judul: 'Pemeriksaan kualitas', pdf: 'Work Order', kolom: 'OK / Catatan' },
};

export default function Page({ searchParams }: { searchParams: any }) {
  const u = requireUser('checklist');
  const kelola = can(u.role, 'checklist.kelola');
  const tipe: ChecklistTipe = (searchParams?.tipe in CHECKLIST_TIPE ? searchParams.tipe : 'serah_terima');
  const info = TIPE_INFO[tipe];
  const cari = String(searchParams?.q || '').trim();
  const status = ['aktif', 'nonaktif'].includes(searchParams?.status) ? searchParams.status : '';
  const hl = Number(searchParams?.hl) || 0;
  const editId = Number(searchParams?.edit) || 0;
  const where: string[] = ['c.tipe=?'], p: any[] = [tipe];
  if (cari) { where.push('c.nama LIKE ?'); p.push(`%${cari}%`); }
  if (status) where.push(`c.aktif=${status === 'aktif' ? 1 : 0}`);
  const rows = all(`SELECT c.* FROM checklist_items c WHERE ${where.join(' AND ')} ORDER BY c.aktif DESC, c.urutan, c.nama`, ...p);
  const tot = one('SELECT COUNT(*) n, COALESCE(SUM(aktif),0) aktif FROM checklist_items WHERE tipe=?', tipe);
  const counts = Object.fromEntries(all('SELECT tipe, COALESCE(SUM(aktif),0) n FROM checklist_items GROUP BY tipe').map((r: any) => [r.tipe, r.n]));
  const nextUrut = (one('SELECT COALESCE(MAX(urutan),0) m FROM checklist_items WHERE tipe=?', tipe).m || 0) + 10;
  const ed = editId && kelola ? one('SELECT * FROM checklist_items WHERE id=?', editId) : null;
  const qs = (o: Record<string, string>) => `/checklist?${new URLSearchParams({ tipe, ...(cari ? { q: cari } : {}), ...(status ? { status } : {}), ...o }).toString()}`;
  const self = qs({});
  const filt = (st: string) => `/checklist?${new URLSearchParams({ tipe, ...(cari ? { q: cari } : {}), ...(st ? { status: st } : {}) }).toString()}`;

  return (<div>
    <PageHeader title="Pemeriksaan bersama" desc="Master checklist yang dicetak di PDF. Item aktif tampil berurutan sebagai tabel Pemeriksaan bersama di Surat Serah Terima (dicentang Sesuai / Tidak saat serah terima), dan checklist pemeriksaan kualitas di Work Order.">
      {kelola && <Link className="btn btn-primary" href={`/checklist?tipe=${tipe}#tambah`}>+ Tambah item</Link>}
    </PageHeader>
    <Flash sp={searchParams} />
    <div className="flex flex-wrap gap-2 mb-4">
      {(Object.keys(TIPE_INFO) as ChecklistTipe[]).map(k => <Link key={k} href={`/checklist?tipe=${k}`} className={`btn btn-sm ${tipe === k ? 'btn-primary' : ''}`}>{TIPE_INFO[k].judul} — PDF {TIPE_INFO[k].pdf} ({counts[k] || 0} aktif)</Link>)}
    </div>
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 mb-5">
      <Stat label="Total item" value={tot.n} href={`/checklist?tipe=${tipe}`} />
      <Stat label="Aktif" value={tot.aktif} color="green" sub={`tampil di PDF ${info.pdf}`} href={`/checklist?tipe=${tipe}&status=aktif`} />
      <Stat label="Nonaktif" value={tot.n - tot.aktif} color="red" href={`/checklist?tipe=${tipe}&status=nonaktif`} />
    </div>
    {!tot.aktif && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mb-4">Belum ada item aktif — PDF {info.pdf} memakai daftar bawaan: {CHECKLIST_DEFAULTS[tipe].join(', ')}.</p>}

    {ed && <Card id="edit" className="mb-5 border-amber-300" title={`✏️ Edit item: ${ed.nama}`} actions={<Link className="btn btn-sm" href={self}>Batal</Link>}>
      <form action={saveChecklist} className="grid-form">
        <input type="hidden" name="id" value={ed.id} />
        <Field label="Nama item pemeriksaan *"><input name="nama" defaultValue={ed.nama} className="input" required maxLength={100} /></Field>
        <Field label="Dokumen"><select name="tipe" defaultValue={ed.tipe} className="input">{(Object.keys(TIPE_INFO) as ChecklistTipe[]).map(k => <option key={k} value={k}>{CHECKLIST_TIPE[k]}</option>)}</select></Field>
        <Field label="Urutan tampil"><input name="urutan" type="number" step={1} defaultValue={ed.urutan} className="input" /></Field>
        <Field label="Keterangan"><input name="deskripsi" defaultValue={ed.deskripsi || ''} className="input" placeholder="opsional, catatan internal" /></Field>
        <div className="flex items-end gap-2"><button className="btn btn-primary">Simpan perubahan</button><Link className="btn" href={self}>Batal</Link></div>
      </form>
    </Card>}

    <div className="space-y-5">
      <Card pad={false} title={`Daftar ${info.judul.toLowerCase()} — kolom PDF: ${info.kolom}`} actions={<form className="flex flex-wrap gap-2">
        <input type="hidden" name="tipe" value={tipe} />
        <input name="q" defaultValue={cari} placeholder="Cari item" className="input py-1 w-44" />
        <select name="status" defaultValue={status} className="input py-1 w-32"><option value="">Semua status</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select>
        <button className="btn btn-sm">Cari</button>{(cari || status) && <Link className="btn btn-sm" href={`/checklist?tipe=${tipe}`}>Reset</Link>}
      </form>}>
        <div className="flex flex-wrap gap-1.5 px-4 pt-3 text-xs">
          {[['', 'Semua'], ['aktif', 'Aktif'], ['nonaktif', 'Nonaktif']].map(([k, l]) => <Link key={k} href={filt(k)} className={`badge ${status === k ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600'}`}>{l}</Link>)}
        </div>
        {rows.length ? <TableWrap><table className="tbl"><thead><tr><th className="num">Urutan</th><th>Item pemeriksaan</th><th>Keterangan</th><th>Status</th>{kelola && <th className="text-right">Aksi</th>}</tr></thead><tbody>
          {rows.map((c: any) => <tr key={c.id} className={`${c.aktif ? '' : 'opacity-60'} ${c.id === hl || c.id === editId ? 'bg-amber-50' : ''}`}>
            <td className="num">{c.urutan}</td>
            <td className="font-medium">{c.nama}</td>
            <td className="text-xs text-slate-600">{c.deskripsi || '-'}</td>
            <td>{c.aktif ? <Badge color="green">aktif</Badge> : <Badge color="red">nonaktif</Badge>}</td>
            {kelola && <td className="whitespace-nowrap text-right">
              <Link className="btn btn-sm" href={`${qs({ edit: String(c.id) })}#edit`}>✏️ Edit</Link>{' '}
              <form action={toggleChecklist} className="inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="back" value={self} />
                <ConfirmButton className="btn btn-sm" msg={c.aktif ? `Nonaktifkan "${c.nama}"? Item ini tidak tampil lagi di PDF ${info.pdf}.` : `Aktifkan kembali "${c.nama}"?`}>{c.aktif ? '⏸ Nonaktifkan' : '▶ Aktifkan'}</ConfirmButton></form>{' '}
              <form action={deleteChecklist} className="inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="back" value={self} />
                <ConfirmButton className="btn btn-sm text-red-600" msg={`Hapus item "${c.nama}" secara permanen?`}>🗑 Hapus</ConfirmButton></form>
            </td>}
          </tr>)}
        </tbody></table></TableWrap> : <Empty>{cari || status ? 'Tidak ada item yang cocok.' : 'Belum ada item.'}</Empty>}
      </Card>

      {kelola ? <Card id="tambah" title={`➕ Tambah item ${info.judul.toLowerCase()}`}><form action={saveChecklist} className="grid-form">
        <input type="hidden" name="tipe" value={tipe} />
        <Field label="Nama item pemeriksaan *"><input name="nama" className="input" required maxLength={100} placeholder={tipe === 'serah_terima' ? 'mis. Kartu garansi diterima' : 'mis. Busa jok padat, tidak kempis'} /></Field>
        <Field label="Urutan tampil"><input name="urutan" type="number" step={1} defaultValue={nextUrut} className="input" /></Field>
        <Field label="Keterangan"><input name="deskripsi" className="input" placeholder="opsional, catatan internal" /></Field>
        <div className="flex items-end"><button className="btn btn-primary">Simpan item</button></div>
      </form><p className="text-xs text-slate-500 mt-2">Urutan kecil tampil lebih dulu di PDF {info.pdf}. Item baru langsung aktif. Bila semua item dinonaktifkan/dihapus, PDF memakai daftar bawaan.</p></Card>
        : <p className="text-xs text-slate-500">Peran Anda hanya dapat melihat daftar. Tambah/edit/hapus: Pemilik, Admin.</p>}
    </div>
  </div>);
}
