import { requireUser } from '@/lib/auth';
import { menusFor, roleLabel } from '@/lib/rbac';
import { one, settings } from '@/lib/db';
import { Nav } from '@/components/Nav';
import { logoutAction } from '../login/actions';
import { BranchSwitcher } from '@/components/BranchSwitcher';
import { activeBranch, branchesFor, canSwitchBranch } from '@/lib/branch';
import { switchBranch } from './cabang/actions';
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const u = requireUser();
  const s = settings();
  const cab = activeBranch(u);
  const low = one('SELECT COUNT(*) n FROM materials WHERE branch_id=? AND aktif=1 AND stok<=minimum', cab.id).n;
  const tugas = u.role === 'teknisi' ? one("SELECT COUNT(*) n FROM work_orders WHERE branch_id=? AND teknisi_id=? AND status NOT IN ('Selesai','Dibatalkan')", cab.id, u.id).n : 0;
  const badges: Record<string, number> = { '/persediaan': ['pemilik', 'gudang', 'admin'].includes(u.role) ? low : 0, '/produksi': tugas };
  const items = menusFor(u.role).map(m => ({ href: m.href, label: m.label, icon: m.icon, group: m.group, badge: badges[m.href] }));
  const sidebar = (<>
    <div className="px-5 py-4 flex items-center gap-3 border-b border-brand-700">
      {s.logo ? <img src="/api/logo" alt="Logo" className="w-10 h-10 object-contain rounded bg-white p-0.5" /> : <div className="w-10 h-10 rounded-lg bg-accent-400 text-brand-900 grid place-items-center font-black">BI</div>}
      <div className="leading-tight min-w-0"><div className="text-white font-bold text-sm truncate">{s.nama_usaha}</div><div className="text-brand-200 text-xs">Cabang {cab.nama}</div></div>
    </div>
    <Nav items={items} />
  </>);
  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:block w-64 shrink-0 bg-brand-900 min-h-screen sticky top-0 h-screen overflow-y-auto">{sidebar}</aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-stone-200 sticky top-0 z-20">
          <div className="flex items-center gap-3 px-4 md:px-6 h-14">
            <details className="lg:hidden relative">
              <summary className="btn btn-sm list-none cursor-pointer">☰ Menu</summary>
              <div className="absolute left-0 mt-2 w-64 max-h-[80vh] overflow-y-auto rounded-xl bg-brand-900 shadow-xl z-30">{sidebar}</div>
            </details>
            <div className="min-w-0 flex-1 text-sm font-bold text-brand-900 truncate">{s.nama_usaha}</div>
            {canSwitchBranch(u)
              ? <BranchSwitcher branches={branchesFor(u).map(b => ({ id: b.id, nama: b.nama }))} active={cab.id} action={switchBranch} />
              : <span className="badge bg-brand-50 text-brand-800 border border-brand-200" title="Akun Anda terkunci pada cabang ini">🏢 Cabang: {cab.nama} 🔒</span>}
            <div className="text-right hidden sm:block leading-tight">
              <div className="text-sm font-semibold">{u.nama}</div>
              <div className="text-xs text-brand-600">{roleLabel(u.role)}</div>
            </div>
            <form action={logoutAction}><button className="btn btn-sm">Keluar</button></form>
          </div>
        </header>
        <main className="p-4 md:p-6 flex-1">{children}</main>
        <footer className="px-6 py-3 text-xs text-slate-400 border-t bg-white">© 2026 idnindonesia @nickibnu</footer>
      </div>
    </div>);
}
