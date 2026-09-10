import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Settings as SettingsIcon, Save } from "lucide-react";

export default function Settings() {
  const { cafe, user, refresh } = useAuth();
  const [form, setForm] = useState({ name:"", address:"", phone:"", gstin:"", tax_rate: 5 });
  useEffect(()=>{ if(cafe) setForm({ name:cafe.name||"", address:cafe.address||"", phone:cafe.phone||"", gstin:cafe.gstin||"", tax_rate:cafe.tax_rate??5 }); },[cafe]);

  const canEdit = ["owner","manager"].includes(user?.role);

  const save = async () => {
    try { await api.patch("/cafe", { ...form, tax_rate: +form.tax_rate }); toast.success("Settings saved"); await refresh(); }
    catch(e){ toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-5 max-w-3xl" data-testid="settings-page">
      <div><h1 className="font-display text-2xl font-bold flex items-center gap-2"><SettingsIcon className="w-6 h-6 text-[#3D271D]"/> Settings</h1><p className="text-sm text-[#6B5A52]">Café profile & preferences.</p></div>
      <div className="card p-6">
        <h3 className="font-display font-semibold text-lg mb-4">Business Profile</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label="Café name"><input data-testid="settings-cafe-name-input" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="input" disabled={!canEdit}/></F>
          <F label="Phone"><input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} className="input tabular" disabled={!canEdit}/></F>
          <div className="sm:col-span-2"><F label="Address"><textarea rows={2} value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})} className="input" disabled={!canEdit}/></F></div>
          <F label="GSTIN"><input value={form.gstin} onChange={(e)=>setForm({...form,gstin:e.target.value})} className="input tabular" disabled={!canEdit}/></F>
          <F label="Default Tax Rate (%)"><input type="number" step="0.5" value={form.tax_rate} onChange={(e)=>setForm({...form,tax_rate:e.target.value})} className="input tabular" disabled={!canEdit}/></F>
        </div>
        {canEdit && <button data-testid="settings-save-button" onClick={save} className="btn-coffee text-sm inline-flex items-center gap-2 mt-5"><Save className="w-4 h-4"/> Save Changes</button>}
      </div>
      <div className="card p-6">
        <h3 className="font-display font-semibold text-lg mb-3">Account</h3>
        <div className="text-sm text-[#6B5A52] space-y-1"><div><b className="text-[#2D221E]">{user?.name}</b> · {user?.email}</div><div>Role: <span className="capitalize">{user?.role?.replace("_"," ")}</span></div></div>
      </div>
    </div>
  );
}
const F = ({label,children}) => <label className="block"><div className="text-xs font-semibold text-[#6B5A52] mb-1.5 uppercase tracking-wide">{label}</div>{children}</label>;
