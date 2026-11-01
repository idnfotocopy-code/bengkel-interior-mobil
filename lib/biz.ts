import { all, one, run, insert, tx } from './db';
import { nowStr, today } from './util';

export function woSummary(woId: number) {
  const wo = one('SELECT diskon, biaya_tenaga_kerja, biaya_ops FROM work_orders WHERE id=?', woId) || {};
  const it = one(`SELECT COALESCE(SUM(CASE WHEN jenis='jasa' THEN qty*harga END),0) jasa, COALESCE(SUM(CASE WHEN jenis='barang' THEN qty*harga END),0) barang FROM work_order_items WHERE wo_id=?`, woId);
  const subtotal = it.jasa + it.barang;
  const diskon = Number(wo.diskon) || 0;
  const total = subtotal - diskon;
  const paid = one('SELECT COALESCE(SUM(jumlah),0) p FROM payments WHERE wo_id=?', woId).p;
  const dp = one("SELECT COALESCE(SUM(jumlah),0) p FROM payments WHERE wo_id=? AND jenis='DP'", woId).p;
  const bahan = one('SELECT COALESCE(SUM(qty*harga_satuan),0) b FROM material_usage WHERE wo_id=? AND batal=0', woId).b;
  const tk = Number(wo.biaya_tenaga_kerja) || 0, ops = Number(wo.biaya_ops) || 0;
  return { jasa: it.jasa, barang: it.barang, subtotal, diskon, total, paid, dp, sisa: total - paid, bahan, tk, ops, laba: total - bahan - tk - ops };
}

/** Sinkron status invoice dari total pembayaran pesanan. */
export function syncInvoiceStatus(woId: number) {
  const paid = one('SELECT COALESCE(SUM(jumlah),0) p FROM payments WHERE wo_id=?', woId).p;
  for (const i of all("SELECT * FROM invoices WHERE wo_id=? AND status!='Batal'", woId)) {
    run('UPDATE invoices SET status=? WHERE id=?', paid >= i.total - 0.5 ? 'Lunas' : paid > 0 ? 'Sebagian' : 'Belum lunas', i.id);
  }
}

export function activeInvoice(woId: number) { return one("SELECT * FROM invoices WHERE wo_id=? AND status!='Batal' ORDER BY id DESC", woId); }

export function addStockMovement(o: { material_id: number; tipe: 'masuk' | 'keluar' | 'penyesuaian'; qty: number; harga?: number; wo_id?: number | null; alasan?: string; user_id: number; tanggal?: string }) {
  const m = one('SELECT * FROM materials WHERE id=?', o.material_id);
  if (!m) throw new Error('Bahan tidak ditemukan.');
  const signed = o.tipe === 'masuk' ? Math.abs(o.qty) : o.tipe === 'keluar' ? -Math.abs(o.qty) : o.qty;
  if (m.stok + signed < -1e-9) throw new Error(`Stok ${m.nama} tidak cukup (tersisa ${m.stok} ${m.satuan}).`);
  const id = insert('stock_movements', { branch_id: m.branch_id, material_id: m.id, tipe: o.tipe, qty: signed, harga: o.harga ?? m.harga_beli, wo_id: o.wo_id ?? null, alasan: o.alasan || '', user_id: o.user_id, tanggal: o.tanggal || today(), at: nowStr() });
  run('UPDATE materials SET stok=stok+? WHERE id=?', signed, m.id);
  return { id, material: m };
}

export function useMaterial(woId: number, materialId: number, qty: number, userId: number, tanggal?: string) {
  if (!(qty > 0)) throw new Error('Jumlah pemakaian harus lebih dari 0.');
  return tx(() => {
    const wo = one('SELECT nomor, branch_id FROM work_orders WHERE id=?', woId);
    const mat = one('SELECT branch_id, nama FROM materials WHERE id=?', materialId);
    if (!mat) throw new Error('Bahan tidak ditemukan.');
    if (wo && mat.branch_id !== wo.branch_id) throw new Error(`Bahan ${mat.nama} milik cabang lain — gunakan bahan dari cabang pesanan ini.`);
    const { id: mv, material } = addStockMovement({ material_id: materialId, tipe: 'keluar', qty, wo_id: woId, alasan: `Pemakaian ${wo.nomor}`, user_id: userId, tanggal });
    return insert('material_usage', { wo_id: woId, material_id: materialId, qty, harga_satuan: material.harga_beli, movement_id: mv, user_id: userId, tanggal: tanggal || today() });
  });
}
export function cancelUsage(usageId: number, userId: number) {
  return tx(() => {
    const u = one('SELECT mu.*, w.nomor FROM material_usage mu JOIN work_orders w ON w.id=mu.wo_id WHERE mu.id=? AND mu.batal=0', usageId);
    if (!u) throw new Error('Data pemakaian tidak ditemukan.');
    addStockMovement({ material_id: u.material_id, tipe: 'masuk', qty: u.qty, harga: u.harga_satuan, wo_id: u.wo_id, alasan: `Koreksi/batal pemakaian ${u.nomor}`, user_id: userId });
    run('UPDATE material_usage SET batal=1 WHERE id=?', usageId);
    return u;
  });
}

