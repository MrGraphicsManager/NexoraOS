import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, money, formatApiErrorDetail } from "../lib/api";
import { CreditCard, Check, Star } from "lucide-react";

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function Subscription() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey:["sub"], queryFn: async () => (await api.get("/subscription")).data });
  const [busy, setBusy] = useState(null);

  useEffect(() => { loadRazorpay(); }, []);

  const sub = data?.subscription;
  const invoices = data?.invoices || [];
  const key = data?.razorpay_key;

  const pay = async (plan) => {
    setBusy(plan);
    try {
      const { data: order } = await api.post("/subscription/create-order", { plan });
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Failed to load Razorpay");
      const options = {
        key: order.key, amount: order.amount, currency: order.currency, order_id: order.order_id,
        name: "NexoraOS", description: plan === "monthly" ? "Café Plan – Monthly" : "Café Plan – Yearly",
        handler: async (res) => {
          try {
            await api.post("/subscription/verify", { ...res, plan });
            toast.success("Payment successful 🎉"); qc.invalidateQueries({queryKey:["sub"]});
          } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Verification failed"); }
        },
        theme: { color: "#3D271D" },
        modal: { ondismiss: () => setBusy(null) },
      };
      new window.Razorpay(options).open();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message); }
    finally { setBusy(null); }
  };

  if (isLoading) return <div className="text-[#6B5A52]">Loading…</div>;

  return (
    <div className="space-y-6" data-testid="subscription-page">
      <div><h1 className="font-display text-2xl font-bold flex items-center gap-2"><CreditCard className="w-6 h-6 text-[#3D271D]"/> Subscription</h1><p className="text-sm text-[#6B5A52]">Your NexoraOS plan and billing.</p></div>

      <div className="card p-6 bg-gradient-to-br from-white to-[#F5ECE1] border-[#E8DCCF]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="kpi-label">Current plan</div>
            <div className="font-display text-2xl font-bold mt-1 capitalize">{sub?.plan==="cafe"?"Café Plan":sub?.plan==="trial"?"Free Trial":"—"}</div>
            <div className="text-xs text-[#6B5A52] mt-1 capitalize">{sub?.billing_cycle} · Status <span className={`badge-status ml-1 ${sub?.status==="active"?"status-available":"status-cancelled"}`}>{sub?.status}</span></div>
          </div>
          <div className="text-right">
            <div className="kpi-label">Next renewal</div>
            <div className="font-display text-lg font-bold tabular mt-1">{sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "—"}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlanCard title="Monthly" price="₹149" period="/month" features={["All café operations","Unlimited orders","1 café location","Priority support"]}
          badge={null} onPay={()=>pay("monthly")} busy={busy==="monthly"} testid="plan-monthly-button"/>
        <PlanCard title="Yearly" price="₹1,199" period="/year" features={["Everything in monthly","Save ~33% vs monthly","Advanced reports","Early access to new features"]}
          badge="BEST VALUE" onPay={()=>pay("yearly")} busy={busy==="yearly"} testid="plan-yearly-button" highlight/>
      </div>

      <div className="card p-6">
        <h3 className="font-display font-semibold text-lg mb-4">Invoices</h3>
        {invoices.length===0 ? <div className="text-sm text-[#9C8A80] py-6 text-center">No invoices yet</div> :
          <table className="w-full text-sm">
            <thead className="bg-[#F5ECE1] text-xs uppercase text-[#6B5A52]"><tr><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Plan</th><th className="text-right px-3 py-2">Amount</th><th className="text-left px-3 py-2">Payment ID</th></tr></thead>
            <tbody>{invoices.map(iv=>(<tr key={iv.id} className="border-t border-[#F2E8DC]"><td className="px-3 py-2 tabular">{new Date(iv.created_at).toLocaleDateString()}</td><td className="px-3 py-2">{iv.label}</td><td className="px-3 py-2 text-right tabular font-semibold">{money(iv.amount)}</td><td className="px-3 py-2 tabular text-[#9C8A80] text-xs">{iv.payment_id}</td></tr>))}</tbody>
          </table>}
      </div>
    </div>
  );
}

function PlanCard({title,price,period,features,badge,onPay,busy,testid,highlight}){
  return (
    <div className={`card p-6 relative ${highlight?"border-[#3D271D] ring-2 ring-[#3D271D]/10":""}`}>
      {badge && <div className="absolute -top-3 right-6 bg-[#C85A32] text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1"><Star className="w-3 h-3"/> {badge}</div>}
      <div className="text-xs font-semibold uppercase tracking-wider text-[#9C8A80]">Café Plan · {title}</div>
      <div className="flex items-baseline gap-1 mt-2 font-display"><span className="text-4xl font-extrabold text-[#2D221E] tabular">{price}</span><span className="text-[#6B5A52]">{period}</span></div>
      <ul className="space-y-2 mt-5 text-sm">{features.map(f=><li key={f} className="flex items-start gap-2"><Check className="w-4 h-4 text-[#047857] mt-0.5 shrink-0"/> {f}</li>)}</ul>
      <button data-testid={testid} onClick={onPay} disabled={busy} className={`w-full mt-6 py-3 rounded-lg font-semibold text-sm ${highlight?"btn-coffee":"border border-[#3D271D] text-[#3D271D] hover:bg-[#F5ECE1]"} disabled:opacity-60`}>{busy?"Opening checkout…":"Subscribe"}</button>
    </div>
  );
}
