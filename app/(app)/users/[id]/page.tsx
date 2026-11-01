import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { one, all } from '@/lib/db';
import { roleKodes, roleLabel, roleColor, roleDesc, MENUS, PERM_GROUPS, PERM_LABEL, can, canMenu } from '@/lib/rbac';
import { ConfirmButton } from '@/components/Confirm';
import { tglJam } from '@/lib/util';
import { Badge, Card, Flash, PageHeader, Field, TableWrap } from '@/components/ui';
import { saveUser, deleteUser, toggleUser } from '../actions';
import { listBranches } from '@/lib/branch';
export const dynamic = 'force-dynamic';

export default function Page({ params, searchParams }: { params: { id: string }; searchParams: any }) {
  const me = requireUser('users');
  const x = one('SELECT * FROM users WHERE id=?', Number(params.id));
  if (!x) redirect('/users?err=' + encodeURIComponent('Pengguna tidak ditemukan.'));
  const self = x.id === me.id;
  const back = `/users/${x.id}`;
  const logs = all('SELECT * FROM audit_logs WHERE user_id=? ORDER BY id DESC LIMIT 15', x.id);
  return (<div>
    <PageHeader title={`Edit pengguna: ${x.username}`} desc="Ubah data, role, status aktif, atau reset kata sandi. Perubahan role berlaku langsung di request berikutnya.">
      <Link href="/users" className="btn">← Kembali</Link>
    </PageHeader>
    <Flash sp={searchParams} />
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="lg:col-span-2 space-y-5">
        <Card title="Data akun"><form action={saveUser} className="space-y-3">
          <input type="hidden" name="id" value={x.id} /><input type="hidden" name="back" value={back} />
          <Field label="Username"><input value={x.username} disabled className="input bg-stone-100 font-mono" /></Field>
          <Field label="Nama lengkap"><input name="nama" defaultValue={x.nama} required className="input" /></Field>
          <Field label="Telepon"><input name="telepon" defaultValue={x.telepon || ''} className="input" /></Field>
          <Field label="Role (hak akses)">
            {self ? <><input type="hidden" name="role" value={x.role} /><input value={roleLabel(x.role)} disabled className="input bg-stone-100" /><p className="text-xs text-slate-500 mt-1">Anda tidak dapat mengubah role akun sendiri.</p></>
              : <select name="role" defaultValue={x.role} className="input">{roleKodes().map(r => <option key={r} value={r}>{roleLabel(r)}{roleDesc(r) ? ' — ' + roleDesc(r).split(':')[0].split('.')[0] : ''}</option>)}</select>}
          </Field>
          <Field label="Cabang">
            <select name="branch_id" defaultValue={x.branch_id ?? ''} className="input">
              <option value="">Semua cabang (khusus pemilik — bisa berpindah cabang)</option>
              {listBranches().map(b => <option key={b.id} value={b.id}>{b.nama}{b.aktif ? '' : ' (nonaktif)'}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-1">Selain pemilik wajib memilih satu cabang; pengguna hanya melihat & mencatat data cabang tersebut.</p>
          </Field>
          {self ? <input type="hidden" name="aktif" value="1" />
            : <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="aktif" value="1" defaultChecked={!!x.aktif} /> Akun aktif (boleh login)</label>}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
            <div className="text-sm font-semibold text-amber-900">🔑 Reset kata sandi (opsional)</div>
            <input name="password" type="password" minLength={8} placeholder="Kata sandi baru (min. 8)" autoComplete="new-password" className="input" />
            <input name="password2" type="password" minLength={8} placeholder="Ulangi kata sandi baru" autoComplete="new-password" className="input" />
            <p className="text-xs text-amber-800">Kosongkan bila tidak diganti. Bila diisi, semua sesi login akun ini akan diputus.</p>
          </div>
          <button className="btn btn-primary w-full">💾 Simpan perubahan</button>
        </form></Card>
        {!self && <Card title="Tindakan">
          <div className="flex flex-wrap gap-2">
            <form action={toggleUser}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="back" value={back} />
              <ConfirmButton className="btn" msg={x.aktif ? `Nonaktifkan ${x.username}?` : `Aktifkan ${x.username}?`}>{x.aktif ? '⏸ Nonaktifkan' : '▶ Aktifkan'}</ConfirmButton></form>
            <form action={deleteUser}><input type="hidden" name="id" value={x.id} />
              <ConfirmButton className="btn text-red-600" msg={`Hapus pengguna ${x.username}? Bila sudah punya riwayat transaksi, akun hanya dinonaktifkan.`}>🗑 Hapus</ConfirmButton></form>
          </div>
          <p className="text-xs text-slate-500 mt-2">Dibuat {tglJam(x.created_at)} · Login terakhir {tglJam(x.last_login)}</p>
        </Card>}
      </div>
      <div className="lg:col-span-3 space-y-5">
        <Card title={<>Akses saat ini: <Badge color={roleColor(x.role)}>{roleLabel(x.role)}</Badge> {x.aktif ? <Badge color="green">Aktif</Badge> : <Badge color="red">Nonaktif</Badge>}</>}
          actions={<Link href={`/users/roles?role=${x.role}`} className="btn btn-sm">Lihat matriks</Link>}>
          <p className="text-sm text-slate-600 mb-3">{roleDesc(x.role)}</p>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Menu yang terlihat</div>
          <div className="flex flex-wrap gap-1.5 mb-4">{MENUS.map(m => canMenu(x.role, m.key) ? <Badge key={m.key} color="teal">{m.icon} {m.label}</Badge> : <span key={m.key} className="badge bg-stone-100 text-stone-400 line-through">{m.label}</span>)}</div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Aksi yang diizinkan</div>
          <div className="grid gap-x-4 sm:grid-cols-2">{PERM_GROUPS.map(g => <div key={g.label} className="py-1">
            <div className="text-sm font-semibold text-brand-900">{g.icon} {g.label}</div>
            <ul className="text-sm">{g.perms.map(p => <li key={p} className={can(x.role, p) ? 'text-emerald-700' : 'text-stone-400'}>{can(x.role, p) ? '✓' : '✕'} {PERM_LABEL[p]}</li>)}</ul>
          </div>)}</div>
        </Card>
        <Card pad={false} title="Aktivitas terakhir akun ini">
          <TableWrap><table className="tbl"><thead><tr><th>Waktu</th><th>Aksi</th><th>Data</th><th>Detail</th></tr></thead><tbody>
            {logs.map((l: any) => <tr key={l.id}><td className="whitespace-nowrap text-xs">{tglJam(l.at)}</td><td>{l.aksi}</td><td className="text-xs">{l.entitas} #{l.entitas_id}</td><td className="text-xs max-w-xs truncate">{l.detail}</td></tr>)}
            {!logs.length && <tr><td colSpan={4} className="text-center text-sm text-slate-400 italic py-4">Belum ada aktivitas.</td></tr>}
          </tbody></table></TableWrap>
        </Card>
      </div>
    </div>
  </div>);
}
