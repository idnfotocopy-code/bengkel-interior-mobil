import Link from 'next/link';
import React from 'react';
import { STATUS_COLOR } from '@/lib/constants';

const COLORS: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-800', red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-800', sky: 'bg-sky-100 text-sky-800',
  violet: 'bg-violet-100 text-violet-800', orange: 'bg-orange-100 text-orange-800', slate: 'bg-slate-100 text-slate-700', teal: 'bg-teal-100 text-teal-800',
};
export function Badge({ color = 'slate', children }: { color?: string; children: React.ReactNode }) { return <span className={`badge ${COLORS[color] || COLORS.slate}`}>{children}</span>; }
export function StatusBadge({ status }: { status: string }) { return <Badge color={STATUS_COLOR[status] || 'slate'}>{status}</Badge>; }
export function InvBadge({ status }: { status: string }) { return <Badge color={status === 'Lunas' ? 'green' : status === 'Sebagian' ? 'amber' : status === 'Batal' ? 'slate' : 'red'}>{status}</Badge>; }
export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (<div className="flex flex-wrap items-end justify-between gap-3 mb-5">
    <div><h1 className="text-xl md:text-2xl font-bold text-brand-900">{title}</h1>{desc && <p className="text-sm text-slate-500 mt-1 max-w-3xl">{desc}</p>}</div>
    <div className="flex flex-wrap gap-2">{children}</div></div>);
}
export function Flash({ sp }: { sp: any }) {
  return (<>
    {sp?.ok && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✓ {sp.ok}</div>}
    {sp?.err && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">⚠ {sp.err}</div>}
  </>);
}
export function Stat({ label, value, sub, color = 'brand', href }: { label: string; value: React.ReactNode; sub?: string; color?: string; href?: string }) {
  const bar: Record<string, string> = { brand: 'bg-brand-500', accent: 'bg-accent-400', red: 'bg-red-500', sky: 'bg-sky-500', green: 'bg-emerald-500', violet: 'bg-violet-500', amber: 'bg-amber-500' };
  const inner = (<div className="card p-4 relative overflow-hidden h-full hover:shadow-md transition">
    <div className={`absolute left-0 top-0 h-full w-1.5 ${bar[color] || bar.brand}`} />
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    <div className="text-xl md:text-2xl font-bold text-brand-900 mt-1 tabular-nums">{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}</div>);
  return href ? <Link href={href}>{inner}</Link> : inner;
}
export function Card({ title, actions, children, className = '', pad = true }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (<div className={`card ${className}`}>{title && <div className="card-h"><span>{title}</span><div className="flex flex-wrap gap-2">{actions}</div></div>}<div className={pad ? 'card-b' : ''}>{children}</div></div>);
}
export function Empty({ children = 'Belum ada data.' }: { children?: React.ReactNode }) { return <div className="text-sm text-slate-400 italic py-6 text-center">{children}</div>; }
export function Tabs({ items, active }: { items: { key: string; label: string; href: string }[]; active: string }) {
  return <div className="flex flex-wrap gap-2 mb-4">{items.map(t => <Link key={t.key} href={t.href} className={`tab ${t.key === active ? 'tab-on' : 'tab-off'}`}>{t.label}</Link>)}</div>;
}
export function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) { return <div className={className}><label className="label">{label}</label>{children}</div>; }
export function TableWrap({ children }: { children: React.ReactNode }) { return <div className="overflow-x-auto">{children}</div>; }
export function PeriodFilter({ from, to, extra }: { from: string; to: string; extra?: React.ReactNode }) {
  return (<form className="flex flex-wrap items-end gap-2 mb-4">
    <Field label="Dari tanggal"><input type="date" name="from" defaultValue={from} className="input" /></Field>
    <Field label="Sampai tanggal"><input type="date" name="to" defaultValue={to} className="input" /></Field>
    {extra}
    <button className="btn btn-primary">Terapkan</button>
  </form>);
}
