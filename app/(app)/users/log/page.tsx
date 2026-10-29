import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { tglJam } from '@/lib/util';
import { Card, Flash, PageHeader, TableWrap, Field } from '@/components/ui';
import { UserTabs } from '../tabs';
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: any }) {
  requireUser('users');
  const user = String(searchParams?.user || '').trim();
  const users = all('SELECT DISTINCT username FROM audit_logs ORDER BY username').map((r: any) => r.username);
  const logs = user ? all('SELECT * FROM audit_logs WHERE username=? ORDER BY id DESC LIMIT 200', user) : all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200');
  return (<div>
    <PageHeader title="Pengguna & Role" desc="Jejak aktivitas semua akun (login, tambah, ubah, hapus) untuk pengawasan pemilik." />
    <Flash sp={searchParams} />
    <UserTabs active="log" />
    <Card pad={false} title="Log aktivitas (200 terakhir)">
      <form className="flex flex-wrap items-end gap-2 px-4 pt-3">
        <Field label="Pengguna"><select name="user" defaultValue={user} className="input"><option value="">Semua</option>{users.map((u: string) => <option key={u} value={u}>{u}</option>)}</select></Field>
        <button className="btn">Filter</button>
      </form>
      <TableWrap><table className="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Data</th><th>Detail</th></tr></thead><tbody>
        {logs.map((l: any) => <tr key={l.id}><td className="whitespace-nowrap text-xs">{tglJam(l.at)}</td><td>{l.username}</td><td>{l.aksi}</td><td className="text-xs">{l.entitas} #{l.entitas_id}</td><td className="text-xs max-w-md truncate">{l.detail}</td></tr>)}
      </tbody></table></TableWrap>
    </Card>
  </div>);
}
