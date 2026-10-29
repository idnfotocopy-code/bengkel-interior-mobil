import { Card } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { listBackups, transaksiCounts, RESTORE_PHRASE, WIPE_PHRASE } from '@/lib/backup';
import { wipeTransaksiAction } from './actions';

const size = (b: number) => (b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const tgl = (d: Date) => d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

/** Bagian Backup / Restore / Hapus transaksi — hanya dirender untuk pemilik. */
export function DataSection({ canBackup, canRestore, canWipe }: { canBackup: boolean; canRestore: boolean; canWipe: boolean }) {
  const c = transaksiCounts();
  const backups = listBackups().slice(0, 10);
  return (<div id="data" className="mt-8 space-y-5 max-w-4xl scroll-mt-20">
    <div><h2 className="text-lg font-bold text-brand-900">🗄️ Data & keamanan database</h2>
      <p className="text-sm text-slate-500">Khusus pemilik. <b>Disarankan unduh backup sebelum restore atau hapus transaksi.</b></p></div>

    {canBackup && <Card title="💾 Backup database">
      <p className="text-sm text-slate-600 mb-3">Unduh salinan lengkap database (semua pengguna, pengaturan, pelanggan, kendaraan, pesanan, stok, keuangan) sebagai satu file <code>.db</code>. Simpan di flashdisk / Google Drive. Foto upload (folder <code>public/uploads</code>) tidak ikut di file ini.</p>
      <a href="/api/backup" className="btn btn-primary" download>⬇️ Backup sekarang</a>
      {backups.length > 0 && <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Backup otomatis (dibuat sebelum restore)</div>
        <ul className="text-sm divide-y border rounded-lg">{backups.map(b => <li key={b.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span className="font-mono text-xs">{b.name}</span><span className="text-xs text-slate-500">{tgl(b.mtime)} · {size(b.size)}</span>
          <a className="btn btn-sm" href={`/api/backup?file=${encodeURIComponent(b.name)}`} download>Unduh</a></li>)}</ul>
      </div>}
    </Card>}

    {canRestore && <div className="card border-amber-300"><div className="card-h bg-amber-50 text-amber-900"><span>♻️ Restore (pulihkan) database</span></div><div className="card-b">
      <ol className="text-sm text-slate-700 list-decimal pl-5 space-y-1 mb-3">
        <li>Pilih file backup <code>.db</code> yang pernah diunduh dari tombol <b>Backup sekarang</b> (maks 100 MB).</li>
        <li>Ketik <b>{RESTORE_PHRASE}</b> pada kotak konfirmasi, lalu klik <b>Restore database</b>.</li>
        <li>Database saat ini <b>diganti seluruhnya</b> dengan isi backup. Sebelumnya sistem otomatis menyimpan salinan ke <code>data/backups/pre-restore-…db</code> (bisa diunduh di atas).</li>
        <li>Semua pengguna akan keluar; login ulang memakai akun &amp; kata sandi yang ada di backup.</li>
      </ol>
      <form action="/api/restore" method="post" encType="multipart/form-data" className="space-y-3">
        <input type="file" name="file" accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3,application/octet-stream" required className="text-sm block" />
        <div><label className="label">Ketik {RESTORE_PHRASE} untuk konfirmasi</label><input name="konfirmasi" required autoComplete="off" placeholder={RESTORE_PHRASE} pattern={`${RESTORE_PHRASE}|${RESTORE_PHRASE.toLowerCase()}`} className="input max-w-xs" /></div>
        <ConfirmButton className="btn bg-amber-600 text-white hover:bg-amber-700" msg="Ganti SELURUH database saat ini dengan file backup ini? Data yang belum di-backup akan hilang (salinan otomatis tetap dibuat di data/backups). Semua pengguna akan logout.">♻️ Restore database</ConfirmButton>
      </form>
    </div></div>}

    {canWipe && <div className="card border-red-300"><div className="card-h bg-red-50 text-red-800"><span>🗑️ Hapus seluruh data transaksi</span></div><div className="card-b">
      <p className="text-sm text-slate-700 mb-3">Menghapus permanen semua data transaksi untuk memulai pembukuan dari nol (misalnya setelah masa uji coba). Tidak bisa dibatalkan kecuali dengan restore dari backup.</p>
      <div className="grid gap-2 sm:grid-cols-4 mb-3">{[['Pesanan', c.pesanan], ['Pembayaran', c.pembayaran], ['Invoice', c.invoice], ['Pengeluaran', c.pengeluaran], ['Mutasi stok', c.mutasi], ['Progres produksi', c.progres], ['Pemakaian bahan', c.pemakaian], ['Log aktivitas', c.log]].map(([l, v]) =>
        <div key={l as string} className="rounded-lg border border-red-200 bg-red-50/50 px-3 py-2"><div className="text-xs text-slate-500">{l}</div><div className="text-lg font-bold text-red-700 tabular-nums">{v}</div></div>)}</div>
      <div className="grid gap-3 sm:grid-cols-2 text-sm mb-3">
        <div><b className="text-red-700">Dihapus:</b> pesanan &amp; item, riwayat status, progres produksi, pemakaian bahan, mutasi stok, pembayaran, invoice, pengeluaran, log aktivitas, sesi login. Stok semua bahan di-nol-kan.</div>
        <div><b className="text-emerald-700">Tetap:</b> pengguna, pengaturan, pelanggan, kendaraan, pemasok, master bahan, akun kas/bank (saldo awal), jenis pekerjaan.</div>
      </div>
      <form action={wipeTransaksiAction} className="space-y-3">
        <div><label className="label">Ketik {WIPE_PHRASE} untuk konfirmasi</label><input name="konfirmasi" required autoComplete="off" placeholder={WIPE_PHRASE} className="input max-w-xs" /></div>
        <div className="flex flex-wrap gap-2"><a href="/api/backup" className="btn" download>⬇️ Backup dulu</a>
          <ConfirmButton className="btn bg-red-600 text-white hover:bg-red-700" msg={`Hapus PERMANEN ${c.pesanan} pesanan, ${c.pembayaran} pembayaran, ${c.invoice} invoice, ${c.pengeluaran} pengeluaran dan ${c.mutasi} mutasi stok? Pastikan sudah unduh backup. Semua pengguna akan logout.`}>🗑️ Hapus seluruh data transaksi</ConfirmButton></div>
      </form>
    </div></div>}
  </div>);
}
