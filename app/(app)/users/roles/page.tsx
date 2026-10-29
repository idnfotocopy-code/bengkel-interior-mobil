import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { ROLES, ROLE_LABEL, ROLE_COLOR, ROLE_DESC, MENUS, PERM_GROUPS, PERM_LABEL, can, permsFor } from '@/lib/rbac';
import { Badge, Card, Flash, PageHeader, TableWrap } from '@/components/ui';
import { UserTabs } from '../tabs';
export const dynamic = 'force-dynamic';

const Mark = ({ on }: { on: boolean }) => on ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-stone-300">—</span>;

export default function Page({ searchParams }: { searchParams: any }) {
  requireUser('users');
  const hl = (ROLES as readonly string[]).includes(searchParams?.role) ? searchParams.role : '';
  const users = all('SELECT username, nama, role FROM users WHERE aktif=1 ORDER BY nama');
  const col = (r: string) => `text-center ${hl === r ? 'bg-brand-50' : ''}`;
  const head = (<tr><th>Menu / aksi</th>{ROLES.map(r => <th key={r} className={col(r)}><Link href={hl === r ? '/users/roles' : `/users/roles?role=${r}`}><Badge color={ROLE_COLOR[r]}>{ROLE_LABEL[r]}</Badge></Link></th>)}</tr>);
  return (<div>
    <PageHeader title="Pengguna & Role" desc="Matriks hak akses tiap role. Akses akun ditentukan oleh role-nya; ubah role akun di tab Daftar pengguna." />
    <Flash sp={searchParams} />
    <UserTabs active="roles" />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 mb-5">
      {ROLES.map(r => { const us = users.filter((u: any) => u.role === r); return (
        <div key={r} className={`card p-4 ${hl === r ? 'ring-2 ring-brand-500' : ''}`}>
          <div className="flex items-center justify-between"><Badge color={ROLE_COLOR[r]}>{ROLE_LABEL[r]}</Badge><span className="text-xs text-slate-500">{permsFor(r).length} aksi · {MENUS.filter(m => m.roles.includes(r)).length} menu</span></div>
          <p className="text-xs text-slate-600 mt-2">{ROLE_DESC[r]}</p>
          <div className="text-xs mt-2"><span className="text-slate-500">Akun: </span>{us.length ? us.map((u: any) => u.username).join(', ') : <span className="italic text-slate-400">belum ada</span>}</div>
        </div>); })}
    </div>
    <div className="space-y-5">
      <Card pad={false} title="🧭 Akses menu (sidebar)">
        <TableWrap><table className="tbl"><thead>{head}</thead><tbody>
          {MENUS.map(m => <tr key={m.key}><td>{m.icon} {m.label}</td>{ROLES.map(r => <td key={r} className={col(r)}><Mark on={m.roles.includes(r)} /></td>)}</tr>)}
        </tbody></table></TableWrap>
      </Card>
      <Card pad={false} title="🛡️ Hak akses aksi (tombol Tambah / Edit / Hapus, dokumen & laporan)">
        <TableWrap><table className="tbl"><thead>{head}</thead><tbody>
          {PERM_GROUPS.map(g => [
            <tr key={g.label} className="bg-stone-50"><td colSpan={ROLES.length + 1} className="font-semibold text-brand-900">{g.icon} {g.label}</td></tr>,
            ...g.perms.map(p => <tr key={p}><td className="text-sm pl-6">{PERM_LABEL[p]}</td>{ROLES.map(r => <td key={r} className={col(r)}><Mark on={can(r, p)} /></td>)}</tr>),
          ])}
        </tbody></table></TableWrap>
      </Card>
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 space-y-1">
        <div>🔒 <b>Cara pembatasan bekerja:</b> menu yang tidak diizinkan disembunyikan dari sidebar, halaman menolak akses langsung lewat URL, tombol aksi disembunyikan, dan <b>setiap aksi dicek ulang di server</b> — jadi akun tidak bisa melewati batas walau mengakali tampilan.</div>
        <div>🧑‍🔧 Teknisi hanya melihat pesanan yang ditugaskan kepadanya dan hanya boleh mengubah catatan progres miliknya sendiri.</div>
        <div>🛠️ Matriks ini bersumber dari <code>lib/rbac.ts</code> (sumber kebenaran tunggal untuk tampilan dan server). Untuk membatasi akses seseorang, ubah role akunnya; perubahan role / nonaktif berlaku seketika.</div>
      </div>
    </div>
  </div>);
}
