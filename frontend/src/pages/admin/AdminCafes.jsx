import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, money } from "../../lib/api";
import { Search, ChevronRight } from "lucide-react";

export default function AdminCafes() {
  const { data: cafes=[] } = useQuery({ queryKey:["admin-cafes"], queryFn: async () => (await api.get("/admin/cafes")).data });
  const [q, setQ] = useState("");
  const shown = cafes.filter(c => !q || c.name?.toLowerCase().includes(q.toLowerCase()) || c.owner?.email?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5" data-testid="admin-cafes-page">
      <div><h1 className="font-display text-3xl font-bold">Cafés</h1><p className="text-sm text-[#9E8E81] mt-1">All registered cafés and their subscription status.</p></div>
      <div className="relative max-w-sm"><Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9E8E81]"/>
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search café or owner…" className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-[#241D1A] border border-[#3D312A] text-[#F7F2EC] outline-none focus:border-[#E8C8B5]"/></div>
      <div className="bg-[#241D1A] border border-[#3D312A] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[880px]">
          <thead className="bg-[#2E2521] text-[10px] uppercase tracking-widest text-[#9E8E81]">
            <tr><th className="text-left px-4 py-3">Café</th><th className="text-left px-4 py-3">Owner</th><th className="text-left px-4 py-3">Plan</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Renewal</th><th className="text-right px-4 py-3">Staff</th><th className="text-right px-4 py-3">Orders</th><th></th></tr>
          </thead>
          <tbody>
            {shown.length===0 ? <tr><td colSpan={8} className="text-center py-16 text-[#9E8E81]">No cafés yet</td></tr> :
              shown.map(c => (
                <tr key={c.id} className="border-t border-[#3D312A] hover:bg-[#2E2521]">
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3 text-[#D1C4B8]">{c.owner?.email || "—"}</td>
                  <td className="px-4 py-3 capitalize">{c.subscription?.plan==="cafe" ? `Café · ${c.subscription.billing_cycle}` : c.subscription?.plan || "—"}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${c.subscription?.status==="active"?"bg-[#053829] text-[#4ADE80]":"bg-[#3A1D15] text-[#E07A5F]"}`}>{c.subscription?.status || "none"}</span></td>
                  <td className="px-4 py-3 tabular text-[#D1C4B8]">{c.subscription?.expires_at ? new Date(c.subscription.expires_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-right tabular">{c.staff_count}</td>
                  <td className="px-4 py-3 text-right tabular">{c.order_count}</td>
                  <td className="px-4 py-3 text-right"><Link to={`/nexoraosadmin/cafes/${c.id}`} data-testid={`admin-cafe-view-${c.id}`} className="text-[#E8C8B5]"><ChevronRight className="w-4 h-4"/></Link></td>
                </tr>
              ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
