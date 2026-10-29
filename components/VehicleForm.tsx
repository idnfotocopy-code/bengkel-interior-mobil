import { Field } from './ui';
export function VehicleForm({ v, customers, disabled, customerId }: { v?: any; customers: any[]; disabled?: boolean; customerId?: number }) {
  return (<>
    <Field label="Pemilik (pelanggan) *"><select name="customer_id" className="input" required defaultValue={v?.customer_id || customerId || ''} disabled={disabled}>
      <option value="">— pilih —</option>{customers.map((c: any) => <option key={c.id} value={c.id}>{c.kode} · {c.nama}</option>)}</select></Field>
    <div className="grid grid-cols-2 gap-3">
      <Field label="Nomor polisi *"><input name="nopol" className="input uppercase" required defaultValue={v?.nopol} disabled={disabled} placeholder="B 1234 ABC" /></Field>
      <Field label="Tahun"><input name="tahun" type="number" className="input" defaultValue={v?.tahun} disabled={disabled} /></Field>
      <Field label="Merek"><input name="merek" className="input" defaultValue={v?.merek} disabled={disabled} /></Field>
      <Field label="Tipe"><input name="tipe" className="input" defaultValue={v?.tipe} disabled={disabled} /></Field>
      <Field label="Warna"><input name="warna" className="input" defaultValue={v?.warna} disabled={disabled} /></Field>
      <Field label="No. rangka (opsional)"><input name="no_rangka" className="input" defaultValue={v?.no_rangka} disabled={disabled} /></Field>
    </div>
    <Field label="Catatan kondisi interior saat diterima"><textarea name="kondisi" className="input" rows={3} defaultValue={v?.kondisi} disabled={disabled} /></Field>
    {!disabled && <Field label="Foto kondisi (opsional, PNG/JPG maks 4 MB)"><input type="file" name="foto" accept="image/png,image/jpeg,image/webp" className="input" /></Field>}
  </>);
}
