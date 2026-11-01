'use client';
import { useMemo, useState } from 'react';

export type SSOption = { value: string | number; label: string; search?: string };
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Pilihan dengan kotak cari: ketik nama / kode untuk menyaring daftar (filter-as-you-type).
 * Tetap memakai <select> biasa sehingga form & validasi server tidak berubah.
 */
export function SearchSelect({ name, options, defaultValue, value, onChange, required, disabled, placeholder = '— pilih —', searchPlaceholder = 'Cari nama / kode…', className = '', minToSearch = 0 }: {
  name: string; options: SSOption[]; defaultValue?: string | number | null; value?: string | number | null; onChange?: (v: string) => void;
  required?: boolean; disabled?: boolean; placeholder?: string; searchPlaceholder?: string; className?: string; minToSearch?: number;
}) {
  const [q, setQ] = useState('');
  const [inner, setInner] = useState<string>(defaultValue != null ? String(defaultValue) : '');
  const cur = value !== undefined ? (value == null ? '' : String(value)) : inner;
  const set = (v: string) => { if (value === undefined) setInner(v); onChange?.(v); };
  const words = norm(q).split(' ').filter(Boolean);
  const list = useMemo(() => options.filter(o => { if (!words.length) return true; const hay = norm(o.label + ' ' + (o.search || '')); return words.every(w => hay.includes(w)); }), [options, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = options.find(o => String(o.value) === cur);
  const shown = selected && !list.includes(selected) ? [selected, ...list] : list;
  return (<div className={`space-y-1 ${className}`}>
    {!disabled && options.length > minToSearch && <div className="relative">
      <input type="search" value={q} placeholder={searchPlaceholder} className="input py-1 text-sm pr-16" aria-label="Cari"
        onChange={e => { const nq = e.target.value; setQ(nq); const ws = norm(nq).split(' ').filter(Boolean); const m = options.filter(o => ws.every(w => norm(o.label + ' ' + (o.search || '')).includes(w))); if (ws.length && m.length === 1) set(String(m[0].value)); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (list.length) set(String(list[0].value)); } }} />
      {q && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">{list.length} cocok</span>}
    </div>}
    <select name={name} className="input" required={required} disabled={disabled} value={cur} onChange={e => set(e.target.value)}>
      <option value="">{q && !list.length ? 'Tidak ada yang cocok' : placeholder}</option>
      {shown.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>);
}
