import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { ROLES, ROLE_LABEL, ROLE_COLOR, ROLE_DESC } from '@/lib/rbac';
import { ConfirmButton } from '@/components/Confirm';
import { tglJam } from '@/lib/util';
import { Badge, Card, Flash, PageHeader, TableWrap, Field, Empty } from '@/components/ui';
import { saveUser, deleteUser, toggleUser } from './actions';
import { UserTabs } from './tabs';
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: any }) {
  const me = requireUser('users');
  const fRole = (ROLES as readonly string[]).includes(searchParams?.role) ? searchParams.role : '';
  const fStatus = ['aktif', 'nonaktif'].includes(searchParams?.status) ? searchParams.status : '';
  const q = String(searchParams?.q || '').trim();
  const allUsers = all('SELECT * FROM users ORDER BY aktif DESC, role, nama');
  const users = allUsers.filter((x: any) => (!fRole || x.role === fRole) && (!fStatus || (fStatus === 'aktif' ? x.aktif : !x.aktif))
    && (!q || `${x.username} ${x.nama} ${x.telepon || ''}`.toLowerCase().includes(q.toLowerCase())));
  const count = (r: string) => allUsers.filter((x: any) => x.role === r && x.aktif).length;
  const roleOpts = ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>);
  return (<div>
    <PageHeader title="Pengguna & Role" desc="Kelola akun login dan batasi akses tiap akun lewat peran (role). Hanya pemilik yang dapat membuka menu ini.">
      <a className="btn btn-primary" href="#tambah">+ Tambah pengguna</a>
    </PageHeader>
    <Flash sp={searchParams} />
    <UserTabs active="users" />
    <div className="grid gap-3 grid-cols-2 md:grid-cols-5 mb-5">
      {ROLES.map(r => <Link key={r} href={fRole === r ? '/users' : `/users?role=${r}`} title={ROLE_DESC[r]}
        className={`card p-3 hover:shadow-md transition ${fRole === r ? 'ring-2 ring-brand-500' : ''}`}>
        <Badge color={ROLE_COLOR[r]}>{ROLE_LABEL[r]}</Badge>
        <div className="text-2xl font-bold text-brand-900 mt-1 tabular-nums">{count(r)}</div>
        <div className="text-xs text-slate-500">akun aktif</div>
      </Link>)}
    </div>
    <div className="space-y-5">
      <Card pad={false} title={`Daftar pengguna (${users.length})`}>
        <form className="flex flex-wrap items-end gap-2 px-4 pt-3">
          <Field label="Cari"><input name="q" defaultValue={q} placeholder="username / nama / telepon" className="input" /></Field>
          <Field label="Role"><select name="role" defaultValue={fRole} className="input"><option value="">Semua role</option>{roleOpts}</select></Field>
          <Field label="Status"><select name="status" defaultValue={fStatus} className="input"><option value="">Semua</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select></Field>
          <button className="btn">Filter</button>{(fRole || fStatus || q) && <Link href="/users" className="btn">Reset</Link>}
        </form>
        <TableWrap><table className="tbl"><thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>Telepon</th><th>Status</th><th>Login terakhir</th><th className="text-right">Aksi</th></tr></thead><tbody>
          {users.map((x: any) => <tr key={x.id} className={x.aktif ? '' : 'opacity-60'}>
            <td className="font-mono text-xs">{x.username}{x.id === me.id && <span className="ml-1 text-brand-600 font-sans">(Anda)</span>}</td>
            <td>{x.nama}</td>
            <td><Badge color={ROLE_COLOR[x.role]}>{ROLE_LABEL[x.role] || x.role}</Badge></td>
            <td className="text-sm">{x.telepon || '-'}</td>
            <td>{x.aktif ? <Badge color="green">Aktif</Badge> : <Badge color="red">Nonaktif</Badge>}</td>
            <td className="text-xs whitespace-nowrap">{tglJam(x.last_login)}</td>
            <td className="whitespace-nowrap text-right">
              <Link href={`/users/${x.id}`} className="btn btn-sm btn-primary">✏️ Edit</Link>{' '}
              {x.id !== me.id && <>
                <form action={toggleUser} className="inline"><input type="hidden" name="id" value={x.id} /><input type="hidden" name="back" value="/users" />
                  <ConfirmButton className="btn btn-sm" msg={x.aktif ? `Nonaktifkan ${x.username}? Akun tidak bisa login dan sesinya langsung diputus.` : `Aktifkan kembali ${x.username}?`}>{x.aktif ? '⏸ Nonaktifkan' : '▶ Aktifkan'}</ConfirmButton></form>{' '}
                <form action={deleteUser} className="inline"><input type="hidden" name="id" value={x.id} />
                  <ConfirmButton className="btn btn-sm text-red-600" msg={`Hapus pengguna ${x.username}? Bila sudah punya riwayat transaksi, akun hanya dinonaktifkan.`}>🗑 Hapus</ConfirmButton></form>
              </>}
            </td></tr>)}
        </tbody></table></TableWrap>
        {!users.length && <Empty>Tidak ada pengguna yang cocok.</Empty>}
      </Card>
      <Card id="tambah" title="➕ Tambah pengguna"><form action={saveUser} className="grid-form">
        <input type="hidden" name="back" value="/users" />
        <Field label="Username"><input name="username" className="input" required pattern="[a-z0-9_.]{3,30}" title="3–30 karakter: huruf kecil, angka, titik, garis bawah" /></Field>
        <Field label="Nama lengkap"><input name="nama" className="input" required /></Field>
        <Field label="Role (hak akses)"><select name="role" className="input" defaultValue="admin">{roleOpts}</select></Field>
        <Field label="Telepon"><input name="telepon" className="input" /></Field>
        <Field label="Kata sandi (min. 8)"><input name="password" type="password" minLength={8} autoComplete="new-password" className="input" required /></Field>
        <Field label="Ulangi kata sandi"><input name="password2" type="password" minLength={8} autoComplete="new-password" className="input" required /></Field>
        <div className="flex items-end"><button className="btn btn-primary">Tambah pengguna</button></div>
      </form>
        <p className="text-xs text-slate-500 mt-3">Lihat apa saja yang boleh dilakukan tiap role di tab <Link href="/users/roles" className="underline">Role & hak akses</Link>.</p>
      </Card>
    </div>
  </div>);
}
