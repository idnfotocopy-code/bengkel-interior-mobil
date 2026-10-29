'use server';
import { redirect } from 'next/navigation';
import { requirePerm, audit } from '@/lib/auth';
import { insert, update, one, run, tx } from '@/lib/db';
import { addStockMovement } from '@/lib/biz';
import { s, n, nowStr, today, withMsg } from '@/lib/util';

export async function saveMaterial(fd: FormData) {
  const u = requirePerm('stok.master');
  const id = Number(fd.get('id') || 0);
  const kode = s(fd, 'kode').toUpperCase();
  const data = { kode, nama: s(fd, 'nama'), satuan: s(fd, 'satuan') || 'pcs', minimum: n(fd, 'minimum'), harga_beli: n(fd, 'harga_beli'), supplier_id: Number(fd.get('supplier_id')) || null, lokasi: s(fd, 'lokasi') };
  const back = id ? `/persediaan/${id}` : '/persediaan';
  if (!kode || !data.nama) redirect(withMsg(back, 'err', 'Kode dan nama bahan wajib diisi.'));
  const dup = one('SELECT id FROM materials WHERE kode=? AND id!=?', kode, id);
  if (dup) redirect(withMsg(back, 'err', `Kode ${kode} sudah dipakai.`));
  let newId = id;
  tx(() => {
    if (id) update('materials', id, data);
    else {
      newId = insert('materials', { ...data, stok: 0, aktif: 1 });
      const awal = n(fd, 'stok_awal');
      if (awal > 0) addStockMovement({ material_id: newId, tipe: 'masuk', qty: awal, harga: data.harga_beli, alasan: 'Stok awal', user_id: u.id });
    }
  });
  audit(u, id ? 'UBAH' : 'TAMBAH', 'materials', newId, kode);
  if (id) redirect(withMsg(s(fd, 'back') || `/persediaan/${id}`, 'ok', `Data bahan ${kode} diperbarui.`));
  redirect(withMsg(`/persediaan?hl=${newId}`, 'ok', `Bahan ${kode} — ${data.nama} ditambahkan ke daftar bahan.`));
}
/** Hapus bahan: permanen bila belum pernah ada mutasi/pemakaian; bila sudah, dinonaktifkan agar riwayat tetap utuh. */
export async function deleteMaterial(fd: FormData) {
  const u = requirePerm('stok.master');
  const id = Number(fd.get('id'));
  const m = one('SELECT * FROM materials WHERE id=?', id);
  if (!m) redirect(withMsg('/persediaan', 'err', 'Bahan tidak ditemukan.'));
  const used = one('SELECT (SELECT COUNT(*) FROM stock_movements WHERE material_id=?) + (SELECT COUNT(*) FROM material_usage WHERE material_id=?) n', id, id).n;
  if (used) {
    run('UPDATE materials SET aktif=0 WHERE id=?', id);
    audit(u, 'NONAKTIF', 'materials', id, `${m.kode} (punya riwayat mutasi)`);
    redirect(withMsg('/persediaan', 'ok', `Bahan ${m.kode} sudah punya riwayat stok, jadi dinonaktifkan (tidak dihapus permanen).`));
  }
  run('DELETE FROM materials WHERE id=?', id);
  audit(u, 'HAPUS', 'materials', id, `${m.kode} ${m.nama}`);
  redirect(withMsg('/persediaan', 'ok', `Bahan ${m.kode} dihapus.`));
}
export async function deleteSupplier(fd: FormData) {
  const u = requirePerm('stok.master');
  const id = Number(fd.get('id'));
  const sp = one('SELECT * FROM suppliers WHERE id=?', id);
  run('UPDATE materials SET supplier_id=NULL WHERE supplier_id=?', id);
  run('DELETE FROM suppliers WHERE id=?', id);
  audit(u, 'HAPUS', 'suppliers', id, sp?.nama || '');
  redirect(withMsg('/persediaan?tab=supplier', 'ok', 'Pemasok dihapus.'));
}
export async function toggleMaterial(fd: FormData) {
  const u = requirePerm('stok.master');
  const id = Number(fd.get('id'));
  run('UPDATE materials SET aktif=1-aktif WHERE id=?', id);
  audit(u, 'AKTIF_TOGGLE', 'materials', id);
  redirect(withMsg(s(fd, 'back') || `/persediaan/${id}`, 'ok', 'Status bahan diperbarui.'));
}
export async function saveSupplier(fd: FormData) {
  const u = requirePerm('stok.master');
  const id = Number(fd.get('id') || 0);
  const data = { nama: s(fd, 'nama'), telepon: s(fd, 'telepon'), alamat: s(fd, 'alamat') };
  if (!data.nama) redirect(withMsg('/persediaan?tab=supplier', 'err', 'Nama pemasok wajib diisi.'));
  if (id) update('suppliers', id, data); else insert('suppliers', data);
  audit(u, id ? 'UBAH' : 'TAMBAH', 'suppliers', id, data.nama);
  redirect(withMsg('/persediaan?tab=supplier', 'ok', 'Pemasok disimpan.'));
}

