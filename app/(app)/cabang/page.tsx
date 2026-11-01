import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { listBranches, branchUsage, activeBranch } from '@/lib/branch';
import { tglJam } from '@/lib/util';
import { Badge, Card, Flash, PageHeader, TableWrap, Field, Empty } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { saveBranch, toggleBranch, deleteBranch } from './actions';
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: any }) {
  const u = requireUser('cabang');
  const kelola = can(u.role, 'cabang.kelola');
  const editId = Number(searchParams?.edit) || 0;
  const hl = Number(searchParams?.hl) || 0;
  const rows = listBranches().map(b => ({ ...b, us: branchUsage(b.id) }));
  const ed = editId ? rows.find(b => b.id === editId) : null;
  const cur = activeBranch(u);
  const totalData = (us: ReturnType<typeof branchUsage>) => us.pelanggan + us.pesanan + us.bahan + us.mutasi + us.invoice + us.pembayaran + us.pengeluaran + us.kas + us.pengguna;
  return (<div>
    <PageHeader title="Cabang" desc="Master cabang bengkel. Pelanggan, pesanan, persediaan, kas, invoice, pembayaran, dan pengeluaran dicatat per cabang. Identitas usaha (nama, logo, rekening) tetap global di Pengaturan; alamat & telepon cabang di sini dipakai pada kop dokumen PDF cabang tersebut.">
      {kelola && <a href="#form" className="btn btn-primary">+ Tambah cabang</a>}
    </PageHeader>
    <Flash sp={searchParams} />
    <div className="grid gap-5 lg:grid-cols-5">
      <Card pad={false} className="lg:col-span-3" title={`Daftar cabang (${rows.length})`}>
        <TableWrap><table className="tbl"><thead><tr><th>Kode</th><th>Cabang</th><th>Kontak</th><th className="text-right">Data</th><th>Status</th><th className="text-right">Aksi</th></tr></thead><tbody>
          {rows.map(b => { const n = totalData(b.us); return <tr key={b.id} className={`${b.aktif ? '' : 'opacity-60'} ${hl === b.id ? 'bg-amber-50' : ''}`}>
            <td className="font-mono text-xs font-bold">{b.kode}</td>
            <td><div className="font-semibold">{b.nama}{cur.id === b.id && <span className="ml-1 text-xs text-brand-600">(aktif dilihat)</span>}</div><div className="text-xs text-slate-500">{b.kota || '-'}{b.alamat ? ' · ' + b.alamat : ''}</div></td>
            <td className="text-sm">{b.telepon || '-'}</td>
            <td className="text-right text-xs whitespace-nowrap">{b.us.pelanggan} plg · {b.us.pesanan} WO · {b.us.bahan} bahan<br />{b.us.pengguna} pengguna</td>
            <td>{b.aktif ? <Badge color="green">Aktif</Badge> : <Badge color="red">Nonaktif</Badge>}</td>
            <td className="whitespace-nowrap text-right">{kelola && <>
              <Link href={`/cabang?edit=${b.id}#form`} className="btn btn-sm btn-primary">✏️ Edit</Link>{' '}
              <form action={toggleBranch} className="inline"><input type="hidden" name="id" value={b.id} />
                <ConfirmButton className="btn btn-sm" msg={b.aktif ? `Nonaktifkan cabang ${b.nama}? Cabang tidak muncul di pemilih cabang, data tetap tersimpan.` : `Aktifkan kembali cabang ${b.nama}?`}>{b.aktif ? '⏸ Nonaktifkan' : '▶ Aktifkan'}</ConfirmButton></form>{' '}
              <form action={deleteBranch} className="inline"><input type="hidden" name="id" value={b.id} />
                <ConfirmButton className="btn btn-sm text-red-600" msg={n ? `Cabang ${b.nama} masih punya data, jadi tidak bisa dihapus (sistem akan menolak). Lanjutkan untuk melihat rinciannya?` : `Hapus permanen cabang ${b.nama}? Akun Kas Tunai kosong milik cabang ini ikut dihapus.`}>🗑 Hapus</ConfirmButton></form>
            </>}</td></tr>; })}
        </tbody></table></TableWrap>
        {!rows.length && <Empty>Belum ada cabang.</Empty>}
        <p className="text-xs text-slate-500 px-4 py-3">Cabang hanya bisa <b>dihapus</b> bila belum punya pelanggan, pesanan, bahan, transaksi, akun kas terisi, atau pengguna. Bila sudah dipakai, gunakan <b>Nonaktifkan</b> agar riwayat tetap utuh.</p>
      </Card>
      {kelola && <Card id="form" className="lg:col-span-2" title={ed ? `✏️ Edit cabang ${ed.nama}` : '➕ Tambah cabang'} actions={ed ? <Link href="/cabang" className="btn btn-sm">Batal</Link> : undefined}>
        <form action={saveBranch} className="space-y-3" key={ed?.id || 'baru'}>
          {ed && <input type="hidden" name="id" value={ed.id} />}
          <div className="grid grid-cols-3 gap-2">
            <Field label="Kode"><input name="kode" defaultValue={ed?.kode || ''} required maxLength={10} pattern="[A-Za-z0-9\-]{2,10}" placeholder="TGR" className="input font-mono uppercase" /></Field>
            <Field label="Nama cabang" className="col-span-2"><input name="nama" defaultValue={ed?.nama || ''} required placeholder="Tangerang" className="input" /></Field>
          </div>
          <Field label="Kota (untuk tanda tangan dokumen)"><input name="kota" defaultValue={ed?.kota || ''} className="input" /></Field>
          <Field label="Alamat"><textarea name="alamat" defaultValue={ed?.alamat || ''} rows={2} className="input" /></Field>
          <Field label="Telepon / WhatsApp"><input name="telepon" defaultValue={ed?.telepon || ''} className="input" /></Field>
          <button className="btn btn-primary w-full">{ed ? '💾 Simpan perubahan' : '➕ Tambah cabang'}</button>
          {!ed && <p className="text-xs text-slate-500">Cabang baru otomatis mendapat akun <b>Kas Tunai</b> dengan saldo awal 0. Tetapkan pengguna ke cabang ini di menu <Link href="/users" className="underline">Pengguna & Role</Link>.</p>}
          {ed && <p className="text-xs text-slate-500">Dibuat {tglJam(ed.created_at)}.</p>}
        </form>
      </Card>}
    </div>
  </div>);
}
