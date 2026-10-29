'use server';
import { redirect } from 'next/navigation';
import { requirePerm, requireUser, audit } from '@/lib/auth';
import { insert, update, one, run, nextNumber, tx } from '@/lib/db';
import { can } from '@/lib/rbac';
import { woForUser } from '@/lib/access';
import { useMaterial as useMat, cancelUsage as cancelUse, syncInvoiceStatus } from '@/lib/biz';
import { WO_STATUSES, TEKNISI_STATUSES, WO_CANCELLED } from '@/lib/constants';
import { s, n, q, nowStr, today, addDays, withMsg } from '@/lib/util';

const go = (id: number, msg: string, err = false): never => redirect(withMsg(`/pesanan/${id}`, err ? 'err' : 'ok', msg));

export async function createWO(fd: FormData) {
  const u = requirePerm('pesanan.kelola');
  const customer_id = Number(fd.get('customer_id')), vehicle_id = Number(fd.get('vehicle_id'));
  const v = one('SELECT * FROM vehicles WHERE id=? AND customer_id=?', vehicle_id, customer_id);
  if (!v) redirect(`/pesanan/baru?err=${q('Pilih pelanggan dan kendaraan miliknya.')}`);
  const tgl_masuk = s(fd, 'tgl_masuk') || today();
  const status = WO_STATUSES.includes(s(fd, 'status') as any) ? s(fd, 'status') : 'Konsultasi';
  const id = tx(() => {
    const nomor = nextNumber('BIM', 'work_orders', Number(tgl_masuk.slice(0, 4)));
    const id = insert('work_orders', {
      nomor, customer_id, vehicle_id, jenis_pekerjaan: s(fd, 'jenis_pekerjaan'), deskripsi: s(fd, 'deskripsi'), tgl_masuk, target_selesai: s(fd, 'target_selesai') || addDays(tgl_masuk, 7),
      status, teknisi_id: Number(fd.get('teknisi_id')) || null, pj_id: u.id, catatan: s(fd, 'catatan'), created_by: u.id, created_at: nowStr(), updated_at: nowStr(),
    });
    const desc = s(fd, 'item_deskripsi');
    if (desc) insert('work_order_items', { wo_id: id, jenis: s(fd, 'item_jenis') || 'jasa', deskripsi: desc, qty: n(fd, 'item_qty') || 1, satuan: s(fd, 'item_satuan') || 'paket', harga: n(fd, 'item_harga') });
    insert('wo_status_history', { wo_id: id, dari: null, ke: status, catatan: 'Pesanan dibuat', user_id: u.id, at: nowStr() });
    const c = one('SELECT tgl_pertama FROM customers WHERE id=?', customer_id);
    if (!c.tgl_pertama || c.tgl_pertama > tgl_masuk) run('UPDATE customers SET tgl_pertama=? WHERE id=?', tgl_masuk, customer_id);
    return id;
  });
  audit(u, 'TAMBAH', 'work_orders', id);
  go(id, 'Pesanan dibuat. Tambahkan rincian jasa/barang di bawah.');
}

export async function updateWO(fd: FormData) {
  const u = requirePerm('pesanan.kelola');
  const id = Number(fd.get('id'));
  const data: any = { jenis_pekerjaan: s(fd, 'jenis_pekerjaan'), deskripsi: s(fd, 'deskripsi'), tgl_masuk: s(fd, 'tgl_masuk'), target_selesai: s(fd, 'target_selesai'), teknisi_id: Number(fd.get('teknisi_id')) || null, catatan: s(fd, 'catatan'), kondisi_serah: s(fd, 'kondisi_serah'), updated_at: nowStr() };
  if (can(u.role, 'pesanan.harga')) Object.assign(data, { diskon: n(fd, 'diskon'), biaya_tenaga_kerja: n(fd, 'biaya_tenaga_kerja'), biaya_ops: n(fd, 'biaya_ops') });
  update('work_orders', id, data);
  audit(u, 'UBAH', 'work_orders', id, JSON.stringify(data));
  go(id, 'Data pesanan disimpan.');
}

