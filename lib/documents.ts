import { all, one, settings } from './db';
import { woSummary, periodFinance, receivables, stockReport, cashBalances } from './biz';
import { rp, num, tgl, addDays, today } from './util';
import type { User } from './auth';
import { createDoc, kop, heading, section, twoCol, table, totals, paragraph, note, box, signatures, finalize, placeDate, terbilang, kv, Doc, BRAND, M } from './pdf';

type Out = { buf: Buffer; filename: string };

function loadWO(id: number) {
  const w = one(`SELECT w.*, c.kode c_kode, c.nama pelanggan, c.telepon, c.alamat, v.nopol, v.merek, v.tipe, v.tahun, v.warna, v.no_rangka, v.kondisi,
      t.nama teknisi, pj.nama pj FROM work_orders w JOIN customers c ON c.id=w.customer_id JOIN vehicles v ON v.id=w.vehicle_id
      LEFT JOIN users t ON t.id=w.teknisi_id LEFT JOIN users pj ON pj.id=w.pj_id WHERE w.id=?`, id);
  if (!w) throw new Error('Pesanan tidak ditemukan.');
  return w;
}
const custBlock = (w: any) => ({ title: 'Pelanggan', rows: [['Nama', w.pelanggan], ['ID', w.c_kode], ['Telepon', w.telepon], ['Alamat', w.alamat]] as [string, string][] });
const vehBlock = (w: any) => ({ title: 'Kendaraan', rows: [['No. polisi', w.nopol], ['Merek/tipe', `${w.merek || ''} ${w.tipe || ''}`.trim()], ['Tahun/warna', `${w.tahun || '-'} / ${w.warna || '-'}`], ['No. rangka', w.no_rangka]] as [string, string][] });
const items = (woId: number) => all('SELECT * FROM work_order_items WHERE wo_id=? ORDER BY jenis DESC, id', woId);
function itemTable(doc: Doc, woId: number, withPrice = true) {
  const its = items(woId);
  if (withPrice) table(doc, [{ h: 'No', w: 5, align: 'center' }, { h: 'Jenis', w: 9 }, { h: 'Uraian pekerjaan / barang', w: 44 }, { h: 'Qty', w: 12, align: 'right' }, { h: 'Harga satuan', w: 15, align: 'right' }, { h: 'Jumlah', w: 15, align: 'right' }],
    its.map((it: any, i: number) => [String(i + 1), it.jenis === 'jasa' ? 'Jasa' : 'Barang', it.deskripsi, `${num(it.qty)} ${it.satuan || ''}`, rp(it.harga), rp(it.qty * it.harga)]));
  else table(doc, [{ h: 'No', w: 6, align: 'center' }, { h: 'Jenis', w: 12 }, { h: 'Uraian pekerjaan / barang', w: 62 }, { h: 'Qty', w: 20, align: 'right' }],
    its.map((it: any, i: number) => [String(i + 1), it.jenis === 'jasa' ? 'Jasa' : 'Barang', it.deskripsi, `${num(it.qty)} ${it.satuan || ''}`]));
}

