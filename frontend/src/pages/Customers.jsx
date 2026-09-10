import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, money, formatApiErrorDetail } from "../lib/api";
import { Plus, Trash2, Edit2, Search } from "lucide-react";

export default function Customers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const { data: customers=[] } = useQuery({ queryKey:["customers"], queryFn: async () => (await api.get("/customers")).data });
  const shown = customers.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()) || (c.phone||"").includes(q));

  const save = async () => {
    try {
      if (form.id) await api.patch(`/customers/${form.id}`, {name:form.name,phone:form.phone||"",email:form.email||""});
      else await api.post("/customers", {name:form.name,phone:form.phone||"",email:form.email||""});
      toast.success("Saved"); qc.invalidateQueries(); setForm(null);
    } catch(e){toast.error(formatApiErrorDetail(e.response?.data?.detail));}
  };
  const del = async (c) => { if(!confirm(`Delete ${c.name}?`))return; await api.delete(`/customers/${c.id}`); qc.invalidateQueries(); };

  return (
    <div className="space-y-5" data-testid="customers-page">
      <div className="flex justify-between items-start"><div><h1 className="font-display text-2xl font-bold">Customers</h1><p className="text-sm text-[#6B5A52]">CRM & loyalty tracking.</p></div>
        <button data-testid="customers-add-button" onClick={()=>setForm({name:"",phone:"",email:""})} className="btn-coffee text-sm inline-flex items-center gap-2"><Plus className="w-4 h-4"/> Add Customer</button>
      </div>
      <div className="relative max-w-sm"><Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9C8A80]"/><input data-testid="customers-search-input" value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search name or phone…" className="input pl-10"/></div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F5ECE1] text-xs uppercase text-[#6B5A52]"><tr>
            <th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Phone</th><th className="text-left px-4 py-3">Email</th><th className="text-right px-4 py-3">Orders</th><th className="text-right px-4 py-3">Spend</th><th className="text-left px-4 py-3">Last</th><th></th>
          </tr></thead>
          <tbody>
            {shown.length===0 ? <tr><td colSpan={7} className="text-center py-16 text-[#9C8A80]">No customers</td></tr> :
              shown.map(c => (
                <tr key={c.id} className="border-t border-[#F2E8DC]">
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3 tabular text-[#6B5A52]">{c.phone||"—"}</td>
                  <td className="px-4 py-3 text-[#6B5A52]">{c.email||"—"}</td>
                  <td className="px-4 py-3 text-right tabular">{c.total_orders||0}</td>
                  <td className="px-4 py-3 text-right tabular">{money(c.total_spend||0)}</td>
                  <td className="px-4 py-3 text-[#9C8A80] text-xs tabular">{c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 flex justify-end gap-1"><button onClick={()=>setForm(c)} className="p-1.5 rounded-md"><Edit2 className="w-3.5 h-3.5"/></button><button onClick={()=>del(c)} className="p-1.5 rounded-md text-[#B91C1C]"><Trash2 className="w-3.5 h-3.5"/></button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {form && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setForm(null)}>
        <div className="card p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
          <h3 className="font-display font-bold text-lg mb-4">{form.id?"Edit":"Add"} customer</h3>
          <div className="space-y-2">
            <input data-testid="customers-name-input" placeholder="Name" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="input"/>
            <input data-testid="customers-phone-input" placeholder="Phone" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} className="input tabular"/>
            <input placeholder="Email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} className="input"/>
          </div>
          <div className="flex gap-2 mt-5"><button onClick={()=>setForm(null)} className="flex-1 px-4 py-2 rounded-lg border border-[#E8DCCF]">Cancel</button><button data-testid="customers-save-button" onClick={save} className="flex-1 btn-coffee text-sm">Save</button></div>
        </div>
      </div>}
    </div>
  );
}
