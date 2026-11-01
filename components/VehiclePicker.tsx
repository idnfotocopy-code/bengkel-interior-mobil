'use client';
import { useState } from 'react';
import { SearchSelect } from './SearchSelect';
export function VehiclePicker({ customers, vehicles, customerId, vehicleId }: { customers: { id: number; kode: string; nama: string; telepon?: string }[]; vehicles: { id: number; customer_id: number; nopol: string; merek: string; tipe: string }[]; customerId?: number; vehicleId?: number }) {
  const [c, setC] = useState<number>(customerId || 0);
  const [v, setV] = useState<string>(vehicleId ? String(vehicleId) : '');
  const vs = vehicles.filter(x => x.customer_id === c);
  // nomor polisi ikut dicari di daftar pelanggan supaya bisa cari "B 1234" langsung
  const custOpts = customers.map(x => ({ value: x.id, label: `${x.kode} · ${x.nama}`, search: `${x.telepon || ''} ${vehicles.filter(y => y.customer_id === x.id).map(y => `${y.nopol} ${y.nopol.replace(/\s/g, '')} ${y.merek} ${y.tipe}`).join(' ')}` }));
  return (<>
    <div><label className="label">Pelanggan *</label>
      <SearchSelect name="customer_id" required options={custOpts} value={c || ''} placeholder="— pilih pelanggan —" searchPlaceholder="Cari nama / kode / telepon / nopol…"
        onChange={val => { const id = Number(val) || 0; setC(id); const own = vehicles.filter(x => x.customer_id === id); setV(own.length === 1 ? String(own[0].id) : ''); }} /></div>
    <div><label className="label">Kendaraan *</label>
      <SearchSelect name="vehicle_id" required minToSearch={3} value={v} onChange={setV} searchPlaceholder="Cari nopol / merek…"
        placeholder={c ? (vs.length ? '— pilih kendaraan —' : 'Pelanggan belum punya kendaraan') : 'Pilih pelanggan dulu'}
        options={vs.map(x => ({ value: x.id, label: `${x.nopol} · ${x.merek || ''} ${x.tipe || ''}`.trim(), search: x.nopol.replace(/\s/g, '') }))} /></div>
  </>);
}
