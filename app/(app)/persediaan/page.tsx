import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { can } from '@/lib/rbac';
import { rp, num, tgl, today } from '@/lib/util';
import { Card, Flash, PageHeader, Empty, TableWrap, Tabs, Field, Badge, Stat } from '@/components/ui';
import { saveMaterial, saveSupplier, stockMove } from './actions';
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: any }) {
  const u = requireUser('persediaan');
  const tab = ['bahan', 'mutasi', 'supplier'].includes(searchParams?.tab) ? searchParams.tab : 'bahan';
  const cost = can(u.role, 'stok.lihat_biaya');
  const menipis = searchParams?.filter === 'menipis';
  const cari = String(searchParams?.q || '').trim();
  const mats = all(`SELECT m.*, s.nama supplier FROM materials m LEFT JOIN suppliers s ON s.id=m.supplier_id WHERE 1=1 ${menipis ? 'AND m.stok<=m.minimum AND m.aktif=1' : ''} ${cari ? 'AND (m.kode LIKE ? OR m.nama LIKE ?)' : ''} ORDER BY m.aktif DESC, m.kode`, ...(cari ? [`%${cari}%`, `%${cari}%`] : []));
  const low = all('SELECT * FROM materials WHERE aktif=1 AND stok<=minimum ORDER BY kode');
  const suppliers = all('SELECT * FROM suppliers ORDER BY nama');
  const activeMats = all('SELECT id, kode, nama, satuan, stok, harga_beli FROM materials WHERE aktif=1 ORDER BY kode');
  const accounts = all('SELECT * FROM cash_accounts WHERE aktif=1');
  const nilai = activeMats.reduce((a: number, m: any) => a + m.stok * m.harga_beli, 0);
  return (<div>
    <PageHeader title="Persediaan bahan" desc="Stok bahan berkurang otomatis saat dipakai pada pesanan. Penyesuaian wajib disertai alasan." />
    <Flash sp={searchParams} />
    {low.length > 0 && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">⚠ <b>{low.length} bahan</b> berada di bawah/sama dengan stok minimum: {low.map((m: any) => `${m.kode} ${m.nama} (${num(m.stok)} ${m.satuan})`).join(', ')}. <Link className="link" href="/persediaan?filter=menipis">Lihat</Link></div>}
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-5">
      <Stat label="Jenis bahan aktif" value={activeMats.length} />
      <Stat label="Stok menipis" value={low.length} color="red" href="/persediaan?filter=menipis" />
      {cost && <Stat label="Nilai persediaan" value={rp(nilai)} color="accent" sub="stok × harga beli" />}
      <Stat label="Pemasok" value={suppliers.length} color="sky" />
    </div>
    <Tabs active={tab} items={[{ key: 'bahan', label: '📦 Daftar bahan', href: '/persediaan' }, { key: 'mutasi', label: '🔁 Stok masuk / keluar / penyesuaian', href: '/persediaan?tab=mutasi' }, { key: 'supplier', label: '🏭 Pemasok', href: '/persediaan?tab=supplier' }]} />

    {tab === 'bahan' && <div className="space-y-5">
      <Card pad={false} title={menipis ? 'Bahan dengan stok menipis' : 'Daftar bahan'} actions={<form className="flex gap-2"><input name="q" defaultValue={cari} placeholder="Cari kode / nama" className="input py-1 w-44" />{menipis && <input type="hidden" name="filter" value="menipis" />}<button className="btn btn-sm">Cari</button>{menipis && <Link className="btn btn-sm" href="/persediaan">Semua</Link>}</form>}>
        {mats.length ? <TableWrap><table className="tbl"><thead><tr><th>Kode</th><th>Nama bahan</th><th>Satuan</th><th className="num">Stok</th><th className="num">Minimum</th>{cost && <><th className="num">Harga beli</th><th className="num">Nilai</th></>}<th>Pemasok</th><th>Lokasi</th></tr></thead><tbody>
          {mats.map((m: any) => <tr key={m.id} className={m.aktif ? '' : 'opacity-50'}><td><Link className="link" href={`/persediaan/${m.id}`}>{m.kode}</Link></td><td>{m.nama} {!m.aktif && <Badge>nonaktif</Badge>}</td><td>{m.satuan}</td>
            <td className={`num font-semibold ${m.stok <= m.minimum ? 'text-red-600' : ''}`}>{num(m.stok)} {m.stok <= m.minimum && m.aktif ? <Badge color="red">menipis</Badge> : null}</td><td className="num">{num(m.minimum)}</td>
            {cost && <><td className="num">{rp(m.harga_beli)}</td><td className="num">{rp(m.stok * m.harga_beli)}</td></>}<td className="text-xs">{m.supplier || '-'}</td><td className="text-xs">{m.lokasi || '-'}</td></tr>)}
        </tbody></table></TableWrap> : <Empty>Tidak ada bahan.</Empty>}
      </Card>
      {can(u.role, 'stok.master') && <Card title="Tambah bahan baru"><form action={saveMaterial} className="grid-form">
        <Field label="Kode (mis. B008)"><input name="kode" className="input" required /></Field>
        <Field label="Nama bahan"><input name="nama" className="input" required /></Field>
        <Field label="Satuan"><input name="satuan" defaultValue="meter" className="input" /></Field>
        <Field label="Stok awal"><input name="stok_awal" type="number" step="0.01" defaultValue={0} className="input" /></Field>
        <Field label="Stok minimum"><input name="minimum" type="number" step="0.01" defaultValue={0} className="input" /></Field>
        <Field label="Harga beli / satuan (Rp)"><input name="harga_beli" type="number" defaultValue={0} className="input" /></Field>
        <Field label="Pemasok"><select name="supplier_id" className="input"><option value="">—</option>{suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.nama}</option>)}</select></Field>
        <Field label="Lokasi penyimpanan"><input name="lokasi" className="input" /></Field>
        <div className="flex items-end"><button className="btn btn-primary">Simpan bahan</button></div>
      </form></Card>}
    </div>}

    {tab === 'mutasi' && (() => {
      const mov = all(`SELECT s.*, m.kode, m.nama, m.satuan, w.nomor wo_nomor, us.nama oleh FROM stock_movements s JOIN materials m ON m.id=s.material_id LEFT JOIN work_orders w ON w.id=s.wo_id LEFT JOIN users us ON us.id=s.user_id ORDER BY s.tanggal DESC, s.id DESC LIMIT 100`);
      const opt = activeMats.map((m: any) => <option key={m.id} value={m.id}>{m.kode} · {m.nama} (stok {num(m.stok)} {m.satuan})</option>);
      return <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          {can(u.role, 'stok.masuk') && <Card title="➕ Stok masuk (pembelian)"><form action={stockMove} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="tipe" value="masuk" />
            <Field label="Bahan" className="sm:col-span-2"><select name="material_id" className="input" required><option value="">—</option>{opt}</select></Field>
            <Field label="Jumlah"><input name="qty" type="number" step="0.01" min="0.01" className="input" required /></Field>
            <Field label="Harga beli / satuan (Rp)"><input name="harga" type="number" min={0} className="input" /></Field>
            <Field label="Tanggal"><input name="tanggal" type="date" defaultValue={today()} className="input" /></Field>
            <Field label="Keterangan / pemasok"><input name="alasan" className="input" placeholder="mis. Nota #123 Toko Kain Jaya" /></Field>
            <label className="text-sm flex items-center gap-2"><input type="checkbox" name="catat_biaya" value="1" defaultChecked /> Catat sebagai pengeluaran “Pembelian bahan”</label>
            <Field label="Dibayar dari"><select name="cash_account_id" className="input">{accounts.map((a: any) => <option key={a.id} value={a.id}>{a.nama}</option>)}</select></Field>
            <label className="text-sm flex items-center gap-2"><input type="checkbox" name="update_harga" value="1" /> Perbarui harga beli master</label>
            <div><button className="btn btn-primary w-full">Simpan stok masuk</button></div>
          </form></Card>}
          {can(u.role, 'stok.penyesuaian') && <Card title="➖ Barang keluar / penyesuaian stok"><form action={stockMove} className="grid gap-3 sm:grid-cols-2">
            <Field label="Bahan" className="sm:col-span-2"><select name="material_id" className="input" required><option value="">—</option>{opt}</select></Field>
            <Field label="Jenis"><select name="tipe" className="input"><option value="keluar">Barang keluar (bukan untuk pesanan)</option><option value="penyesuaian">Penyesuaian (stok opname)</option></select></Field>
            <Field label="Mode penyesuaian"><select name="mode" className="input"><option value="delta">Jumlah = selisih (+/−)</option><option value="set">Jumlah = stok fisik hasil hitung</option></select></Field>
            <Field label="Jumlah"><input name="qty" type="number" step="0.01" className="input" required /></Field>
            <Field label="Tanggal"><input name="tanggal" type="date" defaultValue={today()} className="input" /></Field>
            <Field label="Alasan (wajib)" className="sm:col-span-2"><input name="alasan" className="input" required placeholder="mis. Rusak / sisa potongan / hasil stok opname" /></Field>
            <div><button className="btn btn-primary w-full">Simpan</button></div>
          </form><p className="text-xs text-slate-500 mt-2">Pemakaian bahan untuk pesanan dicatat dari halaman pesanan/produksi agar biaya bahan masuk ke pesanan tersebut.</p></Card>}
        </div>
        <Card pad={false} title="Riwayat mutasi stok (100 terakhir)">
          {mov.length ? <TableWrap><table className="tbl"><thead><tr><th>Tanggal</th><th>Bahan</th><th>Jenis</th><th className="num">Qty</th>{cost && <th className="num">Harga</th>}<th>Pesanan</th><th>Alasan</th><th>Oleh</th></tr></thead><tbody>
            {mov.map((s: any) => <tr key={s.id}><td className="whitespace-nowrap">{tgl(s.tanggal)}</td><td>{s.kode} · {s.nama}</td><td><Badge color={s.tipe === 'masuk' ? 'green' : s.tipe === 'keluar' ? 'red' : 'amber'}>{s.tipe}</Badge></td><td className={`num ${s.qty < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{s.qty > 0 ? '+' : ''}{num(s.qty)} {s.satuan}</td>{cost && <td className="num">{rp(s.harga)}</td>}<td>{s.wo_nomor ? <Link className="link" href={`/pesanan/${s.wo_id}`}>{s.wo_nomor}</Link> : '-'}</td><td className="text-xs">{s.alasan}</td><td className="text-xs">{s.oleh}</td></tr>)}
          </tbody></table></TableWrap> : <Empty />}
        </Card>
      </div>;
    })()}

    {tab === 'supplier' && <div className="space-y-5">
      <Card pad={false} title="Pemasok">
        {suppliers.length ? <TableWrap><table className="tbl"><thead><tr><th>Nama</th><th>Telepon</th><th>Alamat</th>{can(u.role, 'stok.master') && <th>Ubah</th>}</tr></thead><tbody>
          {suppliers.map((s: any) => <tr key={s.id}>{can(u.role, 'stok.master') ? <td colSpan={4}><form action={saveSupplier} className="grid gap-2 sm:grid-cols-12"><input type="hidden" name="id" value={s.id} /><input name="nama" defaultValue={s.nama} className="input sm:col-span-3" /><input name="telepon" defaultValue={s.telepon} className="input sm:col-span-3" /><input name="alamat" defaultValue={s.alamat} className="input sm:col-span-4" /><button className="btn btn-sm sm:col-span-2">Simpan</button></form></td> : <><td>{s.nama}</td><td>{s.telepon}</td><td>{s.alamat}</td></>}</tr>)}
        </tbody></table></TableWrap> : <Empty />}
      </Card>
      {can(u.role, 'stok.master') && <Card title="Tambah pemasok"><form action={saveSupplier} className="grid-form">
        <Field label="Nama"><input name="nama" className="input" required /></Field><Field label="Telepon"><input name="telepon" className="input" /></Field><Field label="Alamat"><input name="alamat" className="input" /></Field>
        <div className="flex items-end"><button className="btn btn-primary">Simpan</button></div></form></Card>}
    </div>}
  </div>);
}