// ---------------- Surat penawaran ----------------
export async function penawaran(u: User, id: number): Promise<Out> {
  const w = loadWO(id); const st = settings(); const sm = woSummary(id);
  const tanggal = w.tgl_masuk || today();
  const berlaku = addDays(tanggal, Number(st.masa_berlaku_hari) || 14);
  const nomor = w.nomor.replace('BIM', 'SPH');
  const doc = createDoc(`Surat Penawaran ${nomor}`);
  kop(doc, 'Surat Penawaran', [['No.', nomor], ['Tanggal', tgl(tanggal)], ['Berlaku s/d', tgl(berlaku)], ['Ref. WO', w.nomor]]);
  paragraph(doc, `Kepada Yth. ${w.pelanggan}${w.alamat ? ', ' + w.alamat : ''}`);
  paragraph(doc, `Dengan hormat, bersama ini kami sampaikan penawaran harga pekerjaan interior untuk kendaraan ${w.merek || ''} ${w.tipe || ''} (${w.nopol}) sebagai berikut:`);
  twoCol(doc, custBlock(w), vehBlock(w));
  section(doc, `Rincian pekerjaan — ${w.jenis_pekerjaan || ''}`);
  if (w.deskripsi) note(doc, w.deskripsi);
  itemTable(doc, id);
  totals(doc, [['Subtotal jasa', rp(sm.jasa)], ['Subtotal barang/bahan', rp(sm.barang)], ...(sm.diskon ? [['Diskon', '- ' + rp(sm.diskon)] as [string, string]] : []), ['TOTAL PENAWARAN', rp(sm.total), true], ['Estimasi waktu pengerjaan', `${tgl(w.tgl_masuk)} – ${tgl(w.target_selesai)}`]]);
  box(doc, 'Syarat & ketentuan', `${st.syarat_penawaran || ''}\nPenawaran ini berlaku sampai ${tgl(berlaku)}.`);
  paragraph(doc, 'Demikian penawaran ini kami sampaikan. Atas perhatian dan kepercayaan Bapak/Ibu, kami ucapkan terima kasih.');
  signatures(doc, [{ label: 'Hormat kami,', title: st.nama_usaha, name: w.pj || u.nama }, { label: 'Disetujui oleh,', title: 'Pelanggan', name: w.pelanggan }], placeDate(tanggal));
  return { buf: await finalize(doc, { by: u.nama, docNo: nomor }), filename: `Penawaran-${nomor}.pdf` };
}

// ---------------- Work order ----------------
export async function workOrder(u: User, id: number): Promise<Out> {
  const w = loadWO(id); const st = settings();
  const doc = createDoc(`Work Order ${w.nomor}`);
  kop(doc, 'Work Order', [['No. WO', w.nomor], ['Tgl masuk', tgl(w.tgl_masuk)], ['Target', tgl(w.target_selesai)], ['Status', w.status]]);
  twoCol(doc, custBlock(w), vehBlock(w));
  section(doc, 'Pekerjaan & jadwal');
  kv(doc, [['Jenis pekerjaan', w.jenis_pekerjaan], ['Deskripsi / permintaan', w.deskripsi], ['Tanggal masuk', tgl(w.tgl_masuk)], ['Target selesai', tgl(w.target_selesai)], ['Penanggung jawab', w.pj], ['Teknisi', w.teknisi || 'Belum ditentukan'], ['Kondisi awal kendaraan', w.kondisi], ['Catatan', w.catatan]]);
  section(doc, 'Rincian pekerjaan');
  itemTable(doc, id, false);
  const usage = all('SELECT mu.*, m.kode, m.nama, m.satuan FROM material_usage mu JOIN materials m ON m.id=mu.material_id WHERE mu.wo_id=? AND mu.batal=0 ORDER BY mu.id', id);
  if (usage.length) { section(doc, 'Bahan yang sudah dipakai'); table(doc, [{ h: 'Tanggal', w: 20 }, { h: 'Kode', w: 12 }, { h: 'Bahan', w: 48 }, { h: 'Qty', w: 20, align: 'right' }], usage.map((m: any) => [tgl(m.tanggal), m.kode, m.nama, `${num(m.qty)} ${m.satuan}`])); }
  section(doc, 'Checklist pemeriksaan kualitas');
  table(doc, [{ h: 'Item pemeriksaan', w: 60 }, { h: 'OK', w: 10, align: 'center' }, { h: 'Catatan', w: 30 }], ['Jahitan rapi & kuat', 'Warna/material sesuai pesanan', 'Pemasangan presisi, tidak bergelombang', 'Fungsi jok/sabuk/kelistrikan normal', 'Kabin bersih dari sisa bahan'].map(x => [x, '[   ]', '']));
  signatures(doc, [{ label: 'Dibuat oleh,', title: 'Admin', name: w.pj || u.nama }, { label: 'Dikerjakan oleh,', title: 'Teknisi', name: w.teknisi || '' }, { label: 'Disetujui,', title: 'Pelanggan', name: w.pelanggan }], placeDate(w.tgl_masuk));
  return { buf: await finalize(doc, { by: u.nama, docNo: w.nomor }), filename: `WO-${w.nomor}.pdf` };
}

