'use client';
import { useState } from 'react';
export function VehiclePicker({ customers, vehicles, customerId, vehicleId }: { customers: { id: number; kode: string; nama: string }[]; vehicles: { id: number; customer_id: number; nopol: string; merek: string; tipe: string }[]; customerId?: number; vehicleId?: number }) {
  const [c, setC] = useState<number>(customerId || 0);
  const vs = vehicles.filter(v => v.customer_id === c);
  return (<>
    <div><label className="label">Pelanggan *</label>
      <select name="customer_id" className="input" required value={c || ''} onChange={e => setC(Number(e.target.value))}>
        <option value="">— pilih pelanggan —</option>
        {customers.map(x => <option key={x.id} value={x.id}>{x.kode} · {x.nama}</option>)}
      </select></div>
    <div><label className="label">Kendaraan *</label>
      <select name="vehicle_id" className="input" required defaultValue={vehicleId || ''} key={c}>
        <option value="">{c ? (vs.length ? '— pilih kendaraan —' : 'Pelanggan belum punya kendaraan') : 'Pilih pelanggan dulu'}</option>
        {vs.map(v => <option key={v.id} value={v.id}>{v.nopol} · {v.merek} {v.tipe}</option>)}
      </select></div>
  </>);
}
