import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { ROLES, ROLE_LABEL, MENUS, PERM_LIST, PERM_LABEL } from '@/lib/rbac';
import { ConfirmButton } from '@/components/Confirm';
import { tglJam } from '@/lib/util';
import { Card, Flash, PageHeader, TableWrap, Field } from '@/components/ui';
import { saveUser, deleteUser } from './actions';
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: any }) {
  const me = requireUser('users');
  const users = all('SELECT * FROM users ORDER BY aktif DESC, role, nama');
  const logs = all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 30');
  const roleOpts = ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>);
  return (<div>
    <PageHeader title="Pengguna & hak akses" desc="Hanya pemilik yang dapat menambah pengguna, mengubah peran, atau mereset kata sandi."><a className="btn btn-primary" href="#tambah">+ Tambah pengguna</a></PageHeader>
    <Flash sp={searchParams} />
    <div className="space-y-5">
      <Card pad={false} title="Daftar pengguna">
        <TableWrap><table className="tbl"><thead><tr><th>Username</th><th>Nama</th><th>Peran</th><th>Telepon</th><th>Aktif</th><th>Reset sandi</th><th>Login terakhir</th><th>Aksi</th></tr></thead><tbody>
          {users.map((x: any) => <tr key={x.id}><td className="font-mono text-xs">{x.username}{x.id === me.id && ' (Anda)'}{!x.aktif && <div className="text-red-600">nonaktif</div>}</td>
            <td colSpan={6}><form action={saveUser} id={`u${x.id}`} className="grid gap-2 sm:grid-cols-12 items-center">
              <input type="hidden" name="id" value={x.id} />
              <input name="nama" defaultValue={x.nama} className="input sm:col-span-3" />
              <select name="role" defaultValue={x.role} className="input sm:col-span-2">{roleOpts}</select>
              <input name="telepon" defaultValue={x.telepon || ''} className="input sm:col-span-2" />
              <label className="sm:col-span-1 text-sm flex items-center gap-1"><input type="checkbox" name="aktif" value="1" defaultChecked={!!x.aktif} /> aktif</label>
              <input name="password" type="password" placeholder="sandi baru (opsional)" autoComplete="new-password" className="input sm:col-span-2" />
              <span className="sm:col-span-2 text-xs text-slate-500">{tglJam(x.last_login)}</span>
            </form></td>
            <td className="whitespace-nowrap"><button form={`u${x.id}`} className="btn btn-sm btn-primary">✏️ Simpan edit</button>{' '}
              {x.id !== me.id && <form action={deleteUser} className="inline"><input type="hidden" name="id" value={x.id} /><ConfirmButton className="btn btn-sm text-red-600" msg={`Hapus pengguna ${x.username}? Bila sudah punya riwayat transaksi, akun hanya dinonaktifkan.`}>🗑 Hapus</ConfirmButton></form>}</td></tr>)}
        </tbody></table></TableWrap>
      </Card>
      <Card id="tambah" title="➕ Tambah pengguna"><form action={saveUser} className="grid-form">
        <Field label="Username"><input name="username" className="input" required /></Field>
        <Field label="Nama lengkap"><input name="nama" className="input" required /></Field>
        <Field label="Peran"><select name="role" className="input" defaultValue="admin">{roleOpts}</select></Field>
        <Field label="Telepon"><input name="telepon" className="input" /></Field>
        <Field label="Kata sandi (min. 8)"><input name="password" type="password" autoComplete="new-password" className="input" required /></Field>
        <div className="flex items-end"><button className="btn btn-primary">Tambah pengguna</button></div>
      </form></Card>
      <Card pad={false} title="Matriks akses menu">
        <TableWrap><table className="tbl"><thead><tr><th>Menu</th>{ROLES.map(r => <th key={r} className="text-center">{ROLE_LABEL[r]}</th>)}</tr></thead><tbody>
          {MENUS.map(m => <tr key={m.key}><td>{m.icon} {m.label}</td>{ROLES.map(r => <td key={r} className="text-center">{m.roles.includes(r) ? '✓' : '—'}</td>)}</tr>)}
        </tbody></table></TableWrap>
      </Card>
      <Card pad={false} title="Matriks hak akses aksi (tombol Tambah / Edit / Hapus)">
        <TableWrap><table className="tbl"><thead><tr><th>Aksi</th>{ROLES.map(r => <th key={r} className="text-center">{ROLE_LABEL[r]}</th>)}</tr></thead><tbody>
          {(Object.keys(PERM_LIST) as (keyof typeof PERM_LIST)[]).map(p => <tr key={p}><td className="text-sm">{PERM_LABEL[p]}</td>{ROLES.map(r => <td key={r} className="text-center">{(PERM_LIST[p] as readonly string[]).includes(r) ? '✓' : '—'}</td>)}</tr>)}
        </tbody></table></TableWrap>
        <p className="px-4 py-2 text-xs text-slate-500">Hak akses dicek di server pada setiap aksi; tombol yang tidak diizinkan juga disembunyikan.</p>
      </Card>
      <Card pad={false} title="Riwayat aktivitas (30 terakhir)">
        <TableWrap><table className="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Data</th><th>Detail</th></tr></thead><tbody>
          {logs.map((l: any) => <tr key={l.id}><td className="whitespace-nowrap text-xs">{tglJam(l.at)}</td><td>{l.username}</td><td>{l.aksi}</td><td className="text-xs">{l.entitas} #{l.entitas_id}</td><td className="text-xs max-w-md truncate">{l.detail}</td></tr>)}
        </tbody></table></TableWrap>
      </Card>
    </div>
  </div>);
}
