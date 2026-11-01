'use client';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';

/** Pemilih cabang aktif (hanya untuk pengguna tanpa cabang tetap, mis. pemilik). */
export function BranchSwitcher({ branches, active, action }: { branches: { id: number; nama: string }[]; active: number; action: (fd: FormData) => void }) {
  const p = usePathname();
  const f = useRef<HTMLFormElement>(null);
  return (<form ref={f} action={action} className="flex items-center gap-1.5 text-sm">
    <input type="hidden" name="back" value={p} />
    <label htmlFor="cabang-aktif" className="hidden md:inline text-xs font-semibold text-brand-700">🏢 Cabang:</label>
    <select id="cabang-aktif" name="branch_id" defaultValue={String(active)} key={active} onChange={() => f.current?.requestSubmit()} className="input !py-1 !w-auto text-sm font-semibold" title="Ganti cabang aktif">
      {branches.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
    </select>
    <noscript><button className="btn btn-sm">Ganti</button></noscript>
  </form>);
}
