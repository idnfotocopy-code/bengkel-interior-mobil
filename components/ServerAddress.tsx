'use client';
import { useEffect, useState } from 'react';
/** Menampilkan alamat server (window.location.origin) agar bisa diketik di aplikasi Android. */
export default function ServerAddress() {
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  if (!origin) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(origin); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  return (
    <div className="mt-2 text-xs text-slate-600">
      Alamat server (isi di aplikasi):
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 break-all rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-brand-900">{origin}</code>
        <button type="button" onClick={copy} className="shrink-0 rounded border border-slate-300 px-2 py-1 text-[11px] hover:bg-slate-50">{copied ? 'Tersalin ✓' : 'Salin'}</button>
      </div>
    </div>);
}
