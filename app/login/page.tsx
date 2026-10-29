import { loginAction } from './actions';
import { Flash } from '@/components/ui';
import { settings } from '@/lib/db';
import { uploadUrl } from '@/lib/upload';
export const dynamic = 'force-dynamic';
export default function Login({ searchParams }: { searchParams: any }) {
  const s = settings();
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl bg-white">
        <div className="bg-brand-900 text-white p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-16 -bottom-16 w-72 h-72 rounded-full bg-brand-700/40" />
          <div className="relative">
            <div className="flex items-center gap-3">
              {s.logo ? <img src={`/api/logo`} alt="Logo" className="w-14 h-14 object-contain rounded bg-white p-1" /> : <div className="w-14 h-14 rounded-xl bg-accent-400 text-brand-900 grid place-items-center text-2xl font-black">BI</div>}
              <div><div className="text-accent-400 text-xs font-bold tracking-widest">SISTEM ADMINISTRASI</div><div className="text-lg font-bold leading-tight">{s.nama_usaha}</div></div>
            </div>
            <h1 className="mt-8 text-3xl font-extrabold leading-tight">Kelola bengkel<br />lebih tertata.</h1>
            <p className="mt-3 text-brand-100 text-sm">Pelanggan, kendaraan, work order, produksi, stok bahan, pembayaran, invoice, dan laporan PDF dalam satu aplikasi.</p>
          </div>
          <div className="relative mt-8 text-xs text-brand-200">{s.tagline}</div>
        </div>
        <div className="p-8">
          <h2 className="text-xl font-bold text-brand-900">Masuk</h2>
          <p className="text-sm text-slate-500 mb-5">Gunakan akun yang telah didaftarkan pemilik.</p>
          <Flash sp={searchParams} />
          <form action={loginAction} className="space-y-3">
            <div><label className="label">Username</label><input name="username" className="input" required autoFocus autoComplete="username" /></div>
            <div><label className="label">Password</label><input name="password" type="password" className="input" required autoComplete="current-password" /></div>
            <button className="btn btn-primary w-full py-2.5">Masuk</button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-400">© 2026 idnindonesia @nickibnu</p>
        </div>
      </div>
    </div>);
}
