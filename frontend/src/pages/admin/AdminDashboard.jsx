import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api, money } from "../../lib/api";
import { Store, Users, CreditCard, Receipt, TrendingUp, ShoppingBag, Clock } from "lucide-react";

const KPI = ({icon:Icon, label, value, tone}) => (
  <div className="bg-[#241D1A] border border-[#3D312A] rounded-xl p-5">
    <div className="flex justify-between items-start"><div className="text-[11px] text-[#9E8E81] uppercase tracking-widest font-semibold">{label}</div><div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone==="green"?"bg-[#053829] text-[#4ADE80]":tone==="terra"?"bg-[#3A1D15] text-[#E07A5F]":"bg-[#332822] text-[#E8C8B5]"}`}><Icon className="w-4.5 h-4.5" size={17}/></div></div>
    <div className="font-display text-3xl font-extrabold tabular mt-2 tracking-tight">{value}</div>
  </div>
);

export default function AdminDashboard() {
  const { data } = useQuery({ queryKey:["admin-stats"], queryFn: async () => (await api.get("/admin/stats")).data });
  const d = data || {};
  return (
    <div className="space-y-6" data-testid="admin-dashboard-page">
      <div>
        <h1 className="font-display text-3xl font-bold">Overview</h1>
        <p className="text-sm text-[#9E8E81] mt-1">Platform-wide performance across every café.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPI icon={Store} label="Cafés" value={d.total_cafes ?? "—"}/>
        <KPI icon={Users} label="Users" value={d.total_users ?? "—"}/>
        <KPI icon={CreditCard} label="Paid Subs" value={d.active_subs ?? "—"} tone="green"/>
        <KPI icon={Clock} label="Trials" value={d.trial_subs ?? "—"}/>
        <KPI icon={TrendingUp} label="Revenue" value={money(d.total_revenue)} tone="terra"/>
        <KPI icon={Receipt} label="Invoices" value={d.invoice_count ?? "—"}/>
        <KPI icon={ShoppingBag} label="Café Orders" value={d.total_orders ?? "—"}/>
      </div>
    </div>
  );
}