// ---------------- Invoice ----------------
export async function invoice(u: User, invoiceId: number): Promise<Out> {
  const inv = one('SELECT * FROM invoices WHERE id=?', invoiceId);
  if (!inv) throw new Error('Invoice tidak ditemukan.');
  const w = loadWO(inv.wo_id); const st = settings(); const sm = woSummary(inv.wo_id);
  const pays = all('SELECT p.*, a.nama akun FROM payments p LEFT JOIN cash_accounts a ON a.id=p.cash_account_id WHERE p.wo_id=? ORDER BY p.tanggal, p.id', inv.wo_id);
  const paid = pays.reduce((a: number, p: any) => a + p.jumlah, 0);
  const sisa = Math.max(0, inv.total - paid);
  const doc = createDoc(`Invoice ${inv.nomor}`);
  kop(doc, 'Invoice', [['No. invoice', inv.nomor], ['Tanggal', tgl(inv.tanggal)], ['Jatuh tempo', tgl(inv.jatuh_tempo)], ['Ref. WO', w.nomor], ['Status', inv.status]]);
  twoCol(doc, { title: 'Ditagihkan kepada', rows: custBlock(w).rows }, vehBlock(w));
  section(doc, `Rincian — ${w.jenis_pekerjaan || ''}`);
  itemTable(doc, inv.wo_id);
  const rows: [string, string, boolean?][] = [['Subtotal', rp(sm.subtotal)]];
  if (sm.diskon) rows.push(['Diskon', '- ' + rp(sm.diskon)]);
  rows.push(['TOTAL TAGIHAN', rp(inv.total), true]);
  if (Math.abs(inv.total - sm.total) > 0.5) note(doc, `Catatan: total pesanan saat ini ${rp(sm.total)} berbeda dari nilai invoice; terbitkan ulang invoice bila ada perubahan pekerjaan.`);
  totals(doc, rows);
  section(doc, 'Pembayaran sebelumnya');
  table(doc, [{ h: 'Tanggal', w: 18 }, { h: 'No. kuitansi', w: 22 }, { h: 'Jenis', w: 20 }, { h: 'Metode', w: 20 }, { h: 'Jumlah', w: 20, align: 'right' }],
    pays.map((p: any) => [tgl(p.tanggal), p.nomor, p.jenis, p.metode || '-', rp(p.jumlah)]), { total: [['', '', '', 'Total dibayar', rp(paid)]] });
  totals(doc, [['Total tagihan', rp(inv.total)], ['Sudah dibayar', '- ' + rp(paid)], ['SISA TAGIHAN', rp(sisa), true], ['Jatuh tempo', tgl(inv.jatuh_tempo)]]);
  if (sisa <= 0.5) { const yy = doc.y; doc.save(); doc.rotate(-15, { origin: [140, yy - 45] }); doc.roundedRect(70, yy - 70, 150, 46, 6).lineWidth(3).strokeColor('#16a34a').stroke(); doc.font('Helvetica-Bold').fontSize(30).fillColor('#16a34a').text('LUNAS', 70, yy - 60, { width: 150, align: 'center', lineBreak: false }); doc.restore(); doc.y = yy; doc.x = M; doc.fillColor('#000').strokeColor('#000').lineWidth(1); }
  box(doc, 'Instruksi pembayaran', `${st.instruksi_bayar || ''}\nRekening: ${st.rekening || '-'}\nBerita transfer: ${inv.nomor}`);
  signatures(doc, [{ label: ' ', title: ' ', name: ' ' }, { label: 'Hormat kami,', title: st.nama_usaha, name: u.nama }], placeDate(inv.tanggal));
  return { buf: await finalize(doc, { by: u.nama, docNo: inv.nomor }), filename: `Invoice-${inv.nomor}.pdf` };
}

