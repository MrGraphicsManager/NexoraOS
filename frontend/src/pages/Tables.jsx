import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, money, formatApiErrorDetail } from "../lib/api";
import { Plus, Trash2, Users } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function Tables() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: tables=[], isLoading } = useQuery({ queryKey:["tables"], queryFn: async () => (await api.get("/tables")).data, refetchInterval: 10000 });
  const [add, setAdd] = useState(false);
  const [form, setForm] = useState({ number: "", capacity: 4 });
  const canManage = ["owner","manager"].includes(user?.role);

  const create = async () => {
    try { await api.post("/tables", { number: +form.number, capacity: +form.capacity });
      toast.success("Table added"); qc.invalidateQueries({queryKey:["tables"]}); setAdd(false); setForm({number:"",capacity:4});
    } catch(e){toast.error(formatApiErrorDetail(e.response?.data?.detail));}
  };
  const set = async (t, status) => {
    try { await api.patch(`/tables/${t.id}`, { status }); toast.success(`Table ${t.number} → ${status}`); qc.invalidateQueries({queryKey:["tables"]}); }
    catch(e){toast.error(formatApiErrorDetail(e.response?.data?.detail));}
  };
  const del = async (t) => { if(!confirm(`Delete table ${t.number}?`))return; await api.delete(`/tables/${t.id}`); toast.success("Deleted"); qc.invalidateQueries({queryKey:["tables"]}); };

  return (
    <div className="space-y-6" data-testid="tables-page">
      <div className="flex justify-between items-start">
        <div><h1 className="font-display text-2xl font-bold">Tables</h1><p className="text-sm text-[#6B5A52]">Visual floor plan and status.</p></div>
        {canManage && <button data-testid="tables-add-button" onClick={()=>setAdd(true)} className="btn-coffee text-sm inline-flex items-center gap-2"><Plus className="w-4 h-4"/> Add Table</button>}
      </div>
      <div className="flex gap-3 text-xs">
        <span className="badge-status status-available">Available</span>
        <span className="badge-status status-occupied">Occupied</span>
        <span className="badge-status status-reserved">Reserved</span>
      </div>
      {isLoading ? <div className="text-[#6B5A52]">Loading…</div> :
        tables.length===0 ? <div className="card p-12 text-center text-[#9C8A80]">No tables yet. Add your first table to get started.</div> :
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tables.map(t => (
            <div key={t.id} data-testid={`table-card-${t.number}`} className={`card p-4 relative ${t.status==="occupied"?"border-[#B91C1C]/30":t.status==="reserved"?"border-[#B45309]/30":"border-[#047857]/30"}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="font-display font-bold text-2xl tabular">T{t.number}</div>
                <span className={`badge-status status-${t.status}`}>{t.status}</span>
              </div>
              <div className="text-xs text-[#9C8A80] flex items-center gap-1"><Users className="w-3 h-3"/> {t.capacity} seats</div>
              {t.occupied_at && <div className="text-[11px] text-[#6B5A52] mt-1 tabular">since {new Date(t.occupied_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>}
              <div className="mt-3 grid grid-cols-2 gap-1">
                {t.status!=="available" && <button onClick={()=>set(t,"available")} data-testid={`table-clear-${t.number}`} className="text-[11px] py-1.5 rounded-md bg-[#F5ECE1] font-medium">Clear</button>}
                {t.status!=="reserved" && <button onClick={()=>set(t,"reserved")} className="text-[11px] py-1.5 rounded-md bg-[#F5ECE1] font-medium">Reserve</button>}
                {t.status!=="occupied" && <button onClick={()=>set(t,"occupied")} className="text-[11px] py-1.5 rounded-md bg-[#3D271D] text-[#FDFBF7] font-medium">Occupy</button>}
                {canManage && <button onClick={()=>del(t)} className="text-[11px] py-1.5 rounded-md text-[#B91C1C] font-medium"><Trash2 className="w-3 h-3 mx-auto"/></button>}
              </div>
            </div>
          ))}
        </div>}

      {add && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="card p-6 w-full max-w-sm">
          <h3 className="font-display font-bold text-lg mb-4">Add Table</h3>
          <div className="space-y-3">
            <div><div className="text-xs font-semibold mb-1">Table number</div><input data-testid="table-number-input" type="number" value={form.number} onChange={(e)=>setForm({...form,number:e.target.value})} className="input"/></div>
            <div><div className="text-xs font-semibold mb-1">Capacity</div><input type="number" value={form.capacity} onChange={(e)=>setForm({...form,capacity:e.target.value})} className="input"/></div>
          </div>
          <div className="flex gap-2 mt-5"><button onClick={()=>setAdd(false)} className="flex-1 px-4 py-2 rounded-lg border border-[#E8DCCF]">Cancel</button><button data-testid="table-save-button" onClick={create} className="flex-1 btn-coffee text-sm">Add</button></div>
        </div>
      </div>}
    </div>
  );
}
