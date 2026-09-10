import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, money } from "../../lib/api";
import { ArrowLeft } from "lucide-react";

export default function AdminCafeDetail() {
  const { id } = useParams();
  const { data } = useQuery({ queryKey:["admin-cafe", id], queryFn: async () => (await api.get(`/admin/cafes/${id}`)).data });
  if (!data) return <div className="text-[#9E8E81]">Loading…</div>;
  const { cafe, users, subscriptions, invoices, orders_total } = data;
  return (
    <div className="space-y-6" data-testid="admin-cafe-detail-page">
      <Link to="/nexoraosadmin/cafes" className="inline-flex items-center gap-2 text-sm text-[#9E8E81] hover:text-[#F7F2EC]"><ArrowLeft className="w-4 h-4"/> Back to cafés</Link>
      <div className="bg-[#241D1A] border border-[#3D312A] rounded-xl p-6">
        <div className="text-[11px] text-[#9E8E81] uppercase tracking-widest font-semibold">Café</div>
        <h1 className="font-display text-3xl font-bold mt-1">{cafe.name}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 text-sm">
          <Field label="Phone" v={cafe.phone||"—"}/><Field label="GSTIN" v={cafe.gstin||"—"}/><Field label="Tax rate" v={`${cafe.tax_rate}%`}/><Field label="Orders" v={orders_total}/>
          <div className="col-span-full"><Field label="Address" v={cafe.address||"—"}/></div>
        </div>
      </div>

      <Section title="Users & Staff">
        <table className="w-full text-sm">
          <thead className="bg-[#2E2521] text-[10px] uppercase tracking-widest text-[#9E8E81]"><tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Email</th><th className="text-left px-4 py-3">Role</th><th className="text-left px-4 py-3">Joined</th></tr></thead>
          <tbody>{users.map(u => <tr key={u.id} className="border-t border-[#3D312A]"><td className="px-4 py-3 font-semibold">{u.name}</td><td className="px-4 py-3 text-[#D1C4B8]">{u.email}</td><td className="px-4 py-3 capitalize">{u.role.replace("_"," ")}</td><td className="px-4 py-3 text-[#D1C4B8] text-xs tabular">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td></tr>)}</tbody>
        </table>
      </Section>

      <Section title="Subscriptions">
        <table className="w-full text-sm">
          <thead className="bg-[#2E2521] text-[10px] uppercase tracking-widest text-[#9E8E81]"><tr><th className="text-left px-4 py-3">Plan</th><th className="text-left px-4 py-3">Cycle</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Started</th><th className="text-left px-4 py-3">Expires</th><th className="text-right px-4 py-3">Amount</th></tr></thead>
          <tbody>{subscriptions.map(s => <tr key={s.id} className="border-t border-[#3D312A]"><td className="px-4 py-3 capitalize">{s.plan}</td><td className="px-4 py-3 capitalize">{s.billing_cycle}</td><td className="px-4 py-3"><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${s.status==="active"?"bg-[#053829] text-[#4ADE80]":"bg-[#3A1D15] text-[#E07A5F]"}`}>{s.status}</span></td><td className="px-4 py-3 tabular text-[#D1C4B8]">{s.started_at ? new Date(s.started_at).toLocaleDateString() : "—"}</td><td className="px-4 py-3 tabular text-[#D1C4B8]">{s.expires_at ? new Date(s.expires_at).toLocaleDateString() : "—"}</td><td className="px-4 py-3 text-right tabular font-semibold">{money(s.amount||0)}</td></tr>)}</tbody>
        </table>
      </Section>

      <Section title="Invoices">
        <table className="w-full text-sm">
          <thead className="bg-[#2E2521] text-[10px] uppercase tracking-widest text-[#9E8E81]"><tr><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Plan</th><th className="text-left px-4 py-3">Razorpay Payment</th><th className="text-right px-4 py-3">Amount</th></tr></thead>
          <tbody>{invoices.length===0 ? <tr><td colSpan={4} className="text-center py-8 text-[#9E8E81]">No invoices yet</td></tr> : invoices.map(i => <tr key={i.id} className="border-t border-[#3D312A]"><td className="px-4 py-3 tabular">{new Date(i.created_at).toLocaleDateString()}</td><td className="px-4 py-3">{i.label}</td><td className="px-4 py-3 font-mono text-xs text-[#D1C4B8]">{i.payment_id}</td><td className="px-4 py-3 text-right tabular font-semibold">{money(i.amount)}</td></tr>)}</tbody>
        </table>
      </Section>
    </div>
  );
}
const Field = ({label,v}) => <div><div className="text-[10px] text-[#9E8E81] uppercase tracking-widest font-semibold">{label}</div><div className="font-medium mt-0.5">{v}</div></div>;
const Section = ({title,children}) => <div className="bg-[#241D1A] border border-[#3D312A] rounded-xl overflow-hidden"><div className="px-5 py-3 border-b border-[#3D312A] font-display font-semibold">{title}</div>{children}</div>;
