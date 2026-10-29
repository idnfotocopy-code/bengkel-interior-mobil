import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { all, one } from '@/lib/db';
import { can } from '@/lib/rbac';
import { woForUser } from '@/lib/access';
import { woSummary, activeInvoice } from '@/lib/biz';
import { WO_STATUSES, TEKNISI_STATUSES, WO_CANCELLED, PAYMENT_TYPES, PAYMENT_METHODS } from '@/lib/constants';
import { rp, num, tgl, tglJam, today, addDays } from '@/lib/util';
import { uploadUrl } from '@/lib/upload';
import { Card, Flash, PageHeader, Empty, TableWrap, StatusBadge, InvBadge, Field } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { updateWO, addItem, updateItem, deleteItem, changeStatus, cancelWO, deleteWO, useMaterial, cancelUsage } from '../actions';
import { ProgressActions } from '@/components/ProgressActions';
import { addPayment, deletePayment, createInvoice } from '../../keuangan/actions';
export const dynamic = 'force-dynamic';

export default function Page({ params, searchParams }: { params: { id: string }; searchParams: any }) {
  const u = requireUser('pesanan');
  const w0 = woForUser(u, Number(params.id));
  const w = one(`SELECT w.*, c.nama pelanggan, c.kode, c.telepon, c.alamat, v.nopol, v.merek, v.tipe, v.tahun, v.warna, v.kondisi, v.foto, t.nama teknisi
    FROM work_orders w JOIN customers c ON c.id=w.customer_id JOIN vehicles v ON v.id=w.vehicle_id LEFT JOIN users t ON t.id=w.teknisi_id WHERE w.id=?`, w0.id);
  const items = all('SELECT * FROM work_order_items WHERE wo_id=? ORDER BY jenis DESC, id', w.id);
  const sm = woSummary(w.id);
  const usage = all('SELECT mu.*, m.kode, m.nama, m.satuan, us.nama oleh FROM material_usage mu JOIN materials m ON m.id=mu.material_id LEFT JOIN users us ON us.id=mu.user_id WHERE mu.wo_id=? ORDER BY mu.id', w.id);
  const pays = all('SELECT p.*, a.nama akun FROM payments p LEFT JOIN cash_accounts a ON a.id=p.cash_account_id WHERE p.wo_id=? ORDER BY p.tanggal, p.id', w.id);
  const invoices = all('SELECT * FROM invoices WHERE wo_id=? ORDER BY id DESC', w.id);
  const inv = activeInvoice(w.id);
  const hist = all('SELECT h.*, us.nama oleh FROM wo_status_history h LEFT JOIN users us ON us.id=h.user_id WHERE h.wo_id=? ORDER BY h.id DESC', w.id);
  const prog = all('SELECT p.*, us.nama oleh FROM work_progress p LEFT JOIN users us ON us.id=p.user_id WHERE p.wo_id=? ORDER BY p.id DESC', w.id);
  const mats = all('SELECT id, kode, nama, satuan, stok FROM materials WHERE aktif=1 ORDER BY kode');
  const teknisi = all("SELECT id, nama FROM users WHERE role='teknisi' AND aktif=1 ORDER BY nama");
  const jobs = all<{ nama: string }>('SELECT nama FROM job_types WHERE aktif=1 ORDER BY urutan, nama').map(j => j.nama);
  const jobLegacy = w.jenis_pekerjaan && !jobs.includes(w.jenis_pekerjaan) ? w.jenis_pekerjaan : '';
  const accounts = all('SELECT * FROM cash_accounts WHERE aktif=1');
  const kelola = can(u.role, 'pesanan.kelola'), harga = can(u.role, 'pesanan.harga');
  const seeMoney = !['teknisi', 'gudang'].includes(u.role);
  const seeCost = ['pemilik', 'keuangan'].includes(u.role);
  const batal = w.status === WO_CANCELLED;
  const statusOpts = can(u.role, 'status.semua') ? WO_STATUSES : (u.role === 'teknisi' ? TEKNISI_STATUSES : []);
  const pdf = (doc: string, id = w.id) => `/api/pdf/${doc}?id=${id}`;
  const stepIdx = WO_STATUSES.indexOf(w.status);

  return (<div id="top">
    <PageHeader title={`${w.nomor} · ${w.jenis_pekerjaan || '-'}`} desc={`${w.pelanggan} (${w.kode}) · ${w.nopol} ${w.merek} ${w.tipe} ${w.tahun || ''}`}>
      <Link href="/pesanan" className="btn">← Daftar</Link>
      {can(u.role, 'dokumen.pesanan') && <>
        {seeMoney && <a className="btn" href={pdf('penawaran')} target="_blank">📄 Surat Penawaran</a>}
        <a className="btn" href={pdf('wo')} target="_blank">📄 Work Order</a>
        <a className="btn" href={pdf('serah-terima')} target="_blank">📄 Serah Terima</a>
      </>}
      {can(u.role, 'dokumen.keuangan') && inv && <a className="btn btn-accent" href={pdf('invoice', inv.id)} target="_blank">📄 Invoice</a>}
    </PageHeader>
    <Flash sp={searchParams} />
    {searchParams?.kwt && <div className="mb-4 -mt-2"><a className="btn btn-accent" target="_blank" href={pdf('kuitansi', Number(searchParams.kwt))}>🧾 Cetak kuitansi pembayaran barusan</a></div>}

    {/* alur status */}
    <div className="card p-3 mb-5 overflow-x-auto"><ol className="flex gap-1 text-[11px] min-w-max">
      {WO_STATUSES.map((s, i) => <li key={s} className={`px-2 py-1 rounded-full border ${batal ? 'border-stone-200 text-stone-400' : i < stepIdx ? 'bg-brand-100 border-brand-200 text-brand-800' : i === stepIdx ? 'bg-brand-700 border-brand-700 text-white font-semibold' : 'border-stone-200 text-stone-500'}`}>{i + 1}. {s}</li>)}
      {batal && <li className="px-2 py-1 rounded-full bg-red-600 text-white font-semibold">Dibatalkan</li>}
    </ol></div>

    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        <Card title="Rincian jasa / barang" pad={false}>
          <TableWrap><table className="tbl"><thead><tr><th>Jenis</th><th>Deskripsi</th><th className="num">Qty</th>{seeMoney && <><th className="num">Harga</th><th className="num">Jumlah</th></>}{harga && !batal && <th></th>}</tr></thead><tbody>
            {items.map((it: any) => <tr key={it.id}><td className="capitalize">{it.jenis}</td><td>{it.deskripsi}</td><td className="num">{num(it.qty)} {it.satuan}</td>
              {seeMoney && <><td className="num">{rp(it.harga)}</td><td className="num">{rp(it.qty * it.harga)}</td></>}
              {harga && !batal && <td className="whitespace-nowrap"><details className="inline-block align-top"><summary className="btn btn-sm list-none cursor-pointer">✏️ Edit</summary>
                <form action={updateItem} className="mt-2 grid gap-1 w-72 rounded border bg-white p-2 shadow-lg">
                  <input type="hidden" name="wo_id" value={w.id} /><input type="hidden" name="item_id" value={it.id} />
                  <select name="jenis" defaultValue={it.jenis} className="input"><option value="jasa">Jasa</option><option value="barang">Barang</option></select>
                  <input name="deskripsi" defaultValue={it.deskripsi} className="input" required />
                  <div className="grid grid-cols-3 gap-1"><input name="qty" type="number" step="any" min={0} defaultValue={it.qty} className="input" /><input name="satuan" defaultValue={it.satuan} className="input" /><input name="harga" type="number" step="any" min={0} defaultValue={it.harga} className="input" /></div>
                  <button className="btn btn-primary btn-sm">Simpan item</button>
                </form></details> <form action={deleteItem} className="inline"><input type="hidden" name="wo_id" value={w.id} /><input type="hidden" name="item_id" value={it.id} /><ConfirmButton msg={`Hapus item "${it.deskripsi}"?`} className="btn btn-sm text-red-600">🗑 Hapus</ConfirmButton></form></td>}</tr>)}
            {!items.length && <tr><td colSpan={6}><Empty>Belum ada item.</Empty></td></tr>}
            {seeMoney && <>
              <tr><td colSpan={4} className="num">Subtotal (jasa {rp(sm.jasa)} + barang {rp(sm.barang)})</td><td className="num">{rp(sm.subtotal)}</td></tr>
              {sm.diskon > 0 && <tr><td colSpan={4} className="num">Diskon</td><td className="num">− {rp(sm.diskon)}</td></tr>}
              <tr className="font-bold"><td colSpan={4} className="num">TOTAL</td><td className="num">{rp(sm.total)}</td></tr>
            </>}
          </tbody></table></TableWrap>
          {harga && !batal && <form action={addItem} className="grid gap-2 sm:grid-cols-12 p-4 border-t bg-stone-50">
            <input type="hidden" name="wo_id" value={w.id} />
            <select name="jenis" className="input sm:col-span-2"><option value="jasa">Jasa</option><option value="barang">Barang</option></select>
            <input name="deskripsi" placeholder="Deskripsi item" className="input sm:col-span-4" required />
            <input name="qty" type="number" step="0.01" defaultValue={1} className="input sm:col-span-1" />
            <input name="satuan" defaultValue="paket" className="input sm:col-span-2" />
            <input name="harga" type="number" step="any" min={0} placeholder="Harga" className="input sm:col-span-2" required />
            <button className="btn btn-primary sm:col-span-1">+</button>
          </form>}
        </Card>

        <Card title="Pemakaian bahan (mengurangi stok)" pad={false}>
          <TableWrap><table className="tbl"><thead><tr><th>Tanggal</th><th>Bahan</th><th className="num">Qty</th>{seeCost && <th className="num">Biaya</th>}<th>Oleh</th><th></th></tr></thead><tbody>
            {usage.map((m: any) => <tr key={m.id} className={m.batal ? 'line-through text-slate-400' : ''}><td>{tgl(m.tanggal)}</td><td>{m.kode} · {m.nama}</td><td className="num">{num(m.qty)} {m.satuan}</td>{seeCost && <td className="num">{rp(m.qty * m.harga_satuan)}</td>}<td className="text-xs">{m.oleh}</td>
              <td>{!m.batal && can(u.role, 'bahan.batal') && <form action={cancelUsage}><input type="hidden" name="wo_id" value={w.id} /><input type="hidden" name="usage_id" value={m.id} /><ConfirmButton className="btn btn-sm" msg="Batalkan pemakaian ini? Stok akan dikembalikan dan tercatat sebagai koreksi.">Batal</ConfirmButton></form>}{m.batal ? 'dibatalkan' : ''}</td></tr>)}
            {!usage.length && <tr><td colSpan={6}><Empty>Belum ada pemakaian bahan.</Empty></td></tr>}
          </tbody></table></TableWrap>
          {can(u.role, 'bahan.pakai') && !batal && <form action={useMaterial} className="grid gap-2 sm:grid-cols-12 p-4 border-t bg-stone-50">
            <input type="hidden" name="wo_id" value={w.id} />
            <select name="material_id" className="input sm:col-span-6" required><option value="">— pilih bahan —</option>{mats.map((m: any) => <option key={m.id} value={m.id}>{m.kode} · {m.nama} (stok {num(m.stok)} {m.satuan})</option>)}</select>
            <input name="qty" type="number" step="0.01" min="0.01" placeholder="Jumlah" className="input sm:col-span-2" required />
            <input name="tanggal" type="date" defaultValue={today()} className="input sm:col-span-3" />
            <button className="btn btn-primary sm:col-span-1">Catat</button>
          </form>}
        </Card>

        {seeMoney && <Card title="Pembayaran & invoice" pad={false} actions={can(u.role, 'invoice.kelola') && !batal && <form action={createInvoice} className="flex gap-2 items-center">
            <input type="hidden" name="wo_id" value={w.id} /><span className="text-xs text-slate-500">Jatuh tempo</span><input type="date" name="jatuh_tempo" className="input py-1 w-36" defaultValue={addDays(today(), 7)} />
            {inv ? <ConfirmButton className="btn btn-sm" msg={`Invoice ${inv.nomor} akan dibatalkan dan diganti invoice baru dengan total terkini. Lanjutkan?`}>Terbitkan ulang invoice</ConfirmButton> : <button className="btn btn-sm btn-primary">Buat invoice</button>}</form>}>
          {invoices.length > 0 && <div className="px-4 py-3 border-b text-sm space-y-1">{invoices.map((i: any) => <div key={i.id} className="flex flex-wrap items-center gap-2"><b>{i.nomor}</b> · {tgl(i.tanggal)} · jatuh tempo {tgl(i.jatuh_tempo)} · {rp(i.total)} <InvBadge status={i.status} />{i.status !== 'Batal' && can(u.role, 'dokumen.keuangan') && <a className="link text-xs" target="_blank" href={pdf('invoice', i.id)}>PDF</a>}</div>)}</div>}
          <TableWrap><table className="tbl"><thead><tr><th>No. kuitansi</th><th>Tanggal</th><th>Jenis</th><th>Metode / akun</th><th className="num">Jumlah</th><th></th></tr></thead><tbody>
            {pays.map((p: any) => <tr key={p.id}><td>{p.nomor}</td><td>{tgl(p.tanggal)}</td><td>{p.jenis}</td><td className="text-xs">{p.metode} · {p.akun || '-'}</td><td className="num">{rp(p.jumlah)}</td>
              <td className="whitespace-nowrap">{can(u.role, 'dokumen.keuangan') && <a className="btn btn-sm" target="_blank" href={pdf('kuitansi', p.id)}>Kuitansi</a>} {can(u.role, 'bayar.hapus') && <form action={deletePayment} className="inline"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={`/pesanan/${w.id}`} /><ConfirmButton className="btn btn-sm text-red-600" msg={`Hapus pembayaran ${p.nomor}?`}>Hapus</ConfirmButton></form>}</td></tr>)}
            {!pays.length && <tr><td colSpan={6}><Empty>Belum ada pembayaran.</Empty></td></tr>}
          </tbody></table></TableWrap>
          {can(u.role, 'bayar.catat') && !batal && <form action={addPayment} className="grid gap-2 sm:grid-cols-12 p-4 border-t bg-stone-50">
            <input type="hidden" name="wo_id" value={w.id} />
            <select name="jenis" className="input sm:col-span-2" defaultValue={sm.paid > 0 ? 'Pelunasan' : 'DP'}>{PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            <input name="jumlah" type="number" step="any" min={1} placeholder="Jumlah" defaultValue={sm.sisa > 0 ? Math.round(sm.paid > 0 ? sm.sisa : sm.sisa / 2) : ''} className="input sm:col-span-2" required />
            <input name="tanggal" type="date" defaultValue={today()} className="input sm:col-span-2" />
            <select name="metode" className="input sm:col-span-2">{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</select>
            <select name="cash_account_id" className="input sm:col-span-2">{accounts.map((a: any) => <option key={a.id} value={a.id}>{a.nama}</option>)}</select>
            <button className="btn btn-primary sm:col-span-2">Catat bayar</button>
          </form>}
        </Card>}

        <Card title="Progres pekerjaan" actions={can(u.role, 'progres.tulis') && <Link href={`/produksi?wo=${w.id}`} className="btn btn-sm">+ Catat progres</Link>}>
          {prog.length ? <ul className="space-y-3">{prog.map((p: any) => <li key={p.id} className="flex gap-3">
            {p.foto && <a href={uploadUrl(p.foto)} target="_blank"><img src={uploadUrl(p.foto)} alt="" className="w-20 h-16 object-cover rounded" /></a>}
            <div className="text-sm"><div>{p.catatan} {p.persen != null && <b className="text-brand-700">({p.persen}%)</b>}</div><div className="text-xs text-slate-500">{tglJam(p.at)} · {p.oleh}</div><ProgressActions u={u} p={p} back={`/pesanan/${w.id}`} /></div></li>)}</ul> : <Empty>Belum ada catatan progres.</Empty>}
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Status pekerjaan">
          <div className="mb-3"><StatusBadge status={w.status} /> {w.tgl_selesai && <span className="text-xs text-slate-500">selesai {tgl(w.tgl_selesai)}</span>}</div>
          {statusOpts.length > 0 && !batal && <form action={changeStatus} className="space-y-2">
            <input type="hidden" name="wo_id" value={w.id} />
            <select name="status" className="input" defaultValue={WO_STATUSES[Math.min(stepIdx + 1, WO_STATUSES.length - 1)]}>{statusOpts.map(s => <option key={s}>{s}</option>)}</select>
            <input name="catatan" className="input" placeholder="Catatan perubahan (opsional)" />
            <button className="btn btn-primary w-full">Ubah status</button>
          </form>}
          {can(u.role, 'pesanan.batal') && !batal && w.status !== 'Selesai' && <form action={cancelWO} className="mt-3 pt-3 border-t space-y-2"><input type="hidden" name="wo_id" value={w.id} /><input name="alasan" className="input" placeholder="Alasan pembatalan *" required /><ConfirmButton className="btn btn-danger w-full" msg={`Batalkan pesanan ${w.nomor}? Invoice terkait ikut dibatalkan.`}>⛔ Batalkan pesanan</ConfirmButton></form>}
          {can(u.role, 'pesanan.hapus') && <form action={deleteWO} className="mt-2"><input type="hidden" name="wo_id" value={w.id} /><ConfirmButton className="btn btn-sm w-full text-red-600" msg={`Hapus permanen pesanan ${w.nomor}? Hanya bisa bila belum ada pembayaran, invoice, atau pemakaian bahan.`}>🗑 Hapus pesanan permanen</ConfirmButton></form>}
        </Card>

        {seeMoney && <Card title="Ringkasan biaya">
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between"><dt>Harga pekerjaan</dt><dd className="font-semibold">{rp(sm.total)}</dd></div>
            <div className="flex justify-between"><dt>Uang muka (DP)</dt><dd>{rp(sm.dp)}</dd></div>
            <div className="flex justify-between"><dt>Total dibayar</dt><dd>{rp(sm.paid)}</dd></div>
            <div className="flex justify-between border-t pt-1.5"><dt>Sisa tagihan</dt><dd className={`font-bold ${sm.sisa > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{rp(sm.sisa)}</dd></div>
            {seeCost && <>
              <div className="pt-2 text-xs font-semibold uppercase text-slate-500">Estimasi laba proyek</div>
              <div className="flex justify-between"><dt>Biaya bahan (pemakaian)</dt><dd>− {rp(sm.bahan)}</dd></div>
              <div className="flex justify-between"><dt>Tenaga kerja langsung</dt><dd>− {rp(sm.tk)}</dd></div>
              <div className="flex justify-between"><dt>Biaya operasional proyek</dt><dd>− {rp(sm.ops)}</dd></div>
              <div className="flex justify-between border-t pt-1.5"><dt>Estimasi laba kotor</dt><dd className="font-bold">{rp(sm.laba)}</dd></div>
              <p className="text-[11px] text-slate-500">Uang muka adalah penerimaan, bukan otomatis keuntungan.</p>
            </>}
          </dl>
        </Card>}

        <Card id="edit" title={kelola ? '✏️ Edit data pesanan' : 'Data pesanan'}>
          <form action={updateWO} className="space-y-3">
            <input type="hidden" name="id" value={w.id} />
            <Field label="Jenis pekerjaan"><select name="jenis_pekerjaan" defaultValue={w.jenis_pekerjaan || ''} className="input" disabled={!kelola} required><option value="" disabled>— pilih jenis pekerjaan —</option>{jobLegacy && <option value={jobLegacy}>{jobLegacy} (di luar master)</option>}{jobs.map(j => <option key={j} value={j}>{j}</option>)}</select></Field>
            <Field label="Deskripsi"><textarea name="deskripsi" defaultValue={w.deskripsi} className="input" rows={2} disabled={!kelola} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tgl masuk"><input type="date" name="tgl_masuk" defaultValue={w.tgl_masuk} className="input" disabled={!kelola} /></Field>
              <Field label="Target selesai"><input type="date" name="target_selesai" defaultValue={w.target_selesai} className="input" disabled={!kelola} /></Field>
            </div>
            <Field label="Teknisi"><select name="teknisi_id" defaultValue={w.teknisi_id || ''} className="input" disabled={!kelola}><option value="">— belum —</option>{teknisi.map((t: any) => <option key={t.id} value={t.id}>{t.nama}</option>)}</select></Field>
            {harga && <div className="grid grid-cols-3 gap-2">
              <Field label="Diskon"><input type="number" step="any" name="diskon" defaultValue={w.diskon || 0} className="input" /></Field>
              <Field label="Est. TK"><input type="number" step="any" name="biaya_tenaga_kerja" defaultValue={w.biaya_tenaga_kerja || 0} className="input" /></Field>
              <Field label="Est. ops"><input type="number" step="any" name="biaya_ops" defaultValue={w.biaya_ops || 0} className="input" /></Field>
            </div>}
            <Field label="Catatan"><textarea name="catatan" defaultValue={w.catatan} className="input" rows={2} disabled={!kelola} /></Field>
            <Field label="Kondisi saat diserahkan (untuk surat serah terima)"><textarea name="kondisi_serah" defaultValue={w.kondisi_serah} className="input" rows={2} disabled={!kelola} /></Field>
            {kelola && <button className="btn btn-primary w-full">Simpan perubahan</button>}
          </form>
        </Card>

        <Card title="Kendaraan & pelanggan">
          {w.foto && <img src={uploadUrl(w.foto)} alt="" className="rounded mb-2 max-h-40" />}
          <div className="text-sm space-y-1"><div><b>{w.nopol}</b> · {w.merek} {w.tipe} {w.tahun} · {w.warna}</div><div className="text-xs text-slate-600">Kondisi awal: {w.kondisi || '-'}</div>
            {u.role !== 'teknisi' && <div className="pt-1">{w.pelanggan} · {w.telepon}</div>}
            <div className="flex gap-2 pt-1">{can(u.role, 'pelanggan.kelola') && <Link className="link text-xs" href={`/pelanggan/${w.customer_id}`}>Profil pelanggan</Link>}<Link className="link text-xs" href={`/kendaraan/${w.vehicle_id}`}>Data kendaraan</Link></div></div>
        </Card>

        <Card title="Riwayat status & perubahan">
          <ul className="text-xs space-y-2 max-h-80 overflow-y-auto">{hist.map((h: any) => <li key={h.id} className="border-l-2 border-brand-300 pl-2"><div>{h.dari && h.dari !== h.ke ? <>{h.dari} → <b>{h.ke}</b></> : <b>{h.ke}</b>}</div>{h.catatan && <div className="text-slate-600">{h.catatan}</div>}<div className="text-slate-400">{tglJam(h.at)} · {h.oleh || '-'}</div></li>)}</ul>
        </Card>
      </div>
    </div>
  </div>);
}
