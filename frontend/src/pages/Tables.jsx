import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "../lib/api";
import { Plus, Trash2, Users, QrCode, Printer, X, Download } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function Tables() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: tables=[], isLoading } = useQuery({ queryKey:["tables"], queryFn: async () => (await api.get("/tables")).data, refetchInterval: 10000 });
  const [add, setAdd] = useState(false);
  const [form, setForm] = useState({ number: "", capacity: 4 });
  const [qr, setQr] = useState(null);
  const canManage = ["owner","manager"].includes(user?.role);

  const create = async () => {
    try { await api.post("/tables", { number: +form.number, capacity: +form.capacity }); toast.success("Table added"); qc.invalidateQueries({queryKey:["tables"]}); setAdd(false); setForm({number:"",capacity:4}); }
    catch(e){toast.error(formatApiErrorDetail(e.response?.data?.detail));}
  };
  const set = async (t, status) => {
    try { await api.patch(`/tables/${t.id}`, { status }); toast.success(`Table ${t.number} → ${status}`); qc.invalidateQueries({queryKey:["tables"]}); }
    catch(e){toast.error(formatApiErrorDetail(e.response?.data?.detail));}
  };
  const del = async (t) => { if(!confirm(`Delete table ${t.number}?`))return; await api.delete(`/tables/${t.id}`); qc.invalidateQueries({queryKey:["tables"]}); };

  return (
    <div className="space-y-6" data-testid="tables-page">
      <div className="flex justify-between items-start">
        <div><h1 className="font-display text-2xl font-bold">Tables</h1><p className="text-sm text-[#6B5A52]">Visual floor plan and status. Tap the QR icon to print guest ordering codes.</p></div>
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
                <button onClick={()=>setQr(t)} data-testid={`table-qr-${t.number}`} className="text-[11px] py-1.5 rounded-md bg-[#FEF3EC] text-[#C85A32] font-medium inline-flex items-center justify-center gap-1"><QrCode className="w-3 h-3"/> QR</button>
                {canManage && <button onClick={()=>del(t)} className="text-[11px] py-1.5 rounded-md text-[#B91C1C] font-medium col-span-2"><Trash2 className="w-3 h-3 mx-auto"/></button>}
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

      {qr && <QrModal table={qr} cafe_id={user?.cafe_id} onClose={()=>setQr(null)}/>}
    </div>
  );
}

function QrModal({ table, cafe_id, onClose }) {
  const url = `${window.location.origin}/order?c=${cafe_id}&t=${table.id}`;
  const download = () => {
    const canvas = document.querySelector("#nx-qr-canvas");
    if (!canvas) return;
    const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = `table-${table.number}-qr.png`; a.click();
  };
  const print = () => {
    const w = window.open("", "_blank");
    const dataUrl = document.querySelector("#nx-qr-canvas")?.toDataURL("image/png");
    w.document.write(`<html><head><title>Table ${table.number} QR</title><style>body{font-family:sans-serif;text-align:center;padding:40px}img{width:280px;height:280px}h1{font-size:32px;margin:12px 0}p{color:#666}</style></head><body><h1>Table ${table.number}</h1><p>Scan to order from your seat</p><img src="${dataUrl}"/><p style="margin-top:24px;font-size:11px;letter-spacing:2px">POWERED BY NEXORAOS</p><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-[#F2E8DC]"><h3 className="font-display font-bold text-lg">Table {table.number} · QR</h3><button onClick={onClose}><X className="w-5 h-5"/></button></div>
        <div className="p-6 text-center">
          <div className="bg-white p-4 inline-block rounded-xl border border-[#E8DCCF]">
            <QRCodeCanvas id="nx-qr-canvas" value={url} size={220} bgColor="#FFFFFF" fgColor="#2D221E" level="M" includeMargin={false}/>
          </div>
          <p className="text-xs text-[#9C8A80] mt-3 mb-1">Guests scan this to order from their seat.</p>
          <p className="text-[10px] text-[#6B5A52] font-mono break-all bg-[#F5ECE1] rounded-md px-2 py-1.5">{url}</p>
        </div>
        <div className="p-4 border-t border-[#F2E8DC] flex gap-2">
          <button onClick={download} data-testid="table-qr-download" className="flex-1 px-4 py-2.5 rounded-lg border border-[#E8DCCF] text-sm font-medium inline-flex items-center justify-center gap-2"><Download className="w-4 h-4"/> Save</button>
          <button onClick={print} data-testid="table-qr-print" className="flex-1 btn-coffee text-sm inline-flex items-center justify-center gap-2"><Printer className="w-4 h-4"/> Print</button>
        </div>
      </div>
    </div>
  );
}