export async function stockMove(fd: FormData) {
  const tipe = s(fd, 'tipe') as 'masuk' | 'keluar' | 'penyesuaian';
  const u = requirePerm(tipe === 'masuk' ? 'stok.masuk' : 'stok.penyesuaian');
  const material_id = Number(fd.get('material_id'));
  const back = s(fd, 'back') || '/persediaan?tab=mutasi';
  const alasan = s(fd, 'alasan');
  let qty = n(fd, 'qty');
  if (!['masuk', 'keluar', 'penyesuaian'].includes(tipe) || !material_id || !qty) redirect(withMsg(back, 'err', 'Lengkapi bahan, jenis, dan jumlah.'));
  if (tipe !== 'masuk' && !alasan) redirect(withMsg(back, 'err', 'Alasan wajib diisi untuk barang keluar/penyesuaian.'));
  const tanggal = s(fd, 'tanggal') || today();
  const harga = n(fd, 'harga');
  try {
    tx(() => {
      const m = one('SELECT * FROM materials WHERE id=?', material_id);
      if (tipe === 'penyesuaian' && s(fd, 'mode') === 'set') qty = qty - m.stok; // set stok fisik
      if (tipe === 'penyesuaian' && Math.abs(qty) < 1e-9) throw new Error('Stok fisik sama dengan stok sistem; tidak ada penyesuaian.');
      const { id } = addStockMovement({ material_id, tipe, qty, harga: tipe === 'masuk' && harga > 0 ? harga : undefined, alasan: alasan || (tipe === 'masuk' ? 'Pembelian / stok masuk' : ''), user_id: u.id, tanggal });
      if (tipe === 'masuk' && harga > 0 && s(fd, 'update_harga')) run('UPDATE materials SET harga_beli=? WHERE id=?', harga, material_id);
      if (tipe === 'masuk' && s(fd, 'catat_biaya') && harga > 0) {
        insert('expenses', { tanggal, kategori: 'Pembelian bahan', deskripsi: `Beli ${m.kode} ${m.nama} ${qty} ${m.satuan}${alasan ? ' — ' + alasan : ''}`, jumlah: Math.abs(qty) * harga, cash_account_id: Number(fd.get('cash_account_id')) || null, user_id: u.id, created_at: nowStr() });
      }
      audit(u, 'STOK_' + tipe.toUpperCase(), 'materials', material_id, `${qty} (${alasan}) mv#${id}`);
    });
  } catch (e: any) { redirect(withMsg(back, 'err', e.message)); }
  redirect(withMsg(back, 'ok', tipe === 'masuk' ? 'Stok masuk dicatat.' : tipe === 'keluar' ? 'Barang keluar dicatat.' : 'Penyesuaian stok dicatat.'));
}

/** Mutasi manual (masuk/keluar/penyesuaian tanpa pesanan) boleh diedit/dihapus; stok ikut dikoreksi. */
function manualMovement(id: number, back: string) {
  const mv = one('SELECT * FROM stock_movements WHERE id=?', id);
  if (!mv) redirect(withMsg(back, 'err', 'Mutasi tidak ditemukan.'));
  if (mv.wo_id || !['masuk', 'keluar', 'penyesuaian'].includes(mv.tipe) || one('SELECT id FROM material_usage WHERE movement_id=?', id))
    redirect(withMsg(back, 'err', 'Mutasi dari pemakaian pesanan hanya bisa dibatalkan dari halaman pesanan.'));
  return mv;
}

export async function updateMovement(fd: FormData) {
  const id = Number(fd.get('id'));
  const back = s(fd, 'back') || '/persediaan?tab=mutasi';
  const mv = manualMovement(id, back);
  const u = requirePerm(mv.tipe === 'masuk' ? 'stok.masuk' : 'stok.penyesuaian');
  const q = n(fd, 'qty');
  if (!q) redirect(withMsg(back, 'err', 'Jumlah wajib diisi.'));
  const signed = mv.tipe === 'masuk' ? Math.abs(q) : mv.tipe === 'keluar' ? -Math.abs(q) : q;
  const alasan = s(fd, 'alasan');
  if (mv.tipe !== 'masuk' && !alasan) redirect(withMsg(back, 'err', 'Alasan wajib diisi.'));
  try {
    tx(() => {
      const m = one('SELECT * FROM materials WHERE id=?', mv.material_id);
      const delta = signed - mv.qty;
      if (m.stok + delta < -1e-9) throw new Error(`Perubahan membuat stok ${m.nama} minus (stok sekarang ${m.stok} ${m.satuan}).`);
      update('stock_movements', id, { qty: signed, harga: mv.tipe === 'masuk' ? n(fd, 'harga') : mv.harga, alasan, tanggal: s(fd, 'tanggal') || mv.tanggal });
      run('UPDATE materials SET stok=stok+? WHERE id=?', delta, mv.material_id);
    });
  } catch (e: any) { redirect(withMsg(back, 'err', e.message)); }
  audit(u, 'UBAH_MUTASI', 'materials', mv.material_id, `mv#${id} ${mv.qty} → ${signed}`);
  redirect(withMsg(back, 'ok', 'Mutasi stok diperbarui; stok bahan ikut dikoreksi.'));
}

export async function deleteMovement(fd: FormData) {
  const id = Number(fd.get('id'));
  const back = s(fd, 'back') || '/persediaan?tab=mutasi';
  const mv = manualMovement(id, back);
  const u = requirePerm(mv.tipe === 'masuk' ? 'stok.masuk' : 'stok.penyesuaian');
  try {
    tx(() => {
      const m = one('SELECT * FROM materials WHERE id=?', mv.material_id);
      if (m.stok - mv.qty < -1e-9) throw new Error(`Menghapus mutasi ini membuat stok ${m.nama} minus (stok sekarang ${m.stok} ${m.satuan}).`);
      run('DELETE FROM stock_movements WHERE id=?', id);
      run('UPDATE materials SET stok=stok-? WHERE id=?', mv.qty, mv.material_id);
    });
  } catch (e: any) { redirect(withMsg(back, 'err', e.message)); }
  audit(u, 'HAPUS_MUTASI', 'materials', mv.material_id, JSON.stringify(mv));
  redirect(withMsg(back, 'ok', 'Mutasi stok dihapus; stok bahan dikembalikan. (Pengeluaran pembelian terkait, bila ada, hapus dari menu Keuangan.)'));
}