// ---------------- Kuitansi ----------------
export async function kuitansi(u: User, paymentId: number): Promise<Out> {
  const p = one('SELECT p.*, a.nama akun, i.nomor inv_nomor, us.nama penerima FROM payments p LEFT JOIN cash_accounts a ON a.id=p.cash_account_id LEFT JOIN invoices i ON i.id=p.invoice_id LEFT JOIN users us ON us.id=p.user_id WHERE p.id=?', paymentId);
  if (!p) throw new Error('Pembayaran tidak ditemukan.');
  const w = loadWO(p.wo_id); const st = settings(); const sm = woSummary(p.wo_id);
  const before = one('SELECT COALESCE(SUM(jumlah),0) v FROM payments WHERE wo_id=? AND (tanggal<? OR (tanggal=? AND id<?))', p.wo_id, p.tanggal, p.tanggal, p.id).v;
  const doc = createDoc(`Kuitansi ${p.nomor}`);
  kop(doc, 'Kuitansi', [['No.', p.nomor], ['Tanggal', tgl(p.tanggal)], ['Ref. invoice', p.inv_nomor || '-'], ['Ref. WO', w.nomor]]);
  doc.moveDown(0.5);
  kv(doc, [['Telah terima dari', w.pelanggan], ['Uang sejumlah', rp(p.jumlah)], ['Terbilang', terbilang(p.jumlah)], ['Untuk pembayaran', `${p.jenis} — ${w.jenis_pekerjaan || 'pekerjaan interior'} ${w.merek || ''} ${w.tipe || ''} (${w.nopol}), ${w.nomor}`], ['Metode pembayaran', `${p.metode || '-'}${p.akun ? ' • ' + p.akun : ''}`], ['Referensi invoice', p.inv_nomor || 'Belum diterbitkan'], ['Catatan', p.catatan]], 130);
  doc.moveDown(0.5);
  const y = doc.y;
  doc.roundedRect(M, y, 220, 34, 4).lineWidth(1.2).strokeColor(BRAND).stroke();
  doc.font('Helvetica-Bold').fontSize(16).fillColor(BRAND).text(rp(p.jumlah), M, y + 10, { width: 220, align: 'center' });
  doc.fillColor('#000').strokeColor('#000'); doc.y = y + 46;
  totals(doc, [['Total pekerjaan', rp(sm.total)], ['Dibayar sebelumnya', rp(before)], ['Pembayaran ini', rp(p.jumlah)], ['Sisa tagihan setelah ini', rp(Math.max(0, sm.total - before - p.jumlah)), true]]);
  signatures(doc, [{ label: 'Penyetor,', title: 'Pelanggan', name: w.pelanggan }, { label: 'Penerima,', title: st.nama_usaha, name: p.penerima || u.nama }], placeDate(p.tanggal));
  note(doc, 'Kuitansi ini sah sebagai bukti penerimaan uang. Pembayaran transfer dianggap sah setelah dana diterima di rekening usaha.');
  return { buf: await finalize(doc, { by: u.nama, docNo: p.nomor }), filename: `Kuitansi-${p.nomor}.pdf` };
}

