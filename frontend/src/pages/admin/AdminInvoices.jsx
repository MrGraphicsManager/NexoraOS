import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api, money } from "../../lib/api";

export default function AdminInvoices() {
  const { data: invoices=[] } = useQuery({ queryKey:["admin-invoices"], queryFn: async () => (await api.get("/admin/invoices")).data });
  const total = invoices.reduce((s,i)=>s+(i.amount||0),0);
  return (
    <div className="space-y-5" data-testid="admin-invoices-page">
      <div><h1 className="font-display text-3xl font-bold">Invoices</h1><p className="text-sm text-[#9E8E81] mt-1">All payments across every café. Total collected: <span className="text-[#E07A5F] font-bold tabular">{money(total)}</span></p></div>
      <div className="bg-[#241D1A] border border-[#3D312A] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#2E2521] text-[10px] uppercase tracking-widest text-[#9E8E81]"><tr><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Café</th><th className="text-left px-4 py-3">Plan</th><th className="text-left px-4 py-3">Payment ID</th><th className="text-right px-4 py-3">Amount</th></tr></thead>
          <tbody>
            {invoices.length===0 ? <tr><td colSpan={5} className="text-center py-16 text-[#9E8E81]">No invoices yet</td></tr> :
              invoices.map(i => (
                <tr key={i.id} className="border-t border-[#3D312A]">
                  <td className="px-4 py-3 tabular">{new Date(i.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-semibold">{i.cafe_name}</td>
                  <td className="px-4 py-3">{i.label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#D1C4B8]">{i.payment_id}</td>
                  <td className="px-4 py-3 text-right tabular font-semibold">{money(i.amount)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
