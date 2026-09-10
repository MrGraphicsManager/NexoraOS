import React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, money } from "../../lib/api";
import { Download } from "lucide-react";

export default function AdminInvoices() {
  const { data: invoices=[] } = useQuery({ queryKey:["admin-invoices"], queryFn: async () => (await api.get("/admin/invoices")).data });
  const total = invoices.reduce((s,i)=>s+(i.amount||0),0);

  const download = async () => {
    try {
      const token = localStorage.getItem("nx_token");
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/invoices/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexoraos-invoices-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5" data-testid="admin-invoices-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="font-display text-3xl font-bold">Invoices</h1><p className="text-sm text-[#9E8E81] mt-1">All payments across every café. Total collected: <span className="text-[#E07A5F] font-bold tabular">{money(total)}</span></p></div>
        <button onClick={download} data-testid="admin-invoices-export-button" className="px-4 py-2.5 rounded-lg bg-[#E8C8B5] text-[#1A1412] font-semibold text-sm inline-flex items-center gap-2 hover:bg-[#F0D7C7]"><Download className="w-4 h-4"/> Export CSV</button>
      </div>
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
