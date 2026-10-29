import bcrypt from 'bcryptjs';
import { db, insert, run, one, DEFAULT_SETTINGS, setSetting } from './db';
import { today, addDays, nowStr } from './util';

/** Data demo. Semua nama, nomor, dan angka fiktif. Password demo: password123 */
export function seed() {
  const d = db();
  const T = today();
  const ago = (n: number) => addDays(T, -n);
  const at = (date: string, h = 9) => `${date} ${String(h).padStart(2, '0')}:00:00`;
  const year = Number(T.slice(0, 4));

  d.transaction(() => {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) setSetting(k, v);
    const hash = bcrypt.hashSync('password123', 10);
    const U: Record<string, number> = {};
    for (const [username, nama, role] of [
      ['pemilik', 'Pak Hendra (Pemilik)', 'pemilik'], ['admin', 'Sinta Admin', 'admin'], ['keuangan', 'Rina Keuangan', 'keuangan'],
      ['gudang', 'Joko Gudang', 'gudang'], ['teknisi', 'Agus Teknisi', 'teknisi'], ['teknisi2', 'Dedi Teknisi', 'teknisi'],
    ]) U[username] = insert('users', { username, nama, role, password_hash: hash, aktif: 1, created_at: nowStr() });

    const kas = insert('cash_accounts', { nama: 'Kas Tunai', jenis: 'kas', saldo_awal: 10000000 });
    const bank = insert('cash_accounts', { nama: 'Bank BCA Usaha', jenis: 'bank', no_rekening: '000-000-0000', saldo_awal: 50000000 });

    const S1 = insert('suppliers', { nama: 'CV Kulit Jaya', telepon: '021-5550001', alamat: 'Jl. Industri Kulit No. 5' });
    const S2 = insert('suppliers', { nama: 'Toko Busa Makmur', telepon: '021-5550002', alamat: 'Pasar Material Blok B2' });
    const S3 = insert('suppliers', { nama: 'UD Karpet Sentosa', telepon: '021-5550003', alamat: 'Jl. Tekstil Raya 18' });

    const M: Record<string, number> = {};
    const mats: [string, string, string, number, number, number, number, string][] = [
      ['B001', 'Kulit sintetis', 'Meter', 150, 30, 85000, S1, 'Rak A1'],
      ['B002', 'Kulit asli', 'Meter', 80, 20, 450000, S1, 'Rak A2'],
      ['B003', 'Busa jok', 'Lembar', 50, 10, 120000, S2, 'Rak B1'],
      ['B004', 'Benang jahit', 'Gulung', 100, 20, 25000, S2, 'Laci C1'],
      ['B005', 'Karpet mobil', 'Meter', 75, 15, 95000, S3, 'Rak D1'],
      ['B006', 'Lem kuning (kaleng)', 'Kaleng', 12, 10, 65000, S2, 'Laci C2'],
      ['B007', 'Kain plafon', 'Meter', 18, 20, 70000, S3, 'Rak D2'],
    ];
    // stok awal dicatat sebagai mutasi "masuk" 45 hari lalu agar laporan stok punya saldo awal
    for (const [kode, nama, satuan, stok, minimum, harga, sup, lokasi] of mats) {
      M[kode] = insert('materials', { kode, nama, satuan, stok: 0, minimum, harga_beli: harga, supplier_id: sup, lokasi });
      insert('stock_movements', { material_id: M[kode], tipe: 'masuk', qty: stok, harga, alasan: 'Saldo awal', user_id: U.gudang, tanggal: ago(45), at: at(ago(45)) });
      run('UPDATE materials SET stok=? WHERE id=?', stok, M[kode]);
    }

    const C: number[] = [];
    const custs: [string, string, string, string, number][] = [
      ['Budi Santoso', '0812-1111-2222', 'Jl. Melati No. 10', 'Suka warna hitam, jahitan double stitch', 60],
      ['Siti Rahmawati', '0813-2222-3333', 'Perum Griya Asri B-4', 'Minta dihubungi via WhatsApp saja', 40],
      ['CV Maju Bersama', '0815-3333-4444', 'Jl. Raya Industri 77', 'Armada travel, butuh faktur', 35],
      ['Andi Wijaya', '0817-4444-5555', 'Jl. Kenanga 3', 'Kolektor mobil klasik', 25],
      ['Dewi Lestari', '0819-5555-6666', 'Apartemen Taman Kota T2-1205', '', 12],
      ['Rudi Hartono', '0821-6666-7777', 'Jl. Anggrek 21', 'Pernah komplain jahitan, minta QC ekstra', 5],
    ];
    custs.forEach(([nama, telepon, alamat, catatan, days], i) => {
      C.push(insert('customers', { kode: `PLG-${String(i + 1).padStart(4, '0')}`, nama, telepon, alamat, catatan, tgl_pertama: ago(days), created_at: at(ago(days)) }));
    });
    const V: number[] = [];
    const vehs: [number, string, string, string, number, string, string][] = [
      [0, 'B 1234 ABC', 'Toyota', 'Fortuner VRZ', 2019, 'Hitam', 'Jok depan sobek di sisi kanan, busa kempes'],
      [1, 'B 2345 BCD', 'Honda', 'HR-V', 2021, 'Putih', 'Plafon kendur bagian belakang'],
      [2, 'B 7001 CMB', 'Toyota', 'HiAce Commuter', 2020, 'Silver', 'Jok penumpang kusam, karpet basah'],
      [3, 'B 1965 CL', 'Mercedes-Benz', 'W110 Heckflosse', 1965, 'Krem', 'Interior original rapuh, restorasi total'],
      [4, 'B 5678 DEF', 'Mitsubishi', 'Xpander Cross', 2022, 'Oranye', 'Kondisi baik, ingin upgrade kulit'],
      [5, 'B 9090 RH', 'Suzuki', 'Ertiga', 2018, 'Abu-abu', 'Setir licin, karpet aus'],
      [0, 'B 4321 BS', 'Toyota', 'Alphard', 2017, 'Putih', 'Doortrim baret'],
    ];
    vehs.forEach(([ci, nopol, merek, tipe, tahun, warna, kondisi]) => {
      V.push(insert('vehicles', { customer_id: C[ci], nopol, merek, tipe, tahun, warna, kondisi, created_at: nowStr() }));
    });

    let woSeq = 0;
    const mkWO = (o: { ci: number; vi: number; jenis: string; masuk: number; target: number; status: string; teknisi?: number; items: [string, string, number, string, number][]; tk?: number; ops?: number; selesai?: number; flow: string[] }) => {
      woSeq++;
      const nomor = `BIM-${year}-${String(woSeq).padStart(4, '0')}`;
      const id = insert('work_orders', {
        nomor, customer_id: C[o.ci], vehicle_id: V[o.vi], jenis_pekerjaan: o.jenis, deskripsi: o.jenis, tgl_masuk: ago(o.masuk), target_selesai: addDays(ago(o.masuk), o.target),
        tgl_selesai: o.selesai != null ? ago(o.selesai) : null, status: o.status, teknisi_id: o.teknisi ?? null, pj_id: U.admin, biaya_tenaga_kerja: o.tk || 0, biaya_ops: o.ops || 0,
        created_by: U.admin, created_at: at(ago(o.masuk)), updated_at: nowStr(),
      });
      for (const [jenis, deskripsi, qty, satuan, harga] of o.items) insert('work_order_items', { wo_id: id, jenis, deskripsi, qty, satuan, harga });
      let prev: string | null = null;
      o.flow.forEach((st, i) => {
        const day = Math.max(o.masuk - i, o.selesai ?? 0);
        insert('wo_status_history', { wo_id: id, dari: prev, ke: st, catatan: i === 0 ? 'Pesanan dibuat' : '', user_id: U.admin, at: at(ago(day), 9 + i) });
        prev = st;
      });
      return id;
    };
    const use = (wo: number, kode: string, qty: number, daysAgo: number) => {
      const m = one('SELECT * FROM materials WHERE id=?', M[kode]);
      const mv = insert('stock_movements', { material_id: m.id, tipe: 'keluar', qty: -qty, harga: m.harga_beli, wo_id: wo, alasan: 'Pemakaian pesanan', user_id: U.teknisi, tanggal: ago(daysAgo), at: at(ago(daysAgo), 14) });
      insert('material_usage', { wo_id: wo, material_id: m.id, qty, harga_satuan: m.harga_beli, movement_id: mv, user_id: U.teknisi, tanggal: ago(daysAgo) });
      run('UPDATE materials SET stok=stok-? WHERE id=?', qty, m.id);
    };
    let invSeq = 0, paySeq = 0;
    const inv = (wo: number, daysAgo: number) => {
      invSeq++;
      const total = one('SELECT COALESCE(SUM(qty*harga),0) t FROM work_order_items WHERE wo_id=?', wo).t - (one('SELECT diskon FROM work_orders WHERE id=?', wo).diskon || 0);
      return insert('invoices', { nomor: `INV-${year}-${String(invSeq).padStart(4, '0')}`, wo_id: wo, tanggal: ago(daysAgo), jatuh_tempo: addDays(ago(daysAgo), 7), total, status: 'Belum lunas', created_by: U.keuangan, created_at: at(ago(daysAgo)) });
    };
    const pay = (wo: number, invId: number | null, jenis: string, jumlah: number, daysAgo: number, metode = 'Transfer bank') => {
      paySeq++;
      insert('payments', { nomor: `KWT-${year}-${String(paySeq).padStart(4, '0')}`, wo_id: wo, invoice_id: invId, tanggal: ago(daysAgo), jenis, jumlah, metode, cash_account_id: metode === 'Tunai' ? kas : bank, user_id: U.keuangan, created_at: at(ago(daysAgo), 11) });
    };
    const FULL = ['Konsultasi', 'Penawaran', 'Menunggu persetujuan', 'Menunggu uang muka', 'Menunggu bahan', 'Siap dikerjakan', 'Sedang dikerjakan', 'Pemeriksaan kualitas', 'Siap diserahkan', 'Selesai'];

    // 1. Selesai bulan lalu & lunas
    const w1 = mkWO({ ci: 3, vi: 3, jenis: 'Restorasi interior klasik', masuk: 40, target: 14, status: 'Selesai', selesai: 27, teknisi: U.teknisi, tk: 3500000, ops: 750000, flow: FULL,
      items: [['jasa', 'Restorasi jok depan & belakang (bongkar pasang)', 1, 'paket', 9500000], ['barang', 'Kulit asli warna krem', 12, 'meter', 650000], ['jasa', 'Restorasi doortrim 4 pintu', 1, 'paket', 3500000]] });
    use(w1, 'B002', 12, 36); use(w1, 'B003', 4, 36); use(w1, 'B004', 3, 35);
    const i1 = inv(w1, 28); pay(w1, null, 'DP', 10000000, 39); pay(w1, i1, 'Pelunasan', 10800000, 27);
    // 2. Selesai bulan ini, sebagian dibayar (piutang)
    const w2 = mkWO({ ci: 2, vi: 2, jenis: 'Retrim jok sintetis', masuk: 18, target: 7, status: 'Selesai', selesai: 8, teknisi: U.teknisi2, tk: 2000000, ops: 400000, flow: FULL,
      items: [['jasa', 'Retrim 15 kursi penumpang', 15, 'kursi', 450000], ['barang', 'Kulit sintetis premium abu', 30, 'meter', 120000], ['barang', 'Karpet dasar HiAce', 10, 'meter', 150000]] });
    use(w2, 'B001', 30, 15); use(w2, 'B005', 10, 14); use(w2, 'B004', 5, 15);
    const i2 = inv(w2, 8); pay(w2, null, 'DP', 5000000, 17); pay(w2, i2, 'Pembayaran tahap', 3000000, 4);
    // 3. Sedang dikerjakan (contoh rancangan)
    const w3 = mkWO({ ci: 0, vi: 0, jenis: 'Retrim jok kulit', masuk: 6, target: 4, status: 'Sedang dikerjakan', teknisi: U.teknisi, tk: 2000000, ops: 1000000, flow: FULL.slice(0, 7),
      items: [['jasa', 'Retrim jok kulit 3 baris', 1, 'paket', 9600000], ['barang', 'Kulit premium hitam', 8, 'meter', 900000], ['barang', 'Busa jok kepadatan tinggi', 4, 'lembar', 300000]] });
    use(w3, 'B002', 8, 4); use(w3, 'B003', 4, 4);
    pay(w3, null, 'DP', 9000000, 6, 'Tunai');
    insert('work_progress', { wo_id: w3, user_id: U.teknisi, catatan: 'Bongkar jok selesai, pola kulit sudah dipotong.', persen: 30, at: at(ago(4), 15) });
    insert('work_progress', { wo_id: w3, user_id: U.teknisi, catatan: 'Penjahitan baris 1 & 2 selesai.', persen: 60, at: at(ago(2), 16) });
    // 4. Pemeriksaan kualitas
    const w4 = mkWO({ ci: 1, vi: 1, jenis: 'Ganti plafon', masuk: 4, target: 3, status: 'Pemeriksaan kualitas', teknisi: U.teknisi2, tk: 600000, ops: 150000, flow: FULL.slice(0, 8),
      items: [['jasa', 'Ganti plafon full', 1, 'paket', 1800000], ['barang', 'Kain plafon suede', 6, 'meter', 110000], ['barang', 'Lem kuning', 1, 'kaleng', 90000]] });
    use(w4, 'B007', 6, 3); use(w4, 'B006', 1, 3);
    pay(w4, null, 'DP', 1300000, 4);
    insert('work_progress', { wo_id: w4, user_id: U.teknisi2, catatan: 'Plafon terpasang, menunggu QC.', persen: 95, at: at(ago(1), 15) });
    // 5. Menunggu bahan
    const w5 = mkWO({ ci: 4, vi: 4, jenis: 'Retrim jok kulit', masuk: 3, target: 7, status: 'Menunggu bahan', teknisi: U.teknisi, flow: FULL.slice(0, 5),
      items: [['jasa', 'Upgrade jok kulit asli 3 baris', 1, 'paket', 8500000], ['barang', 'Kulit asli cokelat', 10, 'meter', 750000]] });
    pay(w5, null, 'DP', 8000000, 2);
    // 6. Penawaran
    mkWO({ ci: 5, vi: 5, jenis: 'Cover setir', masuk: 1, target: 2, status: 'Penawaran', flow: FULL.slice(0, 2),
      items: [['jasa', 'Jahit cover setir kulit', 1, 'pcs', 450000], ['jasa', 'Pasang karpet dasar', 1, 'paket', 1200000], ['barang', 'Karpet mobil', 4, 'meter', 150000]] });
    // 7. Konsultasi
    mkWO({ ci: 0, vi: 6, jenis: 'Doortrim', masuk: 0, target: 5, status: 'Konsultasi', flow: FULL.slice(0, 1), items: [['jasa', 'Perbaikan doortrim 4 pintu (estimasi)', 1, 'paket', 2400000]] });

    // stok masuk (pembelian) bulan ini
    const buy = (kode: string, qty: number, daysAgo: number) => {
      const m = one('SELECT * FROM materials WHERE id=?', M[kode]);
      insert('stock_movements', { material_id: m.id, tipe: 'masuk', qty, harga: m.harga_beli, alasan: 'Pembelian dari pemasok', user_id: U.gudang, tanggal: ago(daysAgo), at: at(ago(daysAgo), 10) });
      run('UPDATE materials SET stok=stok+? WHERE id=?', qty, m.id);
      insert('expenses', { tanggal: ago(daysAgo), kategori: 'Pembelian bahan', deskripsi: `Pembelian ${m.nama} ${qty} ${m.satuan}`, jumlah: qty * m.harga_beli, cash_account_id: bank, user_id: U.keuangan, created_at: at(ago(daysAgo)) });
    };
    buy('B001', 20, 10); buy('B002', 10, 5); buy('B005', 5, 9);
    const adj = insert('stock_movements', { material_id: M.B004, tipe: 'penyesuaian', qty: -2, harga: 25000, alasan: 'Stock opname: 2 gulung rusak', user_id: U.gudang, tanggal: ago(3), at: at(ago(3)) });
    run('UPDATE materials SET stok=stok-2 WHERE id=?', M.B004); void adj;

    const exp: [number, string, string, number, number | null][] = [
      [30, 'Tenaga kerja', 'Upah borongan teknisi (bulan lalu)', 3500000, w1], [28, 'Sewa tempat', 'Sewa workshop bulan lalu', 4000000, null], [29, 'Listrik & air', 'Tagihan listrik bulan lalu', 1100000, null],
      [9, 'Tenaga kerja', 'Upah borongan retrim HiAce', 2000000, w2], [2, 'Tenaga kerja', 'Upah mingguan teknisi', 1500000, null], [1, 'Sewa tempat', 'Sewa workshop bulan ini', 4000000, null],
      [7, 'Listrik & air', 'Tagihan listrik & air', 1250000, null], [6, 'Transportasi', 'Ongkir bahan & BBM', 350000, null], [11, 'Peralatan', 'Mata gunting & jarum mesin jahit', 480000, null],
      [3, 'Operasional lain', 'Konsumsi & kebersihan', 300000, null],
    ];
    for (const [days, kategori, deskripsi, jumlah, wo] of exp) insert('expenses', { tanggal: ago(days), kategori, deskripsi, jumlah, wo_id: wo, cash_account_id: days % 2 ? kas : bank, user_id: U.keuangan, created_at: at(ago(days)) });

    // status invoice
    for (const r of d.prepare('SELECT id FROM invoices').all() as any[]) {
      const i = one('SELECT * FROM invoices WHERE id=?', r.id);
      const paid = one('SELECT COALESCE(SUM(jumlah),0) p FROM payments WHERE wo_id=?', i.wo_id).p;
      run('UPDATE invoices SET status=? WHERE id=?', paid >= i.total ? 'Lunas' : paid > 0 ? 'Sebagian' : 'Belum lunas', i.id);
    }
    insert('audit_logs', { username: 'system', aksi: 'SEED', entitas: 'database', detail: 'Data demo dibuat', at: nowStr() });
  })();
}
