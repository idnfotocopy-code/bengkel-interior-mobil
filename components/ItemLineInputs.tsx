'use client';
import { useId, useRef } from 'react';

export type ItemSuggestion = { deskripsi: string; jenis: string; satuan?: string | null; harga?: number | null; sumber: string };

/**
 * Input baris item pesanan (jasa/barang) dengan pencarian: ketik deskripsi → muncul saran dari
 * jenis pekerjaan, bahan persediaan, dan item yang pernah dipakai. Memilih saran mengisi jenis, satuan & harga terakhir.
 */
export function ItemLineInputs({ suggestions, prefix = '', layout = 'row' }: { suggestions: ItemSuggestion[]; prefix?: string; layout?: 'row' | 'grid' }) {
  const id = useId().replace(/:/g, '');
  const jenis = useRef<HTMLSelectElement>(null), satuan = useRef<HTMLInputElement>(null), harga = useRef<HTMLInputElement>(null);
  const pick = (val: string) => {
    const s = suggestions.find(x => x.deskripsi.toLowerCase() === val.trim().toLowerCase());
    if (!s) return;
    if (jenis.current) jenis.current.value = s.jenis === 'barang' ? 'barang' : 'jasa';
    if (satuan.current && s.satuan) satuan.current.value = s.satuan;
    if (harga.current && s.harga && !harga.current.value) harga.current.value = String(s.harga);
  };
  const n = (k: string) => prefix + k;
  const dl = <datalist id={`items-${id}`}>{suggestions.map((s, i) => <option key={i} value={s.deskripsi}>{`${s.sumber}${s.harga ? ' · Rp' + Number(s.harga).toLocaleString('id-ID') : ''}`}</option>)}</datalist>;
  const desc = <input name={n('deskripsi')} list={`items-${id}`} placeholder="Ketik untuk cari item / jasa / bahan…" autoComplete="off" className="input" required={!prefix} onChange={e => pick(e.target.value)} />;
  const jenisSel = <select ref={jenis} name={n('jenis')} className="input"><option value="jasa">Jasa</option><option value="barang">Barang</option></select>;
  const qty = <input name={n('qty')} type="number" step="0.01" defaultValue={1} className="input" />;
  const sat = <input ref={satuan} name={n('satuan')} defaultValue="paket" className="input" />;
  const hrg = <input ref={harga} name={n('harga')} type="number" step="any" min={0} placeholder="Harga" className="input" required={!prefix} />;
  if (layout === 'grid') return (<>
    <div><label className="label">Jenis</label>{jenisSel}</div>
    <div className="sm:col-span-2"><label className="label">Deskripsi (ketik untuk cari)</label>{desc}{dl}</div>
    <div><label className="label">Qty</label>{qty}</div>
    <div><label className="label">Satuan</label>{sat}</div>
    <div><label className="label">Harga satuan (Rp)</label>{hrg}</div>
  </>);
  return (<>
    <div className="sm:col-span-2">{jenisSel}</div>
    <div className="sm:col-span-4">{desc}{dl}</div>
    <div className="sm:col-span-1">{qty}</div>
    <div className="sm:col-span-2">{sat}</div>
    <div className="sm:col-span-2">{hrg}</div>
  </>);
}
