'use server';
import { redirect } from 'next/navigation';
import { requirePerm, audit } from '@/lib/auth';
import { insert, update, one, run, nextNumber, tx, settings } from '@/lib/db';
import { woSummary, syncInvoiceStatus, activeInvoice } from '@/lib/biz';
import { EXPENSE_CATEGORIES, PAYMENT_TYPES } from '@/lib/constants';
import { s, n, q, nowStr, today, addDays, withMsg } from '@/lib/util';

const back = (fd: FormData, def: string) => s(fd, 'back') || def;

export async function addPayment(fd: FormData) {
  const u = requirePerm('bayar.catat');
  const wo_id = Number(fd.get('wo_id'));
  const b = back(fd, wo_id ? `/pesanan/${wo_id}` : '/keuangan?tab=pembayaran');
  const jumlah = n(fd, 'jumlah');
  if (!wo_id || !(jumlah > 0)) redirect(withMsg(b, 'err', 'Pilih pesanan dan isi jumlah pembayaran.'));
  const sm = woSummary(wo_id);
  const jenis = PAYMENT_TYPES.includes(s(fd, 'jenis')) ? s(fd, 'jenis') : 'Pembayaran tahap';
  if (jenis !== 'Jasa tambahan' && jenis !== 'Pendapatan lain' && sm.total > 0 && jumlah > sm.sisa + 0.5) redirect(withMsg(b, 'err', `Jumlah melebihi sisa tagihan (Rp${Math.round(sm.sisa).toLocaleString('id-ID')}).`));
  const tanggal = s(fd, 'tanggal') || today();
  const id = tx(() => {
    const inv = activeInvoice(wo_id);
    const id = insert('payments', { nomor: nextNumber('KWT', 'payments', Number(tanggal.slice(0, 4))), wo_id, invoice_id: inv?.id || null, tanggal, jenis, jumlah, metode: s(fd, 'metode') || 'Tunai', cash_account_id: Number(fd.get('cash_account_id')) || null, catatan: s(fd, 'catatan'), user_id: u.id, created_at: nowStr() });
    syncInvoiceStatus(wo_id);
    return id;
  });
  audit(u, 'BAYAR', 'payments', id, `WO ${wo_id} ${jenis} ${jumlah}`);
  redirect(withMsg(b, 'ok', 'Pembayaran dicatat. Kuitansi dapat dicetak.', `&kwt=${id}`));
}
export async function deletePayment(fd: FormData) {
  const u = requirePerm('bayar.hapus');
  const id = Number(fd.get('id'));
  const p = one('SELECT * FROM payments WHERE id=?', id);
  run('DELETE FROM payments WHERE id=?', id);
  if (p?.wo_id) syncInvoiceStatus(p.wo_id);
  audit(u, 'HAPUS_BAYAR', 'payments', id, JSON.stringify(p));
  redirect(withMsg(back(fd, '/keuangan?tab=pembayaran'), 'ok', 'Pembayaran dihapus (tercatat di riwayat aktivitas).'));
}

export async function createInvoice(fd: FormData) {
  const u = requirePerm('invoice.kelola');
  const wo_id = Number(fd.get('wo_id'));
  const b = back(fd, `/pesanan/${wo_id}`);
  const sm = woSummary(wo_id);
  if (!(sm.total > 0)) redirect(withMsg(b, 'err', 'Tambahkan rincian jasa/barang dulu sebelum membuat invoice.'));
  const tanggal = s(fd, 'tanggal') || today();
  const st = settings();
  const id = tx(() => {
    run("UPDATE invoices SET status='Batal', catatan=COALESCE(catatan,'')||' (diganti invoice baru)' WHERE wo_id=? AND status!='Batal'", wo_id);
    const id = insert('invoices', { nomor: nextNumber('INV', 'invoices', Number(tanggal.slice(0, 4))), wo_id, tanggal, jatuh_tempo: s(fd, 'jatuh_tempo') || addDays(tanggal, Number(st.jatuh_tempo_hari) || 7), total: sm.total, status: 'Belum lunas', catatan: s(fd, 'catatan'), created_by: u.id, created_at: nowStr() });
    run('UPDATE payments SET invoice_id=? WHERE wo_id=?', id, wo_id);
    syncInvoiceStatus(wo_id);
    return id;
  });
  audit(u, 'INVOICE', 'invoices', id, `WO ${wo_id} total ${sm.total}`);
  redirect(withMsg(b, 'ok', 'Invoice dibuat.'));
}
export async function cancelInvoice(fd: FormData) {
  const u = requirePerm('invoice.kelola');
  const id = Number(fd.get('id'));
  run("UPDATE invoices SET status='Batal' WHERE id=?", id);
  audit(u, 'BATAL_INVOICE', 'invoices', id);
  redirect(withMsg(back(fd, '/keuangan?tab=invoice'), 'ok', 'Invoice dibatalkan.'));
}

export async function addExpense(fd: FormData) {
  const u = requirePerm('biaya.kelola');
  const jumlah = n(fd, 'jumlah');
  const kategori = EXPENSE_CATEGORIES.includes(s(fd, 'kategori')) ? s(fd, 'kategori') : 'Operasional lain';
  if (!(jumlah > 0)) redirect(`/keuangan?tab=pengeluaran&err=${q('Jumlah wajib diisi.')}`);
  const id = insert('expenses', { tanggal: s(fd, 'tanggal') || today(), kategori, deskripsi: s(fd, 'deskripsi'), jumlah, wo_id: Number(fd.get('wo_id')) || null, cash_account_id: Number(fd.get('cash_account_id')) || null, user_id: u.id, created_at: nowStr() });
  audit(u, 'BIAYA', 'expenses', id, `${kategori} ${jumlah}`);
  redirect(`/keuangan?tab=pengeluaran&ok=${q('Pengeluaran dicatat.')}`);
}
export async function deleteExpense(fd: FormData) {
  const u = requirePerm('biaya.kelola');
  const id = Number(fd.get('id'));
  const e = one('SELECT * FROM expenses WHERE id=?', id);
  run('DELETE FROM expenses WHERE id=?', id);
  audit(u, 'HAPUS_BIAYA', 'expenses', id, JSON.stringify(e));
  redirect(`/keuangan?tab=pengeluaran&ok=${q('Pengeluaran dihapus.')}`);
}
export async function saveCashAccount(fd: FormData) {
  const u = requirePerm('kas.kelola');
  const id = Number(fd.get('id') || 0);
  const data = { nama: s(fd, 'nama'), jenis: s(fd, 'jenis') || 'kas', no_rekening: s(fd, 'no_rekening'), saldo_awal: n(fd, 'saldo_awal') };
  if (!data.nama) redirect(`/keuangan?tab=kas&err=${q('Nama akun wajib diisi.')}`);
  if (id) update('cash_accounts', id, data); else insert('cash_accounts', data);
  audit(u, id ? 'UBAH' : 'TAMBAH', 'cash_accounts', id, data.nama);
  redirect(`/keuangan?tab=kas&ok=${q('Akun kas disimpan.')}`);
}