// ---------------- Surat serah terima ----------------
export async function serahTerima(u: User, id: number): Promise<Out> {
  const w = loadWO(id); const st = settings();
  const nomor = w.nomor.replace('BIM', 'BAST');
  const tanggal = w.tgl_selesai || today();
  const doc = createDoc(`Serah Terima ${nomor}`);
  kop(doc, 'Surat Serah Terima', [['No.', nomor], ['Tanggal', tgl(tanggal)], ['Ref. WO', w.nomor]]);
  heading(doc, 'BERITA ACARA SERAH TERIMA KENDARAAN');
  paragraph(doc, `Pada hari ini, ${tgl(tanggal)}, pihak ${st.nama_usaha} (Pihak Pertama) menyerahkan kembali kendaraan kepada ${w.pelanggan} (Pihak Kedua) setelah selesainya pekerjaan interior dengan rincian sebagai berikut:`);
  twoCol(doc, custBlock(w), vehBlock(w));
  section(doc, `Pekerjaan yang telah selesai — ${w.jenis_pekerjaan || ''}`);
  itemTable(doc, id, false);
  section(doc, 'Kondisi kendaraan');
  kv(doc, [['Kondisi saat masuk', w.kondisi], ['Kondisi saat diserahkan', w.kondisi_serah || 'Baik, pekerjaan selesai sesuai pesanan.'], ['Tanggal masuk', tgl(w.tgl_masuk)], ['Tanggal selesai', tgl(w.tgl_selesai)], ['Teknisi', w.teknisi]]);
  table(doc, [{ h: 'Pemeriksaan bersama', w: 70 }, { h: 'Sesuai', w: 15, align: 'center' }, { h: 'Tidak', w: 15, align: 'center' }], ['Hasil pekerjaan sesuai pesanan', 'Kebersihan kabin', 'Barang pribadi pelanggan lengkap', 'Kunci & STNK diterima kembali'].map(x => [x, '[   ]', '[   ]']));
  paragraph(doc, 'Dengan ditandatanganinya berita acara ini, Pihak Kedua menyatakan telah menerima kendaraan beserta hasil pekerjaan dalam keadaan baik. Keluhan setelah serah terima ditangani sesuai ketentuan garansi.');
  signatures(doc, [{ label: 'Yang menyerahkan,', title: st.nama_usaha, name: w.pj || u.nama }, { label: 'Yang menerima,', title: 'Pelanggan', name: w.pelanggan }], placeDate(tanggal));
  return { buf: await finalize(doc, { by: u.nama, docNo: nomor }), filename: `SerahTerima-${nomor}.pdf` };
}

// ---------------- Laporan stok ----------------
export async function laporanStok(u: User, from: string, to: string, showCost = true): Promise<Out> {
  const rows = stockReport(from, to);
  const doc = createDoc('Laporan Stok', true);
  kop(doc, 'Laporan Stok', [['Periode', `${tgl(from)}`], ['s/d', tgl(to)]]);
  heading(doc, 'LAPORAN STOK & NILAI PERSEDIAAN BAHAN', `Periode ${tgl(from)} – ${tgl(to)}`);
  const cols: any[] = [{ h: 'Kode', w: 7 }, { h: 'Nama bahan', w: 24 }, { h: 'Satuan', w: 7 }, { h: 'Saldo awal', w: 9, align: 'right' }, { h: 'Masuk', w: 9, align: 'right' }, { h: 'Keluar', w: 9, align: 'right' }, { h: 'Saldo akhir', w: 9, align: 'right' }, { h: 'Min.', w: 6, align: 'right' }];
  if (showCost) cols.push({ h: 'Harga beli', w: 10, align: 'right' }, { h: 'Nilai persediaan', w: 12, align: 'right' });
  const total = rows.reduce((a: number, r: any) => a + r.nilai, 0);
  table(doc, cols, rows.map((r: any) => [r.kode, r.nama + (r.akhir <= r.minimum ? ' (menipis)' : ''), r.satuan, num(r.awal), num(r.masuk), num(r.keluar), num(r.akhir), num(r.minimum), ...(showCost ? [rp(r.harga_beli), rp(r.nilai)] : [])]),
    { total: showCost ? [['', 'TOTAL NILAI PERSEDIAAN', '', '', '', '', '', '', '', rp(total)]] : undefined });
  note(doc, 'Saldo awal = akumulasi mutasi sebelum periode. Keluar mencakup pemakaian untuk pesanan, barang keluar, dan penyesuaian negatif. Nilai persediaan dihitung dari saldo akhir × harga beli terkini.');
  const mov = all(`SELECT s.*, m.kode, m.nama, m.satuan, w.nomor wo_nomor FROM stock_movements s JOIN materials m ON m.id=s.material_id LEFT JOIN work_orders w ON w.id=s.wo_id WHERE s.tanggal BETWEEN ? AND ? ORDER BY s.tanggal, s.id`, from, to);
  section(doc, 'Rincian mutasi pada periode');
  table(doc, [{ h: 'Tanggal', w: 12 }, { h: 'Bahan', w: 28 }, { h: 'Jenis', w: 10 }, { h: 'Qty', w: 10, align: 'right' }, { h: 'Pesanan', w: 14 }, { h: 'Alasan / keterangan', w: 26 }],
    mov.map((s: any) => [tgl(s.tanggal), `${s.kode} ${s.nama}`, s.tipe, `${s.qty > 0 ? '+' : ''}${num(s.qty)} ${s.satuan}`, s.wo_nomor || '-', s.alasan || '']), { fontSize: 8 });
  signatures(doc, [{ label: 'Dibuat oleh,', title: 'Bagian Gudang', name: u.nama }, { label: 'Mengetahui,', title: 'Pemilik', name: '' }], placeDate());
  return { buf: await finalize(doc, { by: u.nama }), filename: `Laporan-Stok-${from}_${to}.pdf` };
}

