import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { ROLES, MENUS, PERM_GROUPS, PERM_LABEL, LOCKED_PERMS, LOCKED_MENUS, ALWAYS_MENUS, can, canMenu, defaultCan, defaultMenu, permsFor, menusFor, roleList } from '@/lib/rbac';
import { Badge, Card, Flash, PageHeader, TableWrap } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { UserTabs } from '../tabs';
import { saveMatrix, resetMatrix, saveRoleInfo, addRole, deleteRole } from './actions';
export const dynamic = 'force-dynamic';

const COLORS = ['slate', 'violet', 'sky', 'green', 'amber', 'orange', 'red', 'teal'];

export default function Page({ searchParams }: { searchParams: any }) {
  requireUser('hak-akses');
  const roles = roleList();
  const kodes = roles.map(r => r.kode);
  const hl = kodes.includes(searchParams?.role) ? searchParams.role : '';
  const users = all('SELECT username, nama, role FROM users WHERE aktif=1 ORDER BY nama');
  const isBase = (r: string) => (ROLES as readonly string[]).includes(r);
  const col = (r: string, diff = false) => `text-center ${diff ? 'bg-amber-50' : hl === r ? 'bg-brand-50' : ''}`;
  const head = (<tr><th>Menu / aksi</th>{roles.map(r => <th key={r.kode} className={col(r.kode)}><Link href={hl === r.kode ? '/users/roles' : `/users/roles?role=${r.kode}`}><Badge color={r.warna}>{r.label}</Badge></Link></th>)}</tr>);
  const Box = ({ name, on, locked, title }: { name: string; on: boolean; locked: boolean; title?: string }) =>
    locked ? <input type="checkbox" checked={on} disabled readOnly title={title} className="h-4 w-4 opacity-60" />
      : <input type="checkbox" name={name} defaultChecked={on} className="h-4 w-4 accent-brand-700 cursor-pointer" />;
  return (<div>
    <PageHeader title="Hak akses (Role & izin)" desc="Atur menu dan aksi yang boleh dipakai tiap peran. Centang lalu klik Simpan — berlaku seketika untuk semua akun dengan peran tersebut. Pemilik selalu memiliki akses penuh." />
    <Flash sp={searchParams} />
    <UserTabs active="roles" />

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 mb-5">
      {roles.map(r => { const us = users.filter((u: any) => u.role === r.kode); return (
        <div key={r.kode} id={`role-${r.kode}`} className={`card p-4 ${hl === r.kode ? 'ring-2 ring-brand-500' : ''}`}>
          <form action={saveRoleInfo} className="space-y-2">
            <input type="hidden" name="kode" value={r.kode} />
            <div className="flex items-center justify-between gap-2"><Badge color={r.warna}>{r.label}</Badge><span className="text-xs text-slate-500">kode <code>{r.kode}</code> · {permsFor(r.kode).length} aksi · {menusFor(r.kode).length} menu{r.builtin ? '' : ' · custom'}</span></div>
            <div className="grid grid-cols-3 gap-2">
              <input name="label" defaultValue={r.label} maxLength={40} required className="input col-span-2" aria-label="Label tampilan" />
              <select name="warna" defaultValue={r.warna} className="input" aria-label="Warna">{COLORS.map(c => <option key={c} value={c}>{c}</option>)}</select>
            </div>
            <textarea name="deskripsi" defaultValue={r.deskripsi} maxLength={300} rows={2} className="input text-xs" placeholder="Keterangan peran" />
            <div className="text-xs"><span className="text-slate-500">Akun: </span>{us.length ? us.map((u: any) => u.username).join(', ') : <span className="italic text-slate-400">belum ada</span>}</div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-sm">Simpan label</button>
              {isBase(r.kode) && r.kode !== 'pemilik' && <ConfirmButton formAction={resetMatrix} msg={`Kembalikan hak akses ${r.label} ke bawaan aplikasi?`}>↺ Reset ke bawaan</ConfirmButton>}
              {!r.builtin && <ConfirmButton formAction={deleteRole} className="btn btn-sm text-red-700" msg={`Hapus peran ${r.label}? (harus tidak dipakai akun mana pun)`}>🗑 Hapus peran</ConfirmButton>}
            </div>
          </form>
        </div>); })}
    </div>

    <form action={saveMatrix} className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 sticky top-0 z-10 bg-stone-50/95 py-2">
        <button className="btn btn-primary">💾 Simpan matriks hak akses</button>
        <ConfirmButton formAction={resetMatrix} msg="Kembalikan SEMUA peran dasar ke hak akses bawaan aplikasi?">↺ Reset semua ke bawaan</ConfirmButton>
        <span className="text-xs text-slate-500">Sel berlatar kuning = berbeda dari bawaan aplikasi.</span>
      </div>
      <Card pad={false} title="🧭 Akses menu (sidebar & halaman)">
        <TableWrap><table className="tbl"><thead>{head}</thead><tbody>
          {MENUS.map(m => <tr key={m.key}><td>{m.icon} {m.label}{LOCKED_MENUS.includes(m.key) && <span className="text-xs text-slate-400"> · khusus pemilik</span>}{ALWAYS_MENUS.includes(m.key) && <span className="text-xs text-slate-400"> · selalu aktif</span>}</td>
            {roles.map(r => { const on = canMenu(r.kode, m.key); const locked = r.kode === 'pemilik' || LOCKED_MENUS.includes(m.key) || ALWAYS_MENUS.includes(m.key);
              return <td key={r.kode} className={col(r.kode, !locked && isBase(r.kode) && on !== defaultMenu(r.kode, m.key))}><Box name={`m|${r.kode}|${m.key}`} on={on} locked={locked} title={r.kode === 'pemilik' ? 'Pemilik selalu akses penuh' : 'Dikunci'} /></td>; })}</tr>)}
        </tbody></table></TableWrap>
      </Card>
      <Card pad={false} title="🛡️ Hak akses aksi (tombol Tambah / Edit / Hapus, dokumen & laporan)">
        <TableWrap><table className="tbl"><thead>{head}</thead><tbody>
          {PERM_GROUPS.map(g => [
            <tr key={g.label} className="bg-stone-50"><td colSpan={roles.length + 1} className="font-semibold text-brand-900">{g.icon} {g.label}</td></tr>,
            ...g.perms.map(p => <tr key={p}><td className="text-sm pl-6">{PERM_LABEL[p]}{LOCKED_PERMS.includes(p) && <span className="text-xs text-slate-400"> · khusus pemilik</span>}</td>
              {roles.map(r => { const on = can(r.kode, p); const locked = r.kode === 'pemilik' || LOCKED_PERMS.includes(p);
                return <td key={r.kode} className={col(r.kode, !locked && isBase(r.kode) && on !== defaultCan(r.kode, p))}><Box name={`p|${r.kode}|${p}`} on={on} locked={locked} title={r.kode === 'pemilik' ? 'Pemilik selalu akses penuh' : 'Dikunci'} /></td>; })}</tr>),
          ])}
        </tbody></table></TableWrap>
      </Card>
      <div><button className="btn btn-primary">💾 Simpan matriks hak akses</button></div>
    </form>

    <Card title="➕ Tambah peran custom" className="mt-5">
      <form action={addRole} className="grid gap-3 md:grid-cols-5 items-end">
        <label className="text-sm">Kode<input name="kode" required pattern="[a-z][a-z0-9_]{2,19}" placeholder="mis. kasir" className="input" /></label>
        <label className="text-sm">Label tampilan<input name="label" required maxLength={40} placeholder="mis. Kasir" className="input" /></label>
        <label className="text-sm">Salin hak akses dari<select name="salin" className="input"><option value="">— kosong (hanya Dashboard) —</option>{roles.filter(r => r.kode !== 'pemilik').map(r => <option key={r.kode} value={r.kode}>{r.label}</option>)}</select></label>
        <label className="text-sm">Warna<select name="warna" className="input">{COLORS.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
        <button className="btn btn-primary">Tambah peran</button>
        <input name="deskripsi" maxLength={300} placeholder="Keterangan (opsional)" className="input md:col-span-5" />
      </form>
    </Card>

    <div className="mt-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 space-y-1">
      <div>👑 <b>Pemilik selalu akses penuh</b> dan tidak bisa dikunci: menu Pengguna & Hak akses serta izin kelola pengguna khusus pemilik. Menu Dashboard selalu aktif untuk semua peran agar akun tidak pernah tanpa menu.</div>
      <div>🔒 Menu yang tidak diizinkan disembunyikan dari sidebar, halaman menolak akses lewat URL, tombol aksi disembunyikan, dan <b>setiap aksi dicek ulang di server</b> berdasarkan matriks ini.</div>
      <div>🧑‍🔧 Peran tanpa izin &quot;lihat semua pesanan&quot; hanya melihat pesanan yang ditugaskan kepadanya. Kode peran tidak berubah saat label diganti.</div>
    </div>
  </div>);
}
