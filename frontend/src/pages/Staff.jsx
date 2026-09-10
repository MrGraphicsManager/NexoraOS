import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Plus, Trash2, Shield } from "lucide-react";

const ROLES = [
  { k: "owner", label: "Owner", desc: "Full access" },
  { k: "manager", label: "Manager", desc: "POS, Menu, Inventory, Reports, Staff" },
  { k: "cashier", label: "Cashier", desc: "POS, Orders, Tables, Customers" },
  { k: "kitchen_staff", label: "Kitchen Staff", desc: "Kitchen, Orders" },
];

export default function Staff() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: staff=[] } = useQuery({ queryKey:["staff"], queryFn: async () => (await api.get("/staff")).data });
  const [form, setForm] = useState(null);

  const save = async () => {
    try { await api.post("/staff", form); toast.success("Staff added"); qc.invalidateQueries(); setForm(null); }
    catch(e){ toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const del = async (s) => { if(!confirm(`Delete ${s.name}?`))return; try { await api.delete(`/staff/${s.id}`); qc.invalidateQueries(); } catch(e){ toast.error(formatApiErrorDetail(e.response?.data?.detail));} };

  return (
    <div className="space-y-5" data-testid="staff-page">
      <div className="flex justify-between items-start">
        <div><h1 className="font-display text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-[#3D271D]"/> Staff & Roles</h1><p className="text-sm text-[#6B5A52]">Team members and permissions.</p></div>
        {user?.role==="owner" && <button data-testid="staff-add-button" onClick={()=>setForm({name:"",email:"",password:"",role:"cashier"})} className="btn-coffee text-sm inline-flex items-center gap-2"><Plus className="w-4 h-4"/> Add Staff</button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {ROLES.map(r => <div key={r.k} className="card p-4"><div className="font-display font-semibold">{r.label}</div><div className="text-xs text-[#9C8A80] mt-1 leading-relaxed">{r.desc}</div><div className="text-xs mt-2 tabular text-[#6B5A52]">{staff.filter(s=>s.role===r.k).length} member{staff.filter(s=>s.role===r.k).length!==1?"s":""}</div></div>)}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F5ECE1] text-xs uppercase text-[#6B5A52]"><tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Email</th><th className="text-left px-4 py-3">Role</th><th></th></tr></thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.id} className="border-t border-[#F2E8DC]">
                <td className="px-4 py-3 font-semibold">{s.name} {s.id===user?.id && <span className="text-[10px] text-[#9C8A80] font-normal">(you)</span>}</td>
                <td className="px-4 py-3 text-[#6B5A52]">{s.email}</td>
                <td className="px-4 py-3"><span className="badge-status status-preparing">{s.role.replace("_"," ")}</span></td>
                <td className="px-4 py-3 text-right">{user?.role==="owner" && s.role!=="owner" && <button onClick={()=>del(s)} className="p-1.5 rounded-md text-[#B91C1C]"><Trash2 className="w-3.5 h-3.5"/></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setForm(null)}>
        <div className="card p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
          <h3 className="font-display font-bold text-lg mb-4">Add Staff</h3>
          <div className="space-y-2">
            <input data-testid="staff-name-input" placeholder="Name" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="input"/>
            <input data-testid="staff-email-input" type="email" placeholder="Email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} className="input"/>
            <input data-testid="staff-password-input" type="password" placeholder="Password (6+ chars)" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} className="input"/>
            <select data-testid="staff-role-select" value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})} className="input">
              <option value="manager">Manager</option><option value="cashier">Cashier</option><option value="kitchen_staff">Kitchen Staff</option>
            </select>
          </div>
          <div className="flex gap-2 mt-5"><button onClick={()=>setForm(null)} className="flex-1 px-4 py-2 rounded-lg border border-[#E8DCCF]">Cancel</button><button data-testid="staff-save-button" onClick={save} className="flex-1 btn-coffee text-sm">Add</button></div>
        </div>
      </div>}
    </div>
  );
}