// ---------------- Laporan transaksi ----------------
export async function laporanTransaksi(u: User, from: string, to: string): Promise<Out> {
  const pays = all(`SELECT p.tanggal, p.nomor ref, p.jenis kategori, ('Pembayaran ' || COALESCE(w.nomor,'') || ' — ' || COALESCE(c.nama,'')) ket, p.jumlah, a.nama akun FROM payments p LEFT JOIN work_orders w ON w.id=p.wo_id LEFT JOIN customers c ON c.id=w.customer_id LEFT JOIN cash_accounts a ON a.id=p.cash_account_id WHERE p.tanggal BETWEEN ? AND ?`, from, to);
  const exps = all(`SELECT e.tanggal, ('EXP-' || e.id) ref, e.kategori, e.deskripsi ket, e.jumlah, a.nama akun FROM expenses e LEFT JOIN cash_accounts a ON a.id=e.cash_account_id WHERE e.tanggal BETWEEN ? AND ?`, from, to);
  const rows = [...pays.map((r: any) => ({ ...r, masuk: r.jumlah, keluar: 0 })), ...exps.map((r: any) => ({ ...r, masuk: 0, keluar: r.jumlah }))].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const tin = pays.reduce((a: number, r: any) => a + r.jumlah, 0), tout = exps.reduce((a: number, r: any) => a + r.jumlah, 0);
  const doc = createDoc('Laporan Transaksi', true);
  kop(doc, 'Laporan Transaksi', [['Periode', tgl(from)], ['s/d', tgl(to)]]);
  heading(doc, 'LAPORAN TRANSAKSI PEMASUKAN & PENGELUARAN', `Periode ${tgl(from)} – ${tgl(to)}`);
  section(doc, 'Ringkasan per kategori');
  const byCat = (list: any[]) => Object.entries(list.reduce((a: any, r: any) => { a[r.kategori] = (a[r.kategori] || 0) + r.jumlah; return a; }, {})) as [string, number][];
  const ci = byCat(pays), co = byCat(exps);
  const n = Math.max(ci.length, co.length);
  table(doc, [{ h: 'Kategori pemasukan', w: 30 }, { h: 'Jumlah', w: 20, align: 'right' }, { h: 'Kategori pengeluaran', w: 30 }, { h: 'Jumlah', w: 20, align: 'right' }],
    Array.from({ length: n }, (_, i) => [ci[i]?.[0] || '', ci[i] ? rp(ci[i][1]) : '', co[i]?.[0] || '', co[i] ? rp(co[i][1]) : '']), { total: [['Total pemasukan', rp(tin), 'Total pengeluaran', rp(tout)], ['', '', 'Selisih kas (masuk - keluar)', rp(tin - tout)]] });
  section(doc, 'Rincian transaksi');
  table(doc, [{ h: 'Tanggal', w: 10 }, { h: 'Referensi', w: 12 }, { h: 'Kategori', w: 13 }, { h: 'Keterangan', w: 33 }, { h: 'Akun', w: 11 }, { h: 'Masuk', w: 10.5, align: 'right' }, { h: 'Keluar', w: 10.5, align: 'right' }],
    rows.map((r: any) => [tgl(r.tanggal), r.ref, r.kategori, r.ket || '', r.akun || '-', r.masuk ? rp(r.masuk) : '', r.keluar ? rp(r.keluar) : '']), { fontSize: 8, total: [['', '', '', 'TOTAL', '', rp(tin), rp(tout)]] });
  section(doc, 'Saldo akun kas & bank (per tanggal cetak)');
  table(doc, [{ h: 'Akun', w: 40 }, { h: 'Saldo awal', w: 15, align: 'right' }, { h: 'Masuk', w: 15, align: 'right' }, { h: 'Keluar', w: 15, align: 'right' }, { h: 'Saldo', w: 15, align: 'right' }], cashBalances().map((a: any) => [a.nama, rp(a.saldo_awal), rp(a.masuk), rp(a.keluar), rp(a.saldo)]));
  signatures(doc, [{ label: 'Dibuat oleh,', title: 'Bagian Keuangan', name: u.nama }, { label: 'Mengetahui,', title: 'Pemilik', name: '' }], placeDate());
  return { buf: await finalize(doc, { by: u.nama }), filename: `Laporan-Transaksi-${from}_${to}.pdf` };
}

