import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, money, formatApiErrorDetail } from "../lib/api";
import { Plus, Trash2, Edit2, X } from "lucide-react";

export default function Menu() {
  const qc = useQueryClient();
  const { data: cats=[] } = useQuery({ queryKey:["categories"], queryFn: async () => (await api.get("/categories")).data });
  const { data: products=[] } = useQuery({ queryKey:["products"], queryFn: async () => (await api.get("/products")).data });
  const [catForm, setCatForm] = useState({open:false,name:""});
  const [prodForm, setProdForm] = useState(null);

  const addCat = async () => { try { await api.post("/categories", {name: catForm.name}); toast.success("Category added"); qc.invalidateQueries(); setCatForm({open:false,name:""}); } catch(e){toast.error(formatApiErrorDetail(e.response?.data?.detail));} };
  const delCat = async (c) => { if(!confirm(`Delete ${c.name}?`))return; await api.delete(`/categories/${c.id}`); toast.success("Deleted"); qc.invalidateQueries(); };
  const toggleAvail = async (p) => { await api.patch(`/products/${p.id}`, {...p, available: !p.available}); qc.invalidateQueries(); };
  const delProd = async (p) => { if(!confirm(`Delete ${p.name}?`))return; await api.delete(`/products/${p.id}`); toast.success("Deleted"); qc.invalidateQueries(); };

  const saveProd = async () => {
    try {
      const body = { name: prodForm.name, category_id: prodForm.category_id, description: prodForm.description || "",
        price: +prodForm.price, tax_rate: +prodForm.tax_rate || 5, sku: prodForm.sku || "",
        prep_time: +prodForm.prep_time || 5, available: prodForm.available !== false };
      if (prodForm.id) await api.patch(`/products/${prodForm.id}`, body);
      else await api.post("/products", body);
      toast.success("Saved"); qc.invalidateQueries(); setProdForm(null);
    } catch(e){toast.error(formatApiErrorDetail(e.response?.data?.detail));}
  };

  return (
    <div className="space-y-6" data-testid="menu-page">
      <div className="flex justify-between items-start">
        <div><h1 className="font-display text-2xl font-bold">Menu</h1><p className="text-sm text-[#6B5A52]">Manage categories and products.</p></div>
        <div className="flex gap-2">
          <button data-testid="menu-add-category-button" onClick={()=>setCatForm({open:true,name:""})} className="text-sm px-4 py-2.5 rounded-lg border border-[#E8DCCF] font-medium inline-flex items-center gap-2"><Plus className="w-4 h-4"/> Category</button>
          <button data-testid="menu-add-product-button" onClick={()=>setProdForm({name:"",category_id:cats[0]?.id||"",price:0,tax_rate:5,prep_time:5,available:true})} disabled={!cats.length} className="btn-coffee text-sm inline-flex items-center gap-2 disabled:opacity-50"><Plus className="w-4 h-4"/> Product</button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-display font-semibold text-base mb-3">Categories</h3>
        {cats.length===0 ? <div className="text-sm text-[#9C8A80] py-6 text-center">No categories yet.</div> :
          <div className="flex flex-wrap gap-2">
            {cats.map(c => (
              <div key={c.id} data-testid={`menu-category-${c.name}`} className="inline-flex items-center gap-2 bg-[#F5ECE1] rounded-full pl-3 pr-1.5 py-1.5">
                <span className="text-sm font-medium">{c.name}</span>
                <button onClick={()=>delCat(c)} className="w-5 h-5 rounded-full hover:bg-[#E8DCCF] flex items-center justify-center"><X className="w-3 h-3"/></button>
              </div>
            ))}
          </div>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F5ECE1] text-xs uppercase text-[#6B5A52]">
            <tr><th className="text-left px-4 py-3">Product</th><th className="text-left px-4 py-3">Category</th><th className="text-right px-4 py-3">Price</th><th className="text-right px-4 py-3">Prep</th><th className="text-left px-4 py-3">Available</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {products.length===0 ? <tr><td colSpan={6} className="text-center py-16 text-[#9C8A80]">No products yet</td></tr> :
              products.map(p => (
                <tr key={p.id} className="border-t border-[#F2E8DC]">
                  <td className="px-4 py-3 font-semibold">{p.name}</td>
                  <td className="px-4 py-3 text-[#6B5A52]">{cats.find(c=>c.id===p.category_id)?.name || "—"}</td>
                  <td className="px-4 py-3 text-right tabular">{money(p.price)}</td>
                  <td className="px-4 py-3 text-right tabular">{p.prep_time}m</td>
                  <td className="px-4 py-3"><button onClick={()=>toggleAvail(p)} data-testid={`menu-toggle-${p.id}`} className={`badge-status ${p.available!==false?"status-available":"status-cancelled"}`}>{p.available!==false?"Yes":"No"}</button></td>
                  <td className="px-4 py-3 text-right flex justify-end gap-1">
                    <button onClick={()=>setProdForm(p)} className="p-1.5 rounded-md hover:bg-[#F5ECE1]"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={()=>delProd(p)} className="p-1.5 rounded-md hover:bg-[#FEF2F2] text-[#B91C1C]"><Trash2 className="w-3.5 h-3.5"/></button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {catForm.open && <Modal onClose={()=>setCatForm({open:false,name:""})}>
        <h3 className="font-display font-bold text-lg mb-4">Add category</h3>
        <input data-testid="menu-category-name-input" autoFocus value={catForm.name} onChange={(e)=>setCatForm({...catForm,name:e.target.value})} placeholder="e.g. Coffee" className="input"/>
        <div className="flex gap-2 mt-5"><button onClick={()=>setCatForm({open:false,name:""})} className="flex-1 px-4 py-2 rounded-lg border border-[#E8DCCF]">Cancel</button><button data-testid="menu-category-save-button" onClick={addCat} className="flex-1 btn-coffee text-sm">Add</button></div>
      </Modal>}
      {prodForm && <Modal onClose={()=>setProdForm(null)}>
        <h3 className="font-display font-bold text-lg mb-4">{prodForm.id ? "Edit product" : "Add product"}</h3>
        <div className="space-y-3">
          <input data-testid="menu-product-name-input" placeholder="Name" value={prodForm.name} onChange={(e)=>setProdForm({...prodForm,name:e.target.value})} className="input"/>
          <select value={prodForm.category_id} onChange={(e)=>setProdForm({...prodForm,category_id:e.target.value})} className="input">
            {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <textarea placeholder="Description" value={prodForm.description||""} onChange={(e)=>setProdForm({...prodForm,description:e.target.value})} className="input" rows={2}/>
          <div className="grid grid-cols-3 gap-2">
            <input data-testid="menu-product-price-input" type="number" placeholder="Price" value={prodForm.price} onChange={(e)=>setProdForm({...prodForm,price:e.target.value})} className="input tabular"/>
            <input type="number" placeholder="Tax %" value={prodForm.tax_rate} onChange={(e)=>setProdForm({...prodForm,tax_rate:e.target.value})} className="input tabular"/>
            <input type="number" placeholder="Prep min" value={prodForm.prep_time} onChange={(e)=>setProdForm({...prodForm,prep_time:e.target.value})} className="input tabular"/>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prodForm.available!==false} onChange={(e)=>setProdForm({...prodForm,available:e.target.checked})}/> Available for sale</label>
        </div>
        <div className="flex gap-2 mt-5"><button onClick={()=>setProdForm(null)} className="flex-1 px-4 py-2 rounded-lg border border-[#E8DCCF]">Cancel</button><button data-testid="menu-product-save-button" onClick={saveProd} className="flex-1 btn-coffee text-sm">Save</button></div>
      </Modal>}
    </div>
  );
}

function Modal({children, onClose}){return(<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}><div className="card p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>{children}</div></div>);}
