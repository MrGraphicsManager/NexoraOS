import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, money, formatApiErrorDetail } from "../lib/api";

const TABS = ["all","new","preparing","ready","completed","cancelled"];

export default function Orders() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [detail, setDetail] = useState(null);
  const { data: orders=[] } = useQuery({ queryKey:["orders"], queryFn: async () => (await api.get("/orders")).data, refetchInterval: 10000 });
  const shown = tab==="all" ? orders : orders.filter(o => o.status===tab);

  const setStatus = async (o, status) => {
    try { await api.patch(`/orders/${o.id}`, { status }); toast.success(`Order #${o.order_no} → ${status}`); qc.invalidateQueries({queryKey:["orders"]}); setDetail(null); }
    catch(e){ toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-5" data-testid="orders-page">
      <div><h1 className="font-display text-2xl font-bold">Orders</h1><p className="text-sm text-[#6B5A52]">All orders across your café.</p></div>
      <div className="flex gap-1.5 border-b border-[#E8DCCF] overflow-x-auto scrollable">
        {TABS.map(t => (
          <button key={t} data-testid={`orders-tab-${t}`} onClick={()=>setTab(t)} className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 -mb-px transition ${tab===t?"border-[#3D271D] text-[#2D221E]":"border-transparent text-[#9C8A80]"}`}>{t} {t!=="all" && <span className="ml-1 text-[10px] tabular">({orders.filter(o=>o.status===t).length})</span>}</button>
        ))}
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F5ECE1] text-xs uppercase text-[#6B5A52]">
            <tr><th className="text-left px-4 py-3">Order</th><th className="text-left px-4 py-3">Time</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Items</th><th className="text-left px-4 py-3">Payment</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Total</th></tr>
          </thead>
          <tbody>
            {shown.length===0 ? <tr><td colSpan={7} className="text-center py-16 text-[#9C8A80]">No orders</td></tr> :
              shown.map(o => (
                <tr key={o.id} data-testid={`orders-row-${o.order_no}`} onClick={()=>setDetail(o)} className="border-t border-[#F2E8DC] hover:bg-[#FDFBF7] cursor-pointer">
                  <td className="px-4 py-3 tabular font-semibold">#{o.order_no}</td>
                  <td className="px-4 py-3 text-[#6B5A52] tabular">{new Date(o.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</td>
                  <td className="px-4 py-3 capitalize">{o.order_type.replace("_"," ")}</td>
                  <td className="px-4 py-3 tabular">{o.items.length}</td>
                  <td className="px-4 py-3"><span className={`badge-status ${o.payment_status==="paid"?"status-available":"status-cancelled"}`}>{o.payment_status}</span></td>
                  <td className="px-4 py-3"><span className={`badge-status status-${o.status}`}>{o.status}</span></td>
                  <td className="px-4 py-3 text-right tabular font-semibold">{money(o.total)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {detail && <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setDetail(null)}>
        <div className="card p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
          <div className="flex justify-between mb-1"><h3 className="font-display font-bold text-lg">Order #{detail.order_no}</h3><span className={`badge-status status-${detail.status}`}>{detail.status}</span></div>
          <div className="text-xs text-[#9C8A80] tabular mb-3">{new Date(detail.created_at).toLocaleString()}</div>
          <div className="space-y-1.5 text-sm border-y border-[#F2E8DC] py-3">
            {detail.items.map((i,idx)=><div key={idx} className="flex justify-between"><span><span className="tabular font-semibold">{i.qty}×</span> {i.name}</span><span className="tabular">{money(i.price*i.qty)}</span></div>)}
          </div>
          <div className="text-sm space-y-1 mt-3">
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular">{money(detail.subtotal)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span className="tabular">{money(detail.tax)}</span></div>
            <div className="flex justify-between font-bold text-base pt-2 border-t"><span>Total</span><span className="tabular text-[#C85A32]">{money(detail.total)}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-5">
            {detail.status!=="cancelled" && detail.status!=="completed" && <button onClick={()=>setStatus(detail,"completed")} data-testid="orders-complete-button" className="btn-coffee text-sm">Mark Completed</button>}
            {detail.status==="new" && <button onClick={()=>setStatus(detail,"cancelled")} className="text-sm px-4 py-2 rounded-lg border border-[#B91C1C] text-[#B91C1C]">Cancel</button>}
            <button onClick={()=>setDetail(null)} className="text-sm px-4 py-2 rounded-lg border border-[#E8DCCF] col-span-full">Close</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
