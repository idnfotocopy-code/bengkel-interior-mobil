import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { can } from '@/lib/rbac';
import { periodFinance, receivables, cashBalances } from '@/lib/biz';
import { EXPENSE_CATEGORIES, PAYMENT_TYPES, PAYMENT_METHODS } from '@/lib/constants';
import { rp, tgl, today, periodFromSp } from '@/lib/util';
import { Card, Flash, PageHeader, Empty, TableWrap, Tabs, Stat, InvBadge, Field, PeriodFilter } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { addPayment, updatePayment, deletePayment, addExpense, updateExpense, deleteExpense, saveCashAccount, deleteCashAccount, createInvoice, updateInvoice, cancelInvoice } from './actions';
export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: any }) {
  const u = requireUser('keuangan');
  const tab = ['pembayaran', 'pengeluaran', 'invoice', 'piutang', 'kas'].includes(searchParams?.tab) ? searchParams.tab : 'pembayaran';
  const { from, to } = periodFromSp(searchParams);
  const f = periodFinance(from, to);
  const pr = receivables();
  const qs = `from=${from}&to=${to}`;
  const tabs = [
    { key: 'pembayaran', label: '💵 Pembayaran masuk', href: `/keuangan?tab=pembayaran&${qs}` },
    { key: 'pengeluaran', label: '💸 Pengeluaran', href: `/keuangan?tab=pengeluaran&${qs}` },
    { key: 'invoice', label: '🧾 Invoice', href: `/keuangan?tab=invoice&${qs}` },
    { key: 'piutang', label: `⏳ Piutang (${pr.rows.length})`, href: `/keuangan?tab=piutang&${qs}` },
    { key: 'kas', label: '🏦 Kas & bank', href: `/keuangan?tab=kas&${qs}` },
  ];
  const accounts = all('SELECT * FROM cash_accounts WHERE aktif=1 ORDER BY id');
  const openWos = all("SELECT w.id, w.nomor, c.nama pelanggan FROM work_orders w JOIN customers c ON c.id=w.customer_id WHERE w.status!='Dibatalkan' ORDER BY w.id DESC LIMIT 200");
  const woOpts = openWos.map((w: any) => <option key={w.id} value={w.id}>{w.nomor} · {w.pelanggan}</option>);
  const acctOpts = accounts.map((a: any) => <option key={a.id} value={a.id}>{a.nama}</option>);
  const canBayar = can(u.role, 'bayar.catat'), canEditBayar = can(u.role, 'bayar.hapus'), canInv = can(u.role, 'invoice.kelola'), canBiaya = can(u.role, 'biaya.kelola'), canKas = can(u.role, 'kas.kelola');
  const tambah = tab === 'pembayaran' && canBayar ? ['+ Tambah pembayaran', '#tambah'] : tab === 'pengeluaran' && canBiaya ? ['+ Tambah pengeluaran', '#tambah'] : tab === 'invoice' && canInv ? ['+ Buat invoice', '#tambah'] : tab === 'kas' && canKas ? ['+ Tambah akun kas', '#tambah'] : null;
  return (<div>
    <PageHeader title="Keuangan" desc="Pembayaran pelanggan, pengeluaran, invoice, piutang, dan saldo kas. Uang muka bukan otomatis keuntungan.">{tambah && <a className="btn btn-primary" href={tambah[1]}>{tambah[0]}</a>}</PageHeader>
    <Flash sp={searchParams} />
    <PeriodFilter from={from} to={to} extra={<input type="hidden" name="tab" value={tab} />} />
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-5">
      <Stat label="Omzet (invoice)" value={rp(f.omzet)} sub="periode ini" />
      <Stat label="Uang masuk" value={rp(f.pemasukan)} color="green" sub="semua pembayaran" />
      <Stat label="Pengeluaran" value={rp(f.pengeluaran)} color="red" />
      <Stat label="Laba sementara" value={rp(f.laba)} color="amber" sub="omzet − bahan − TK − ops" />
      <Stat label="Piutang" value={rp(pr.total)} color="red" sub={`${pr.rows.length} tagihan`} />
    </div>
    <Tabs items={tabs} active={tab} />

    {tab === 'pembayaran' && (() => {
      const rows = all(`SELECT p.*, w.nomor wo_nomor, c.nama pelanggan, a.nama akun FROM payments p LEFT JOIN work_orders w ON w.id=p.wo_id LEFT JOIN customers c ON c.id=w.customer_id LEFT JOIN cash_accounts a ON a.id=p.cash_account_id WHERE p.tanggal BETWEEN ? AND ? ORDER BY p.tanggal DESC, p.id DESC`, from, to);
      const bk = `/keuangan?tab=pembayaran&${qs}`;
      return <div className="space-y-5">
        {canBayar && <Card id="tambah" title="➕ Tambah pembayaran"><form action={addPayment} className="grid-form">
          <input type="hidden" name="back" value={bk} />
          <Field label="Pesanan *"><select name="wo_id" className="input" required><option value="">— pilih pesanan —</option>{woOpts}</select></Field>
          <Field label="Jenis"><select name="jenis" className="input">{PAYMENT_TYPES.map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Jumlah (Rp) *"><input type="number" step="any" min={1} name="jumlah" className="input" required /></Field>
          <Field label="Tanggal"><input type="date" name="tanggal" defaultValue={today()} className="input" /></Field>
          <Field label="Metode"><select name="metode" className="input">{PAYMENT_METHODS.map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Masuk ke akun"><select name="cash_account_id" className="input">{acctOpts}</select></Field>
          <Field label="Catatan"><input name="catatan" className="input" /></Field>
          <div className="flex items-end"><button className="btn btn-primary">Simpan pembayaran</button></div>
        </form></Card>}
        <Card pad={false} title={`Pembayaran ${tgl(from)} – ${tgl(to)}`}>
        {rows.length ? <TableWrap><table className="tbl"><thead><tr><th>Kuitansi</th><th>Tanggal</th><th>Pesanan / pelanggan</th><th>Jenis</th><th>Metode</th><th className="num">Jumlah</th><th></th></tr></thead><tbody>
          {rows.map((p: any) => <tr key={p.id}><td>{p.nomor}</td><td>{tgl(p.tanggal)}</td><td><Link className="link" href={`/pesanan/${p.wo_id}`}>{p.wo_nomor}</Link><div className="text-xs text-slate-500">{p.pelanggan}</div></td><td>{p.jenis}</td><td className="text-xs">{p.metode} · {p.akun || '-'}</td><td className="num">{rp(p.jumlah)}</td>
            <td className="whitespace-nowrap"><a className="btn btn-sm" target="_blank" href={`/api/pdf/kuitansi?id=${p.id}`}>Kuitansi</a> {canEditBayar && <><details className="inline-block align-top"><summary className="btn btn-sm list-none cursor-pointer">✏️ Edit</summary>
              <form action={updatePayment} className="mt-2 grid gap-1 w-72 rounded border bg-white p-2 shadow-lg">
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={bk} />
                <select name="jenis" defaultValue={p.jenis} className="input">{PAYMENT_TYPES.map(x => <option key={x}>{x}</option>)}</select>
                <input type="number" step="any" min={1} name="jumlah" defaultValue={p.jumlah} className="input" required />
                <input type="date" name="tanggal" defaultValue={p.tanggal} className="input" />
                <select name="metode" defaultValue={p.metode} className="input">{PAYMENT_METHODS.map(x => <option key={x}>{x}</option>)}</select>
                <select name="cash_account_id" defaultValue={p.cash_account_id || ''} className="input">{acctOpts}</select>
                <input name="catatan" defaultValue={p.catatan || ''} placeholder="Catatan" className="input" />
                <button className="btn btn-primary btn-sm">Simpan perubahan</button>
              </form></details> <form action={deletePayment} className="inline"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={bk} /><ConfirmButton className="btn btn-sm text-red-600" msg={`Hapus pembayaran ${p.nomor}?`}>🗑 Hapus</ConfirmButton></form></>}</td></tr>)}
          <tr className="font-bold"><td colSpan={5} className="num">Total</td><td className="num">{rp(rows.reduce((a: number, r: any) => a + r.jumlah, 0))}</td><td></td></tr>
        </tbody></table></TableWrap> : <Empty>Tidak ada pembayaran pada periode ini.</Empty>}
      </Card></div>;
    })()}

    {tab === 'pengeluaran' && (() => {
      const rows = all(`SELECT e.*, w.nomor wo_nomor, a.nama akun, us.nama oleh FROM expenses e LEFT JOIN work_orders w ON w.id=e.wo_id LEFT JOIN cash_accounts a ON a.id=e.cash_account_id LEFT JOIN users us ON us.id=e.user_id WHERE e.tanggal BETWEEN ? AND ? ORDER BY e.tanggal DESC, e.id DESC`, from, to);
      const wos = all("SELECT id, nomor FROM work_orders WHERE status!='Dibatalkan' ORDER BY id DESC LIMIT 50");
      return <div className="space-y-5">
        {canBiaya && <Card id="tambah" title="➕ Tambah pengeluaran"><form action={addExpense} className="grid-form">
          <Field label="Tanggal"><input type="date" name="tanggal" defaultValue={today()} className="input" /></Field>
          <Field label="Kategori"><select name="kategori" className="input">{EXPENSE_CATEGORIES.map(k => <option key={k}>{k}</option>)}</select></Field>
          <Field label="Jumlah (Rp)"><input type="number" step="any" name="jumlah" min={1} className="input" required /></Field>
          <Field label="Keterangan" className="sm:col-span-2"><input name="deskripsi" className="input" required /></Field>
          <Field label="Terkait pesanan (opsional)"><select name="wo_id" className="input"><option value="">—</option>{wos.map((w: any) => <option key={w.id} value={w.id}>{w.nomor}</option>)}</select></Field>
          <Field label="Dibayar dari"><select name="cash_account_id" className="input">{accounts.map((a: any) => <option key={a.id} value={a.id}>{a.nama}</option>)}</select></Field>
          <div className="flex items-end"><button className="btn btn-primary">Simpan pengeluaran</button></div>
        </form><p className="text-xs text-slate-500 mt-2">Pembelian bahan sebaiknya dicatat dari menu Persediaan → Stok masuk (centang “catat sebagai pengeluaran”) agar stok ikut bertambah.</p></Card>}
        <Card pad={false} title="Daftar pengeluaran">
          {rows.length ? <TableWrap><table className="tbl"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th>Pesanan</th><th>Akun</th><th className="num">Jumlah</th><th></th></tr></thead><tbody>
            {rows.map((e: any) => <tr key={e.id}><td>{tgl(e.tanggal)}</td><td>{e.kategori}</td><td>{e.deskripsi}<div className="text-xs text-slate-400">{e.oleh}</div></td><td>{e.wo_nomor ? <Link className="link" href={`/pesanan/${e.wo_id}`}>{e.wo_nomor}</Link> : '-'}</td><td className="text-xs">{e.akun || '-'}</td><td className="num">{rp(e.jumlah)}</td>
              <td className="whitespace-nowrap">{canBiaya && <><details className="inline-block align-top"><summary className="btn btn-sm list-none cursor-pointer">✏️ Edit</summary>
                <form action={updateExpense} className="mt-2 grid gap-1 w-72 rounded border bg-white p-2 shadow-lg">
                  <input type="hidden" name="id" value={e.id} /><input type="hidden" name="back" value={`/keuangan?tab=pengeluaran&${qs}`} />
                  <input type="date" name="tanggal" defaultValue={e.tanggal} className="input" />
                  <select name="kategori" defaultValue={e.kategori} className="input">{EXPENSE_CATEGORIES.map(k => <option key={k}>{k}</option>)}</select>
                  <input name="deskripsi" defaultValue={e.deskripsi || ''} className="input" placeholder="Keterangan" />
                  <input type="number" step="any" min={1} name="jumlah" defaultValue={e.jumlah} className="input" required />
                  <select name="wo_id" defaultValue={e.wo_id || ''} className="input"><option value="">— tanpa pesanan —</option>{wos.map((w: any) => <option key={w.id} value={w.id}>{w.nomor}</option>)}{e.wo_id && !wos.some((w: any) => w.id === e.wo_id) && <option value={e.wo_id}>{e.wo_nomor}</option>}</select>
                  <select name="cash_account_id" defaultValue={e.cash_account_id || ''} className="input">{acctOpts}</select>
                  <button className="btn btn-primary btn-sm">Simpan perubahan</button>
                </form></details> <form action={deleteExpense} className="inline"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="back" value={`/keuangan?tab=pengeluaran&${qs}`} /><ConfirmButton className="btn btn-sm text-red-600" msg="Hapus pengeluaran ini?">🗑 Hapus</ConfirmButton></form></>}</td></tr>)}
            <tr className="font-bold"><td colSpan={5} className="num">Total</td><td className="num">{rp(rows.reduce((a: number, r: any) => a + r.jumlah, 0))}</td><td></td></tr>
          </tbody></table></TableWrap> : <Empty>Tidak ada pengeluaran pada periode ini.</Empty>}
        </Card>
      </div>;
    })()}

    {tab === 'invoice' && (() => {
      const rows = all(`SELECT i.*, w.nomor wo_nomor, c.nama pelanggan, (SELECT COALESCE(SUM(jumlah),0) FROM payments p WHERE p.wo_id=i.wo_id) dibayar FROM invoices i JOIN work_orders w ON w.id=i.wo_id JOIN customers c ON c.id=w.customer_id WHERE i.tanggal BETWEEN ? AND ? ORDER BY i.id DESC`, from, to);
      const bk = `/keuangan?tab=invoice&${qs}`;
      return <div className="space-y-5">
        {canInv && <Card id="tambah" title="➕ Buat invoice"><form action={createInvoice} className="grid-form">
          <input type="hidden" name="back" value={bk} />
          <Field label="Pesanan *"><select name="wo_id" className="input" required><option value="">— pilih pesanan —</option>{woOpts}</select></Field>
          <Field label="Tanggal"><input type="date" name="tanggal" defaultValue={today()} className="input" /></Field>
          <Field label="Jatuh tempo (kosong = otomatis)"><input type="date" name="jatuh_tempo" className="input" /></Field>
          <Field label="Catatan"><input name="catatan" className="input" /></Field>
          <div className="flex items-end"><button className="btn btn-primary">Buat invoice</button></div>
        </form><p className="text-xs text-slate-500 mt-2">Total diambil dari rincian pesanan. Invoice aktif lama untuk pesanan yang sama otomatis dibatalkan.</p></Card>}
        <Card pad={false} title="Invoice">
        {rows.length ? <TableWrap><table className="tbl"><thead><tr><th>No. invoice</th><th>Tanggal</th><th>Jatuh tempo</th><th>Pesanan / pelanggan</th><th className="num">Total</th><th className="num">Dibayar</th><th>Status</th><th></th></tr></thead><tbody>
          {rows.map((i: any) => <tr key={i.id}><td>{i.nomor}</td><td>{tgl(i.tanggal)}</td><td>{tgl(i.jatuh_tempo)}</td><td><Link className="link" href={`/pesanan/${i.wo_id}`}>{i.wo_nomor}</Link><div className="text-xs text-slate-500">{i.pelanggan}</div></td><td className="num">{rp(i.total)}</td><td className="num">{rp(i.dibayar)}</td><td><InvBadge status={i.status} /></td>
            <td className="whitespace-nowrap">{i.status !== 'Batal' && <><a className="btn btn-sm" target="_blank" href={`/api/pdf/invoice?id=${i.id}`}>PDF</a> {canInv && <><details className="inline-block align-top"><summary className="btn btn-sm list-none cursor-pointer">✏️ Edit</summary>
              <form action={updateInvoice} className="mt-2 grid gap-1 w-64 rounded border bg-white p-2 shadow-lg">
                <input type="hidden" name="id" value={i.id} /><input type="hidden" name="back" value={bk} />
                <label className="text-xs">Tanggal<input type="date" name="tanggal" defaultValue={i.tanggal} className="input" /></label>
                <label className="text-xs">Jatuh tempo<input type="date" name="jatuh_tempo" defaultValue={i.jatuh_tempo} className="input" /></label>
                <input name="catatan" defaultValue={i.catatan || ''} placeholder="Catatan" className="input" />
                <button className="btn btn-primary btn-sm">Simpan perubahan</button>
              </form></details> <form action={cancelInvoice} className="inline"><input type="hidden" name="id" value={i.id} /><input type="hidden" name="back" value={bk} /><ConfirmButton className="btn btn-sm text-red-600" msg={`Batalkan (void) invoice ${i.nomor}?`}>⛔ Batal</ConfirmButton></form></>}</>}</td></tr>)}
        </tbody></table></TableWrap> : <Empty>Tidak ada invoice pada periode ini.</Empty>}
      </Card></div>;
    })()}

    {tab === 'piutang' && <Card pad={false} title={`Piutang pelanggan — total ${rp(pr.total)}`} actions={can(u.role, 'laporan.piutang') && <a className="btn btn-sm" target="_blank" href="/api/pdf/piutang">📄 PDF piutang</a>}>
      {pr.rows.length ? <TableWrap><table className="tbl"><thead><tr><th>Invoice</th><th>Pelanggan</th><th>Jatuh tempo</th><th className="num">Total</th><th className="num">Dibayar</th><th className="num">Sisa</th><th>Umur</th></tr></thead><tbody>
        {pr.rows.map((r: any) => <tr key={r.id}><td><Link className="link" href={`/pesanan/${r.wo_id}`}>{r.nomor}</Link><div className="text-xs text-slate-500">{r.wo_nomor}</div></td><td>{r.pelanggan}<div className="text-xs text-slate-500">{r.telepon}</div></td><td>{tgl(r.jatuh_tempo)}</td><td className="num">{rp(r.total)}</td><td className="num">{rp(r.dibayar)}</td><td className="num font-semibold text-red-600">{rp(r.sisa)}</td><td className={r.umur > 0 ? 'text-red-600 text-xs font-semibold' : 'text-xs text-slate-500'}>{r.umur > 0 ? `lewat ${r.umur} hari` : `${-r.umur} hari lagi`}</td></tr>)}
      </tbody></table></TableWrap> : <Empty>Tidak ada piutang. 🎉</Empty>}
    </Card>}

    {tab === 'kas' && <div className="space-y-5">
      <Card pad={false} title="Saldo kas & bank (saldo awal + pembayaran masuk − pengeluaran)">
        <TableWrap><table className="tbl"><thead><tr><th>Akun</th><th>Jenis</th><th>No. rekening</th><th className="num">Saldo awal</th><th className="num">Masuk</th><th className="num">Keluar</th><th className="num">Saldo</th>{canKas && <th></th>}</tr></thead><tbody>
          {cashBalances().map((a: any) => <tr key={a.id} className={a.aktif ? '' : 'text-slate-400'}><td>{a.nama}{!a.aktif && <span className="ml-1 text-xs">(nonaktif)</span>}</td><td className="capitalize">{a.jenis}</td><td>{a.no_rekening || '-'}</td><td className="num">{rp(a.saldo_awal)}</td><td className="num">{rp(a.masuk)}</td><td className="num">{rp(a.keluar)}</td><td className="num font-bold">{rp(a.saldo)}</td>
            {canKas && <td className="whitespace-nowrap"><details className="inline-block align-top"><summary className="btn btn-sm list-none cursor-pointer">✏️ Edit</summary>
              <form action={saveCashAccount} className="mt-2 grid gap-1 w-64 rounded border bg-white p-2 shadow-lg">
                <input type="hidden" name="id" value={a.id} />
                <input name="nama" defaultValue={a.nama} className="input" required />
                <select name="jenis" defaultValue={a.jenis} className="input"><option value="kas">Kas</option><option value="bank">Bank</option><option value="ewallet">E-wallet</option></select>
                <input name="no_rekening" defaultValue={a.no_rekening || ''} placeholder="No. rekening" className="input" />
                <input type="number" step="any" name="saldo_awal" defaultValue={a.saldo_awal} className="input" />
                <label className="text-xs"><input type="checkbox" name="aktif" value="1" defaultChecked={!!a.aktif} /> Aktif</label>
                <button className="btn btn-primary btn-sm">Simpan perubahan</button>
              </form></details> <form action={deleteCashAccount} className="inline"><input type="hidden" name="id" value={a.id} /><ConfirmButton className="btn btn-sm text-red-600" msg={`Hapus akun ${a.nama}? Bila sudah ada transaksi, akun hanya dinonaktifkan.`}>🗑 Hapus</ConfirmButton></form></td>}</tr>)}
        </tbody></table></TableWrap>
      </Card>
      {canKas && <Card id="tambah" title="➕ Tambah akun kas / bank"><form action={saveCashAccount} className="grid-form">
        <Field label="Nama akun"><input name="nama" className="input" required /></Field>
        <Field label="Jenis"><select name="jenis" className="input"><option value="kas">Kas</option><option value="bank">Bank</option><option value="ewallet">E-wallet</option></select></Field>
        <Field label="No. rekening"><input name="no_rekening" className="input" /></Field>
        <Field label="Saldo awal (Rp)"><input type="number" step="any" name="saldo_awal" defaultValue={0} className="input" /></Field>
        <div className="flex items-end"><button className="btn btn-primary">Simpan akun</button></div>
      </form></Card>}
    </div>}
  </div>);
}
