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
  redirect(withMsg(`/persediaan/${newId}`, 'ok', 'Data bahan disimpan.'));
}
export async function toggleMaterial(fd: FormData) {
  const u = requirePerm('stok.master');
  const id = Number(fd.get('id'));
  run('UPDATE materials SET aktif=1-aktif WHERE id=?', id);
  audit(u, 'AKTIF_TOGGLE', 'materials', id);
  redirect(withMsg(`/persediaan/${id}`, 'ok', 'Status bahan diperbarui.'));
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
