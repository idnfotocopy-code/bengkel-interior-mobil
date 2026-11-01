import { currentUser } from '@/lib/auth';
import { activeBranch, canSwitchBranch } from '@/lib/branch';

/** Badge baca-saja: data yang disimpan lewat formulir ini masuk ke cabang aktif. */
export function BranchBadge({ label = 'Disimpan ke cabang' }: { label?: string }) {
  const u = currentUser();
  if (!u) return null;
  const b = activeBranch(u);
  return (<div className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs text-brand-800" title={canSwitchBranch(u) ? 'Ganti cabang lewat pemilih Cabang di bagian atas.' : 'Akun Anda terkunci pada cabang ini.'}>
    🏢 {label}: <b>{b.nama}</b>{canSwitchBranch(u) ? '' : ' 🔒'}
  </div>);
}