// ---------------- Laporan laba rugi ----------------
export async function laporanLabaRugi(u: User, from: string, to: string): Promise<Out> {
  const f = periodFinance(from, to);
  const doc = createDoc('Laporan Laba Rugi');
  kop(doc, 'Laba Rugi', [['Periode', tgl(from)], ['s/d', tgl(to)]]);
  heading(doc, 'LAPORAN LABA RUGI', `Periode ${tgl(from)} – ${tgl(to)}`);
  const L = (k: string, v: string, bold = false) => [bold ? k.toUpperCase() : '   ' + k, v];
  table(doc, [{ h: 'Keterangan', w: 70 }, { h: 'Jumlah', w: 30, align: 'right' }], [
    L('Pendapatan', '', true), L('Pendapatan jasa & barang (invoice terbit)', rp(f.omzet)),
    L('Harga pokok / biaya langsung', '', true), L('Biaya bahan terpakai (pemakaian pada pesanan)', rp(f.bahan)), L('Tenaga kerja', rp(f.tenaga)),
    ['LABA KOTOR (pendapatan - HPP)', rp(f.labaKotor)],
    L('Biaya operasional', '', true), ...f.opsRows.map((r: any) => L(r.kategori, rp(r.v))), ...(f.opsRows.length ? [] : [L('(tidak ada)', rp(0))]), L('Total biaya operasional', rp(f.ops)),
  ], { fontSize: 9.5, total: [[f.laba >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH', rp(f.laba)]] });
  section(doc, 'Informasi tambahan (bukan bagian laba rugi)');
  const pr = receivables();
  kv(doc, [['Uang masuk dari pelanggan', rp(f.pemasukan)], ['Pembelian bahan (menambah persediaan)', rp(f.pembelianBahan)], ['Total pengeluaran kas', rp(f.pengeluaran)], ['Piutang belum tertagih (saat ini)', rp(pr.total)]], 220);
  note(doc, 'Pendapatan diakui saat invoice diterbitkan. Uang muka adalah penerimaan kas, bukan otomatis keuntungan. Pembelian bahan dicatat sebagai persediaan dan baru menjadi biaya saat bahan dipakai pada pesanan.');
  const per = all(`SELECT w.id, w.nomor, c.nama, i.total FROM invoices i JOIN work_orders w ON w.id=i.wo_id JOIN customers c ON c.id=w.customer_id WHERE i.status!='Batal' AND i.tanggal BETWEEN ? AND ? ORDER BY i.tanggal`, from, to);
  if (per.length) {
    section(doc, 'Estimasi margin per pesanan (invoice periode ini)');
    table(doc, [{ h: 'Pesanan', w: 16 }, { h: 'Pelanggan', w: 24 }, { h: 'Nilai', w: 15, align: 'right' }, { h: 'Bahan', w: 15, align: 'right' }, { h: 'TK + ops (est.)', w: 15, align: 'right' }, { h: 'Margin', w: 15, align: 'right' }],
      per.map((r: any) => { const s = woSummary(r.id); return [r.nomor, r.nama, rp(r.total), rp(s.bahan), rp(s.tk + s.ops), rp(r.total - s.bahan - s.tk - s.ops)]; }), { fontSize: 8 });
  }
  signatures(doc, [{ label: 'Dibuat oleh,', title: 'Bagian Keuangan', name: u.nama }, { label: 'Disetujui,', title: 'Pemilik', name: '' }], placeDate());
  return { buf: await finalize(doc, { by: u.nama }), filename: `Laporan-LabaRugi-${from}_${to}.pdf` };
}

// ---------------- Laporan piutang ----------------
export async function laporanPiutang(u: User): Promise<Out> {
  const pr = receivables();
  const doc = createDoc('Laporan Piutang');
  kop(doc, 'Laporan Piutang', [['Per tanggal', tgl(today())]]);
  heading(doc, 'DAFTAR PIUTANG & UMUR PIUTANG', `Per ${tgl(today())}`);
  table(doc, [{ h: 'Invoice', w: 15 }, { h: 'Pelanggan', w: 22 }, { h: 'Jatuh tempo', w: 14 }, { h: 'Total', w: 13, align: 'right' }, { h: 'Dibayar', w: 13, align: 'right' }, { h: 'Sisa', w: 13, align: 'right' }, { h: 'Umur', w: 10 }],
    pr.rows.map((r: any) => [`${r.nomor}\n${r.wo_nomor}`, `${r.pelanggan}\n${r.telepon || ''}`, tgl(r.jatuh_tempo), rp(r.total), rp(r.dibayar), rp(r.sisa), r.umur > 0 ? `lewat ${r.umur} hr` : 'belum jatuh tempo']), { total: [['', 'TOTAL PIUTANG', '', '', '', rp(pr.total), '']] });
  const b = (lo: number, hi: number) => pr.rows.filter((r: any) => r.umur >= lo && r.umur <= hi).reduce((a: number, r: any) => a + r.sisa, 0);
  section(doc, 'Ringkasan umur piutang');
  table(doc, [{ h: 'Belum jatuh tempo', w: 25, align: 'right' }, { h: '1–30 hari', w: 25, align: 'right' }, { h: '31–60 hari', w: 25, align: 'right' }, { h: '> 60 hari', w: 25, align: 'right' }], [[rp(b(-99999, 0)), rp(b(1, 30)), rp(b(31, 60)), rp(b(61, 999999))]]);
  signatures(doc, [{ label: 'Dibuat oleh,', title: 'Bagian Keuangan', name: u.nama }, { label: 'Mengetahui,', title: 'Pemilik', name: '' }], placeDate());
  return { buf: await finalize(doc, { by: u.nama }), filename: `Laporan-Piutang-${today()}.pdf` };
}
