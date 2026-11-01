'use server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requirePerm, requireUser, audit } from '@/lib/auth';
import { insert, update, one, run, tx } from '@/lib/db';
import { BRANCH_COOKIE, canSwitchBranch, branchUsage } from '@/lib/branch';
import { s, nowStr, withMsg, safePath } from '@/lib/util';

/** Ganti cabang aktif (hanya pengguna tanpa cabang tetap). Disimpan di cookie = pilihan terakhir. */
export async function switchBranch(fd: FormData) {
  const u = requireUser();
  const id = Number(fd.get('branch_id') || 0);
  // halaman detail (mis. /pesanan/12) milik cabang lama → kembali ke daftar modul
  const seg = safePath(s(fd, 'back') || '/dashboard').split('?')[0].split('/').filter(Boolean)[0] || 'dashboard';
  const back = '/' + seg;
  if (!canSwitchBranch(u)) redirect(withMsg(back, 'err', 'Akun Anda terkunci pada satu cabang.'));
  const b = one('SELECT * FROM branches WHERE id=? AND aktif=1', id);
  if (!b) redirect(withMsg(back, 'err', 'Cabang tidak ditemukan atau nonaktif.'));
  cookies().set(BRANCH_COOKIE, String(b.id), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365, secure: process.env.COOKIE_SECURE === '1' });
  revalidatePath('/', 'layout');
  redirect(withMsg(back, 'ok', `Cabang aktif: ${b.nama}.`));
}

const KODE_RE = /^[A-Z0-9-]{2,10}$/;
function readForm(fd: FormData) {
  return { kode: s(fd, 'kode').toUpperCase(), nama: s(fd, 'nama'), kota: s(fd, 'kota'), alamat: s(fd, 'alamat'), telepon: s(fd, 'telepon') };
}

/** Tambah / ubah cabang. Cabang baru otomatis mendapat akun "Kas Tunai" (saldo awal 0). */
export async function saveBranch(fd: FormData) {
  const u = requirePerm('cabang.kelola');
  const id = Number(fd.get('id') || 0);
  const back = id ? `/cabang?edit=${id}` : '/cabang';
  const d = readForm(fd);
  if (!KODE_RE.test(d.kode)) redirect(withMsg(back, 'err', 'Kode cabang 2–10 karakter: huruf besar, angka, atau tanda minus (mis. BKS, JKT, TGR).'));
  if (!d.nama) redirect(withMsg(back, 'err', 'Nama cabang wajib diisi.'));
  if (one('SELECT id FROM branches WHERE kode=? AND id!=?', d.kode, id)) redirect(withMsg(back, 'err', `Kode ${d.kode} sudah dipakai cabang lain.`));
  if (one('SELECT id FROM branches WHERE LOWER(nama)=LOWER(?) AND id!=?', d.nama, id)) redirect(withMsg(back, 'err', `Nama cabang "${d.nama}" sudah ada.`));
  if (id) {
    if (!one('SELECT id FROM branches WHERE id=?', id)) redirect(withMsg('/cabang', 'err', 'Cabang tidak ditemukan.'));
    update('branches', id, d);
    audit(u, 'UBAH', 'branches', id, `${d.kode} ${d.nama}`);
    redirect(withMsg('/cabang', 'ok', `Cabang ${d.nama} disimpan.`));
  }
  const nid = tx(() => {
    const nid = insert('branches', { ...d, aktif: 1, created_at: nowStr() });
    insert('cash_accounts', { nama: 'Kas Tunai', jenis: 'kas', saldo_awal: 0, aktif: 1, branch_id: nid });
    return nid;
  });
  audit(u, 'TAMBAH', 'branches', nid, `${d.kode} ${d.nama} (+ Kas Tunai)`);
  redirect(withMsg('/cabang', 'ok', `Cabang ${d.nama} ditambahkan beserta akun Kas Tunai (saldo 0).`, `&hl=${nid}`));
}

/** Aktifkan / nonaktifkan cabang. Cabang nonaktif tidak muncul di pemilih cabang; datanya tetap tersimpan. */
export async function toggleBranch(fd: FormData) {
  const u = requirePerm('cabang.kelola');
  const id = Number(fd.get('id'));
  const b = one('SELECT * FROM branches WHERE id=?', id);
  if (!b) redirect(withMsg('/cabang', 'err', 'Cabang tidak ditemukan.'));
  if (b.aktif && one('SELECT COUNT(*) n FROM branches WHERE aktif=1').n <= 1) redirect(withMsg('/cabang', 'err', 'Minimal harus ada satu cabang aktif.'));
  run('UPDATE branches SET aktif=? WHERE id=?', b.aktif ? 0 : 1, id);
  audit(u, b.aktif ? 'NONAKTIF' : 'AKTIFKAN', 'branches', id, b.nama);
  redirect(withMsg('/cabang', 'ok', `Cabang ${b.nama} ${b.aktif ? 'dinonaktifkan' : 'diaktifkan'}.`));
}

/** Hapus permanen cabang — hanya bila belum punya data apa pun. Selain itu sarankan nonaktifkan. */
export async function deleteBranch(fd: FormData) {
  const u = requirePerm('cabang.kelola');
  const id = Number(fd.get('id'));
  const b = one('SELECT * FROM branches WHERE id=?', id);
  if (!b) redirect(withMsg('/cabang', 'err', 'Cabang tidak ditemukan.'));
  if (one('SELECT COUNT(*) n FROM branches').n <= 1) redirect(withMsg('/cabang', 'err', 'Cabang terakhir tidak dapat dihapus.'));
  if (b.aktif && one('SELECT COUNT(*) n FROM branches WHERE aktif=1').n <= 1) redirect(withMsg('/cabang', 'err', 'Cabang aktif terakhir tidak dapat dihapus.'));
  const us = branchUsage(id);
  const LBL: Record<string, string> = { pelanggan: 'pelanggan', pesanan: 'pesanan', bahan: 'bahan', mutasi: 'mutasi stok', invoice: 'invoice', pembayaran: 'pembayaran', pengeluaran: 'pengeluaran', kas: 'akun kas/bank terisi', pengguna: 'pengguna' };
  const used = Object.entries(us).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${LBL[k]}`);
  if (used.length) redirect(withMsg('/cabang', 'err', `Cabang ${b.nama} tidak dapat dihapus karena masih memiliki data: ${used.join(', ')}. Gunakan tombol "Nonaktifkan" agar cabang tidak dipakai lagi tanpa menghilangkan riwayatnya${us.pengguna ? ', atau pindahkan pengguna ke cabang lain terlebih dahulu' : ''}.`));
  tx(() => {
    run('DELETE FROM cash_accounts WHERE branch_id=?', id); // hanya Kas Tunai kosong bawaan
    run('DELETE FROM branches WHERE id=?', id);
  });
  if (cookies().get(BRANCH_COOKIE)?.value === String(id)) cookies().delete(BRANCH_COOKIE);
  audit(u, 'HAPUS', 'branches', id, `${b.kode} ${b.nama}`);
  redirect(withMsg('/cabang', 'ok', `Cabang ${b.nama} dihapus.`));
}
