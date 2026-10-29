import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { all, one } from '@/lib/db';
import { can } from '@/lib/rbac';
import { num } from '@/lib/util';
import { Card, Flash, PageHeader, Empty, TableWrap, Field, Badge, Stat } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { saveJobType, deleteJobType, toggleJobType } from './actions';
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: any }) {
  const u = requireUser('jenis-pekerjaan');
  const kelola = can(u.role, 'jenis.kelola');
  const cari = String(searchParams?.q || '').trim();
  const status = ['aktif', 'nonaktif'].includes(searchParams?.status) ? searchParams.status : '';
  const hl = Number(searchParams?.hl) || 0;
  const editId = Number(searchParams?.edit) || 0;
  const where: string[] = [], p: any[] = [];
  if (cari) { where.push('j.nama LIKE ?'); p.push(`%${cari}%`); }
  if (status) where.push(`j.aktif=${status === 'aktif' ? 1 : 0}`);
  const rows = all(`SELECT j.*, (SELECT COUNT(*) FROM work_orders w WHERE w.jenis_pekerjaan=j.nama) dipakai FROM job_types j ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY j.aktif DESC, j.urutan, j.nama`, ...p);
  const tot = one('SELECT COUNT(*) n, COALESCE(SUM(aktif),0) aktif FROM job_types');
  const lain = one(`SELECT COUNT(*) n FROM work_orders WHERE COALESCE(jenis_pekerjaan,'')<>'' AND jenis_pekerjaan NOT IN (SELECT nama FROM job_types)`).n;
  const nextUrut = (one('SELECT COALESCE(MAX(urutan),0) m FROM job_types').m || 0) + 10;
  const ed = editId && kelola ? one('SELECT j.*, (SELECT COUNT(*) FROM work_orders w WHERE w.jenis_pekerjaan=j.nama) dipakai FROM job_types j WHERE j.id=?', editId) : null;
  const self = `/jenis-pekerjaan${cari || status ? '?' + new URLSearchParams({ ...(cari ? { q: cari } : {}), ...(status ? { status } : {}) }).toString() : ''}`;
  const filt = (st: string) => `/jenis-pekerjaan?${new URLSearchParams({ ...(cari ? { q: cari } : {}), ...(st ? { status: st } : {}) }).toString()}`;

  return (<div>
    <PageHeader title="Jenis pekerjaan" desc="Master daftar jenis pekerjaan yang muncul di form pesanan. Jenis yang sudah dipakai pesanan tidak dihapus permanen, hanya dinonaktifkan.">
      {kelola && <Link className="btn btn-primary" href="/jenis-pekerjaan#tambah">+ Tambah jenis pekerjaan</Link>}
    </PageHeader>
    <Flash sp={searchParams} />
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-5">
      <Stat label="Total jenis" value={tot.n} href="/jenis-pekerjaan" />
      <Stat label="Aktif" value={tot.aktif} color="green" sub="muncul di form pesanan" href="/jenis-pekerjaan?status=aktif" />
      <Stat label="Nonaktif" value={tot.n - tot.aktif} color="red" href="/jenis-pekerjaan?status=nonaktif" />
      <Stat label="Pesanan di luar master" value={lain} color="amber" sub="jenis lama / ketik manual" />
    </div>

    {ed && <Card id="edit" className="mb-5 border-amber-300" title={`✏️ Edit jenis pekerjaan: ${ed.nama}`} actions={<Link className="btn btn-sm" href={self}>Batal</Link>}>
      <form action={saveJobType} className="grid-form">
        <input type="hidden" name="id" value={ed.id} />
        <Field label="Nama jenis pekerjaan *"><input name="nama" defaultValue={ed.nama} className="input" required maxLength={80} /></Field>
        <Field label="Urutan tampil"><input name="urutan" type="number" step={1} defaultValue={ed.urutan} className="input" /></Field>
        <Field label="Deskripsi"><input name="deskripsi" defaultValue={ed.deskripsi || ''} className="input" placeholder="opsional" /></Field>
        {ed.dipakai > 0 && <label className="text-sm flex items-center gap-2 sm:col-span-2 lg:col-span-3"><input type="checkbox" name="ganti_pesanan" value="1" defaultChecked /> Bila nama diubah, ganti juga di {num(ed.dipakai)} pesanan yang memakai “{ed.nama}”</label>}
        <div className="flex items-end gap-2"><button className="btn btn-primary">Simpan perubahan</button><Link className="btn" href={self}>Batal</Link></div>
      </form>
    </Card>}

    <div className="space-y-5">
      <Card pad={false} title="Daftar jenis pekerjaan" actions={<form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={cari} placeholder="Cari nama" className="input py-1 w-44" />
        <select name="status" defaultValue={status} className="input py-1 w-32"><option value="">Semua status</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select>
        <button className="btn btn-sm">Cari</button>{(cari || status) && <Link className="btn btn-sm" href="/jenis-pekerjaan">Reset</Link>}
      </form>}>
        <div className="flex flex-wrap gap-1.5 px-4 pt-3 text-xs">
          {[['', 'Semua'], ['aktif', 'Aktif'], ['nonaktif', 'Nonaktif']].map(([k, l]) => <Link key={k} href={filt(k)} className={`badge ${status === k ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600'}`}>{l}</Link>)}
        </div>
        {rows.length ? <TableWrap><table className="tbl"><thead><tr><th className="num">Urutan</th><th>Nama</th><th>Deskripsi</th><th>Status</th><th className="num">Dipakai pesanan</th>{kelola && <th className="text-right">Aksi</th>}</tr></thead><tbody>
          {rows.map((j: any) => <tr key={j.id} className={`${j.aktif ? '' : 'opacity-60'} ${j.id === hl || j.id === editId ? 'bg-amber-50' : ''}`}>
            <td className="num">{j.urutan}</td>
            <td className="font-medium">{j.nama}</td>
            <td className="text-xs text-slate-600">{j.deskripsi || '-'}</td>
            <td>{j.aktif ? <Badge color="green">aktif</Badge> : <Badge color="red">nonaktif</Badge>}</td>
            <td className="num">{j.dipakai ? <Link className="link" href={`/pesanan?q=${encodeURIComponent(j.nama)}`}>{num(j.dipakai)}</Link> : '0'}</td>
            {kelola && <td className="whitespace-nowrap text-right">
              <Link className="btn btn-sm" href={`/jenis-pekerjaan?${new URLSearchParams({ ...(cari ? { q: cari } : {}), ...(status ? { status } : {}), edit: String(j.id) }).toString()}#edit`}>✏️ Edit</Link>{' '}
              <form action={toggleJobType} className="inline"><input type="hidden" name="id" value={j.id} /><input type="hidden" name="back" value={self} />
                <ConfirmButton className="btn btn-sm" msg={j.aktif ? `Nonaktifkan "${j.nama}"? Jenis ini tidak muncul lagi di form pesanan baru (pesanan lama tetap).` : `Aktifkan kembali "${j.nama}"?`}>{j.aktif ? '⏸ Nonaktifkan' : '▶ Aktifkan'}</ConfirmButton></form>{' '}
              <form action={deleteJobType} className="inline"><input type="hidden" name="id" value={j.id} /><input type="hidden" name="back" value={self} />
                <ConfirmButton className="btn btn-sm text-red-600" msg={j.dipakai ? `"${j.nama}" sudah dipakai ${j.dipakai} pesanan, jadi hanya akan dinonaktifkan. Lanjutkan?` : `Hapus jenis pekerjaan "${j.nama}" secara permanen?`}>🗑 Hapus</ConfirmButton></form>
            </td>}
          </tr>)}
        </tbody></table></TableWrap> : <Empty>{cari || status ? 'Tidak ada jenis pekerjaan yang cocok.' : 'Belum ada jenis pekerjaan.'}</Empty>}
      </Card>

      {kelola ? <Card id="tambah" title="➕ Tambah jenis pekerjaan"><form action={saveJobType} className="grid-form">
        <Field label="Nama jenis pekerjaan *"><input name="nama" className="input" required maxLength={80} placeholder="mis. Ganti headliner custom" /></Field>
        <Field label="Urutan tampil"><input name="urutan" type="number" step={1} defaultValue={nextUrut} className="input" /></Field>
        <Field label="Deskripsi"><input name="deskripsi" className="input" placeholder="opsional, mis. termasuk bongkar pasang" /></Field>
        <div className="flex items-end"><button className="btn btn-primary">Simpan jenis pekerjaan</button></div>
      </form><p className="text-xs text-slate-500 mt-2">Urutan kecil tampil lebih dulu di pilihan form pesanan. Jenis baru langsung aktif.</p></Card>
        : <p className="text-xs text-slate-500">Peran Anda hanya dapat melihat daftar. Tambah/edit/hapus: Pemilik, Admin.</p>}
    </div>
  </div>);
}
