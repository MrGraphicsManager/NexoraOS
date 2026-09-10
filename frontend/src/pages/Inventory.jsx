import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, money, formatApiErrorDetail } from "../lib/api";
import { Plus, Trash2, Edit2, AlertTriangle, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

export default function Inventory() {
  const qc = useQueryClient();
  const { data: items=[] } = useQuery({ queryKey:["inventory"], queryFn: async () => (await api.get("/inventory")).data });
  const [form, setForm] = useState(null);
  const [txn, setTxn] = useState(null);

  const save = async () => {
    try {
      const body = { name: form.name, category: form.category||"General", unit: form.unit||"kg",
        current_stock: +form.current_stock||0, min_stock: +form.min_stock||0, cost: +form.cost||0, supplier: form.supplier||"" };
      if (form.id) await api.patch(`/inventory/${form.id}`, body); else await api.post("/inventory", body);
      toast.success("Saved"); qc.invalidateQueries(); setForm(null);
    } catch(e){toast.error(formatApiErrorDetail(e.response?.data?.detail));}
  };
  const del = async (i) => { if(!confirm(`Delete ${i.name}?`))return; await api.delete(`/inventory/${i.id}`); qc.invalidateQueries(); };
  const doTxn = async () => {
    try { await api.post("/inventory/stock", { item_id: txn.item_id, qty: +txn.qty, type: txn.type, note: txn.note||"" });
      toast.success("Stock updated"); qc.invalidateQueries(); setTxn(null);
    } catch(e){toast.error(formatApiErrorDetail(e.response?.data?.detail));}
  };

  return (
    <div className="space-y-5" data-testid="inventory-page">
      <div className="flex justify-between items-start">
        <div><h1 className="font-display text-2xl font-bold">Inventory</h1><p className="text-sm text-[#6B5A52]">Ingredients and consumables.</p></div>
        <button data-testid="inventory-add-button" onClick={()=>setForm({name:"",category:"",unit:"kg",current_stock:0,min_stock:0,cost:0,supplier:""})} className="btn-coffee text-sm inline-flex items-center gap-2"><Plus className="w-4 h-4"/> Add Item</button>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollable">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-[#F5ECE1] text-xs uppercase text-[#6B5A52]">
            <tr><th className="text-left px-4 py-3">Item</th><th className="text-left px-4 py-3">Category</th><th className="text-right px-4 py-3">Stock</th><th className="text-right px-4 py-3">Min</th><th className="text-right px-4 py-3">Cost</th><th className="text-left px-4 py-3">Supplier</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {items.length===0 ? <tr><td colSpan={7} className="text-center py-16 text-[#9C8A80]">No inventory items yet</td></tr> :
              items.map(i => {
                const low = i.current_stock <= i.min_stock;
                return (
                  <tr key={i.id} className={`border-t border-[#F2E8DC] ${low?"bg-[#FEF2F2]/40":""}`}>
                    <td className="px-4 py-3 font-semibold flex items-center gap-2">{low && <AlertTriangle className="w-4 h-4 text-[#B91C1C]"/>} {i.name}</td>
                    <td className="px-4 py-3 text-[#6B5A52]">{i.category}</td>
                    <td className={`px-4 py-3 text-right tabular font-semibold ${low?"text-[#B91C1C]":""}`}>{i.current_stock} {i.unit}</td>
                    <td className="px-4 py-3 text-right tabular text-[#9C8A80]">{i.min_stock} {i.unit}</td>
                    <td className="px-4 py-3 text-right tabular">{money(i.cost)}</td>
                    <td className="px-4 py-3 text-[#6B5A52]">{i.supplier||"—"}</td>
                    <td className="px-4 py-3 text-right flex justify-end gap-1">
                      <button onClick={()=>setTxn({item_id:i.id,type:"in",qty:0,note:"",name:i.name,unit:i.unit})} data-testid={`inventory-stock-${i.id}`} className="p-1.5 rounded-md text-[#047857]" title="Stock In/Out"><ArrowUpCircle className="w-4 h-4"/></button>
                      <button onClick={()=>setForm(i)} className="p-1.5 rounded-md hover:bg-[#F5ECE1]"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>del(i)} className="p-1.5 rounded-md text-[#B91C1C]"><Trash2 className="w-3.5 h-3.5"/></button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        </div>
      </div>

      {form && <Modal onClose={()=>setForm(null)}>
        <h3 className="font-display font-bold text-lg mb-4">{form.id?"Edit item":"Add inventory item"}</h3>
        <div className="space-y-2">
          <input data-testid="inventory-name-input" placeholder="Name" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="input"/>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Category" value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} className="input"/>
            <input placeholder="Unit (kg, L, pcs)" value={form.unit} onChange={(e)=>setForm({...form,unit:e.target.value})} className="input"/>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" placeholder="Current" value={form.current_stock} onChange={(e)=>setForm({...form,current_stock:e.target.value})} className="input tabular"/>
            <input type="number" placeholder="Min" value={form.min_stock} onChange={(e)=>setForm({...form,min_stock:e.target.value})} className="input tabular"/>
            <input type="number" placeholder="Cost/unit" value={form.cost} onChange={(e)=>setForm({...form,cost:e.target.value})} className="input tabular"/>
          </div>
          <input placeholder="Supplier" value={form.supplier} onChange={(e)=>setForm({...form,supplier:e.target.value})} className="input"/>
        </div>
        <div className="flex gap-2 mt-5"><button onClick={()=>setForm(null)} className="flex-1 px-4 py-2 rounded-lg border border-[#E8DCCF]">Cancel</button><button data-testid="inventory-save-button" onClick={save} className="flex-1 btn-coffee text-sm">Save</button></div>
      </Modal>}
      {txn && <Modal onClose={()=>setTxn(null)}>
        <h3 className="font-display font-bold text-lg mb-4">Stock transaction · {txn.name}</h3>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {["in","out","adjust"].map(t=><button key={t} onClick={()=>setTxn({...txn,type:t})} className={`text-xs py-2 rounded-lg font-semibold uppercase ${txn.type===t?"bg-[#3D271D] text-[#FDFBF7]":"bg-[#F5ECE1]"}`}>{t}</button>)}
        </div>
        <input type="number" placeholder={`Qty (${txn.unit})`} value={txn.qty} onChange={(e)=>setTxn({...txn,qty:e.target.value})} className="input tabular mb-2"/>
        <input placeholder="Note (optional)" value={txn.note} onChange={(e)=>setTxn({...txn,note:e.target.value})} className="input"/>
        <div className="flex gap-2 mt-5"><button onClick={()=>setTxn(null)} className="flex-1 px-4 py-2 rounded-lg border border-[#E8DCCF]">Cancel</button><button data-testid="inventory-txn-save-button" onClick={doTxn} className="flex-1 btn-coffee text-sm">Apply</button></div>
      </Modal>}
    </div>
  );
}
function Modal({children, onClose}){return(<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}><div className="card p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>{children}</div></div>);}
