import { all } from './db';
import type { ItemSuggestion } from '@/components/ItemLineInputs';

/** Saran deskripsi item pesanan: jenis pekerjaan aktif, bahan aktif cabang, dan item yang pernah dipakai (harga terakhir). */
export function itemSuggestions(branchId: number | null): ItemSuggestion[] {
  const out = new Map<string, ItemSuggestion>();
  const add = (s: ItemSuggestion) => { const k = s.deskripsi.trim().toLowerCase(); if (k && !out.has(k)) out.set(k, s); };
  // item lama (terbaru dulu) — harga & satuan terakhir
  for (const r of all(`SELECT i.deskripsi, i.jenis, i.satuan, i.harga FROM work_order_items i JOIN work_orders w ON w.id=i.wo_id
    WHERE (? IS NULL OR w.branch_id=?) ORDER BY i.id DESC LIMIT 1500`, branchId, branchId) as any[]) add({ deskripsi: r.deskripsi, jenis: r.jenis, satuan: r.satuan, harga: r.harga, sumber: 'pernah dipakai' });
  for (const r of all('SELECT nama FROM job_types WHERE aktif=1 ORDER BY urutan, nama') as any[]) add({ deskripsi: r.nama, jenis: 'jasa', satuan: 'paket', harga: null, sumber: 'jenis pekerjaan' });
  for (const r of all('SELECT kode, nama, satuan FROM materials WHERE aktif=1 AND (? IS NULL OR branch_id=?) ORDER BY nama', branchId, branchId) as any[]) add({ deskripsi: r.nama, jenis: 'barang', satuan: r.satuan, harga: null, sumber: `bahan ${r.kode}` });
  return [...out.values()].slice(0, 800);
}