export async function addItem(fd: FormData) {
  const u = requirePerm('pesanan.harga');
  const id = Number(fd.get('wo_id'));
  const desc = s(fd, 'deskripsi');
  if (!desc) go(id, 'Deskripsi item wajib diisi.', true);
  insert('work_order_items', { wo_id: id, jenis: s(fd, 'jenis') === 'barang' ? 'barang' : 'jasa', deskripsi: desc, qty: n(fd, 'qty') || 1, satuan: s(fd, 'satuan') || 'paket', harga: n(fd, 'harga') });
  audit(u, 'TAMBAH_ITEM', 'work_orders', id, `${desc} @ ${n(fd, 'harga')}`);
  insert('wo_status_history', { wo_id: id, dari: null, ke: one('SELECT status FROM work_orders WHERE id=?', id).status, catatan: `Item ditambahkan: ${desc} (${n(fd, 'qty') || 1} × ${n(fd, 'harga')})`, user_id: u.id, at: nowStr() });
  go(id, 'Item ditambahkan.');
}
export async function deleteItem(fd: FormData) {
  const u = requirePerm('pesanan.harga');
  const id = Number(fd.get('wo_id')), item = Number(fd.get('item_id'));
  const it = one('SELECT * FROM work_order_items WHERE id=? AND wo_id=?', item, id);
  run('DELETE FROM work_order_items WHERE id=? AND wo_id=?', item, id);
  audit(u, 'HAPUS_ITEM', 'work_orders', id, it?.deskripsi);
  insert('wo_status_history', { wo_id: id, dari: null, ke: one('SELECT status FROM work_orders WHERE id=?', id).status, catatan: `Item dihapus: ${it?.deskripsi}`, user_id: u.id, at: nowStr() });
  go(id, 'Item dihapus.');
}

export async function changeStatus(fd: FormData) {
  const u = requireUser();
  const id = Number(fd.get('wo_id'));
  const wo = woForUser(u, id);
  const ke = s(fd, 'status');
  const back = s(fd, 'back') || `/pesanan/${id}`;
  const allowed = can(u.role, 'status.semua') ? WO_STATUSES as readonly string[] : u.role === 'teknisi' && wo.teknisi_id === u.id ? TEKNISI_STATUSES : [];
  if (!allowed.includes(ke)) redirect(withMsg(back, 'err', 'Anda tidak berhak mengubah ke status tersebut.'));
  if (wo.status === WO_CANCELLED) redirect(withMsg(back, 'err', 'Pesanan sudah dibatalkan.'));
  if (ke === wo.status) redirect(withMsg(back, 'err', 'Status tidak berubah.'));
  tx(() => {
    run('UPDATE work_orders SET status=?, updated_at=?, tgl_selesai=? WHERE id=?', ke, nowStr(), ke === 'Selesai' ? (wo.tgl_selesai || today()) : null, id);
    insert('wo_status_history', { wo_id: id, dari: wo.status, ke, catatan: s(fd, 'catatan'), user_id: u.id, at: nowStr() });
  });
  audit(u, 'STATUS', 'work_orders', id, `${wo.status} → ${ke}`);
  redirect(withMsg(back, 'ok', `Status ${wo.nomor} diubah menjadi "${ke}".`));
}

export async function cancelWO(fd: FormData) {
  const u = requirePerm('pesanan.batal');
  const id = Number(fd.get('wo_id'));
  const wo = one('SELECT * FROM work_orders WHERE id=?', id);
  const alasan = s(fd, 'alasan') || 'Dibatalkan';
  tx(() => {
    run('UPDATE work_orders SET status=?, updated_at=? WHERE id=?', WO_CANCELLED, nowStr(), id);
    insert('wo_status_history', { wo_id: id, dari: wo.status, ke: WO_CANCELLED, catatan: alasan, user_id: u.id, at: nowStr() });
    run("UPDATE invoices SET status='Batal' WHERE wo_id=?", id);
  });
  audit(u, 'BATAL', 'work_orders', id, alasan);
  go(id, 'Pesanan dibatalkan. Pemakaian bahan & pembayaran tetap tercatat untuk jejak audit.');
}

export async function useMaterial(fd: FormData) {
  const u = requirePerm('bahan.pakai');
  const id = Number(fd.get('wo_id'));
  const back = s(fd, 'back') || `/pesanan/${id}`;
  woForUser(u, id);
  try { useMat(id, Number(fd.get('material_id')), n(fd, 'qty'), u.id, s(fd, 'tanggal') || undefined); }
  catch (e: any) { redirect(withMsg(back, 'err', e.message)); }
  audit(u, 'PAKAI_BAHAN', 'work_orders', id, `material ${fd.get('material_id')} qty ${n(fd, 'qty')}`);
  redirect(withMsg(back, 'ok', 'Pemakaian bahan dicatat dan stok dikurangi.'));
}
export async function cancelUsage(fd: FormData) {
  const u = requirePerm('bahan.batal');
  const id = Number(fd.get('wo_id'));
  try { cancelUse(Number(fd.get('usage_id')), u.id); } catch (e: any) { go(id, e.message, true); }
  audit(u, 'BATAL_PAKAI', 'work_orders', id, String(fd.get('usage_id')));
  go(id, 'Pemakaian dibatalkan; stok dikembalikan dan tercatat sebagai koreksi.');
}