// ---------- Ringkasan keuangan per periode ----------
/** Semua ringkasan di bawah dihitung per cabang (`b` = branch_id). */
export function periodFinance(from: string, to: string, b: number) {
  const omzet = one("SELECT COALESCE(SUM(total),0) v FROM invoices WHERE branch_id=? AND status!='Batal' AND tanggal BETWEEN ? AND ?", b, from, to).v;
  const pemasukan = one('SELECT COALESCE(SUM(jumlah),0) v FROM payments WHERE branch_id=? AND tanggal BETWEEN ? AND ?', b, from, to).v;
  const pengeluaran = one('SELECT COALESCE(SUM(jumlah),0) v FROM expenses WHERE branch_id=? AND tanggal BETWEEN ? AND ?', b, from, to).v;
  const bahan = one('SELECT COALESCE(SUM(mu.qty*mu.harga_satuan),0) v FROM material_usage mu JOIN work_orders w ON w.id=mu.wo_id WHERE w.branch_id=? AND mu.batal=0 AND mu.tanggal BETWEEN ? AND ?', b, from, to).v;
  const tenaga = one("SELECT COALESCE(SUM(jumlah),0) v FROM expenses WHERE branch_id=? AND kategori='Tenaga kerja' AND tanggal BETWEEN ? AND ?", b, from, to).v;
  const opsRows = all<{ kategori: string; v: number }>("SELECT kategori, SUM(jumlah) v FROM expenses WHERE branch_id=? AND kategori NOT IN ('Tenaga kerja','Pembelian bahan') AND tanggal BETWEEN ? AND ? GROUP BY kategori ORDER BY kategori", b, from, to);
  const ops = opsRows.reduce((a, r) => a + r.v, 0);
  const pembelianBahan = one("SELECT COALESCE(SUM(jumlah),0) v FROM expenses WHERE branch_id=? AND kategori='Pembelian bahan' AND tanggal BETWEEN ? AND ?", b, from, to).v;
  const hpp = bahan + tenaga;
  return { omzet, pemasukan, pengeluaran, bahan, tenaga, ops, opsRows, pembelianBahan, hpp, labaKotor: omzet - hpp, laba: omzet - bahan - tenaga - ops };
}

export function receivables(b: number) {
  const rows = all(`SELECT i.*, w.nomor wo_nomor, c.nama pelanggan, c.telepon,
      (SELECT COALESCE(SUM(jumlah),0) FROM payments p WHERE p.wo_id=i.wo_id) dibayar
    FROM invoices i JOIN work_orders w ON w.id=i.wo_id JOIN customers c ON c.id=w.customer_id
    WHERE i.branch_id=? AND i.status!='Batal' ORDER BY i.jatuh_tempo`, b);
  const out = rows.map((r: any) => ({ ...r, sisa: Math.max(0, r.total - r.dibayar), umur: Math.floor((Date.parse(today()) - Date.parse(r.jatuh_tempo || r.tanggal)) / 86400000) })).filter((r: any) => r.sisa > 0.5);
  return { rows: out, total: out.reduce((a: number, r: any) => a + r.sisa, 0) };
}

export function cashBalances(b: number) {
  return all(`SELECT a.*, a.saldo_awal
      + COALESCE((SELECT SUM(jumlah) FROM payments p WHERE p.cash_account_id=a.id),0)
      - COALESCE((SELECT SUM(jumlah) FROM expenses e WHERE e.cash_account_id=a.id),0) saldo,
      COALESCE((SELECT SUM(jumlah) FROM payments p WHERE p.cash_account_id=a.id),0) masuk,
      COALESCE((SELECT SUM(jumlah) FROM expenses e WHERE e.cash_account_id=a.id),0) keluar
    FROM cash_accounts a WHERE a.branch_id=? ORDER BY a.id`, b);
}

export function stockReport(from: string, to: string, b: number) {
  return all(`SELECT m.id, m.kode, m.nama, m.satuan, m.harga_beli, m.stok, m.minimum,
      COALESCE((SELECT SUM(qty) FROM stock_movements s WHERE s.material_id=m.id AND s.tanggal < ?),0) awal,
      COALESCE((SELECT SUM(qty) FROM stock_movements s WHERE s.material_id=m.id AND s.tanggal BETWEEN ? AND ? AND qty>0),0) masuk,
      COALESCE((SELECT -SUM(qty) FROM stock_movements s WHERE s.material_id=m.id AND s.tanggal BETWEEN ? AND ? AND qty<0),0) keluar
    FROM materials m WHERE m.branch_id=? AND m.aktif=1 ORDER BY m.kode`, from, from, to, from, to, b).map((r: any) => {
    const akhir = r.awal + r.masuk - r.keluar;
    return { ...r, akhir, nilai: akhir * r.harga_beli };
  });
}
