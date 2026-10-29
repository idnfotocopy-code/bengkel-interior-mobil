import { can } from '@/lib/rbac';
import type { User } from '@/lib/auth';
import { ConfirmButton } from '@/components/Confirm';
import { updateProgress, deleteProgress } from '@/app/(app)/produksi/actions';

/** Tombol Edit (inline) & Hapus untuk satu catatan progres. Teknisi hanya untuk catatan miliknya. */
export function ProgressActions({ u, p, back }: { u: User; p: any; back: string }) {
  if (!can(u.role, 'progres.tulis')) return null;
  if (!can(u.role, 'progres.kelola') && p.user_id !== u.id) return null;
  return (<div className="mt-1 flex flex-wrap items-start gap-2">
    <details className="text-xs">
      <summary className="cursor-pointer link">✏️ Edit</summary>
      <form action={updateProgress} className="mt-1 grid gap-1 sm:grid-cols-6 rounded border bg-stone-50 p-2">
        <input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={back} />
        <input name="catatan" defaultValue={p.catatan} className="input sm:col-span-4" required />
        <input name="persen" type="number" min={0} max={100} defaultValue={p.persen ?? ''} placeholder="%" className="input sm:col-span-2" />
        <input name="foto" type="file" accept="image/png,image/jpeg,image/webp" className="text-xs sm:col-span-4" />
        {p.foto && <label className="text-xs sm:col-span-2"><input type="checkbox" name="hapus_foto" value="1" /> hapus foto</label>}
        <button className="btn btn-primary btn-sm sm:col-span-6">Simpan perubahan</button>
      </form>
    </details>
    <form action={deleteProgress}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={back} />
      <ConfirmButton className="text-xs text-red-600 hover:underline" msg="Hapus catatan progres ini?">🗑 Hapus</ConfirmButton></form>
  </div>);
}
