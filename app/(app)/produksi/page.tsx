import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { can } from '@/lib/rbac';
import { WO_STATUSES, TEKNISI_STATUSES } from '@/lib/constants';
import { num, tgl, tglJam, today } from '@/lib/util';
import { uploadUrl } from '@/lib/upload';
import { Card, Flash, PageHeader, Empty, StatusBadge } from '@/components/ui';
import { addProgress } from './actions';
import { ProgressActions } from '@/components/ProgressActions';
import { changeStatus, useMaterial } from '../pesanan/actions';
export const dynamic = 'force-dynamic';

const PROD = ['Menunggu bahan', 'Sedang dikerjakan', 'Pemeriksaan kualitas', 'Siap dikerjakan', 'Siap diserahkan'];

export default function Page({ searchParams }: { searchParams: any }) {
  const u = requireUser('produksi');
  const semua = can(u.role, 'pesanan.semua');
  const woF = Number(searchParams?.wo) || 0;
  const rows = all(`SELECT w.*, c.nama pelanggan, v.nopol, v.merek, v.tipe, v.foto, t.nama teknisi,
      (SELECT persen FROM work_progress p WHERE p.wo_id=w.id AND persen IS NOT NULL ORDER BY id DESC LIMIT 1) persen
    FROM work_orders w JOIN customers c ON c.id=w.customer_id JOIN vehicles v ON v.id=w.vehicle_id LEFT JOIN users t ON t.id=w.teknisi_id
    WHERE ${woF ? 'w.id=?' : `w.status IN (${PROD.map(() => '?').join(',')})`} ${semua ? '' : 'AND w.teknisi_id=?'}
    ORDER BY w.target_selesai`, ...(woF ? [woF] : PROD), ...(semua ? [] : [u.id]));
  const mats = all('SELECT id, kode, nama, satuan, stok FROM materials WHERE aktif=1 ORDER BY kode');
  const statusOpts = can(u.role, 'status.semua') ? WO_STATUSES : TEKNISI_STATUSES;
  return (<div>
    <PageHeader title={u.role === 'teknisi' ? 'Tugas saya' : 'Produksi'} desc="Pekerjaan yang sedang berjalan: catat progres, foto, pemakaian bahan, dan perbarui status.">
      {woF > 0 && <Link className="btn" href="/produksi">Tampilkan semua</Link>}
    </PageHeader>
    <Flash sp={searchParams} />
    {!rows.length && <Card><Empty>{semua ? 'Tidak ada pekerjaan di tahap produksi.' : 'Belum ada pekerjaan yang ditugaskan kepada Anda.'}</Empty></Card>}
    <div className="grid gap-5 xl:grid-cols-2">
      {rows.map((w: any) => {
        const prog = all('SELECT p.*, us.nama oleh FROM work_progress p LEFT JOIN users us ON us.id=p.user_id WHERE wo_id=? ORDER BY id DESC LIMIT 4', w.id);
        const back = woF ? `/produksi?wo=${w.id}` : '/produksi';
        const late = w.target_selesai < today();
        return (<div key={w.id} className="card">
          <div className="card-h"><span><Link className="link" href={`/pesanan/${w.id}`}>{w.nomor}</Link> · {w.jenis_pekerjaan}</span><StatusBadge status={w.status} /></div>
          <div className="card-b space-y-4">
            <div className="flex gap-3">
              {w.foto && <img src={uploadUrl(w.foto)} alt="" className="w-24 h-20 object-cover rounded" />}
              <div className="text-sm"><b>{w.nopol}</b> · {w.merek} {w.tipe}<div className="text-xs text-slate-500">{w.pelanggan} · Teknisi: {w.teknisi || '-'}</div>
                <div className={`text-xs ${late ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>Target: {tgl(w.target_selesai)}{late ? ' (terlambat)' : ''}</div>
                {w.deskripsi && <div className="text-xs mt-1">{w.deskripsi}</div>}</div>
            </div>
            <div><div className="flex justify-between text-xs mb-1"><span>Progres</span><span>{w.persen ?? 0}%</span></div><div className="h-2 rounded bg-stone-200"><div className="h-2 rounded bg-brand-600" style={{ width: `${w.persen ?? 0}%` }} /></div></div>
            {prog.length > 0 && <ul className="text-xs space-y-1.5">{prog.map((p: any) => <li key={p.id} className="flex gap-2">{p.foto && <a href={uploadUrl(p.foto)} target="_blank"><img src={uploadUrl(p.foto)} alt="" className="w-12 h-10 object-cover rounded" /></a>}<div>{p.catatan} {p.persen != null && <b>({p.persen}%)</b>}<div className="text-slate-400">{tglJam(p.at)} · {p.oleh}</div><ProgressActions u={u} p={p} back={back} /></div></li>)}</ul>}
            {can(u.role, 'progres.tulis') && <form action={addProgress} className="grid gap-2 sm:grid-cols-6 border-t pt-3">
              <div className="sm:col-span-6 text-xs font-semibold text-slate-600">➕ Tambah catatan progres</div>
              <input type="hidden" name="wo_id" value={w.id} /><input type="hidden" name="back" value={back} />
              <input name="catatan" placeholder="Catatan progres" className="input sm:col-span-4" required />
              <input name="persen" type="number" min={0} max={100} placeholder="%" className="input sm:col-span-2" />
              <input name="foto" type="file" accept="image/png,image/jpeg,image/webp" className="text-xs sm:col-span-4" />
              <button className="btn btn-primary btn-sm sm:col-span-2">Simpan progres</button>
            </form>}
            {can(u.role, 'bahan.pakai') && <form action={useMaterial} className="grid gap-2 sm:grid-cols-6">
              <input type="hidden" name="wo_id" value={w.id} /><input type="hidden" name="back" value={back} />
              <select name="material_id" className="input sm:col-span-3" required><option value="">— bahan dipakai —</option>{mats.map((m: any) => <option key={m.id} value={m.id}>{m.kode} · {m.nama} ({num(m.stok)} {m.satuan})</option>)}</select>
              <input name="qty" type="number" step="0.01" min="0.01" placeholder="Qty" className="input sm:col-span-1" required />
              <input type="hidden" name="tanggal" value={today()} />
              <button className="btn btn-sm sm:col-span-2">Catat pemakaian</button>
            </form>}
            <form action={changeStatus} className="flex flex-wrap gap-2 items-center">
              <input type="hidden" name="wo_id" value={w.id} /><input type="hidden" name="back" value={back} />
              <span className="text-xs text-slate-500">Ubah status:</span>
              {statusOpts.filter(s => s !== w.status && (u.role === 'teknisi' || PROD.includes(s) || s === 'Selesai')).map(s => <button key={s} name="status" value={s} className="btn btn-sm">{s}</button>)}
            </form>
          </div>
        </div>);
      })}
    </div>
  </div>);
}
