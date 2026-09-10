import React from "react";
import { Link } from "react-router-dom";
import { Coffee, ArrowRight, Zap, ChefHat, ShoppingBag, BarChart3 } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] grain">
      <header className="border-b border-[#F2E8DC]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3D271D] flex items-center justify-center"><Coffee className="w-5 h-5 text-[#FDFBF7]"/></div>
            <div className="font-display font-bold text-lg">NexoraOS</div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" data-testid="landing-login-link" className="text-sm font-medium text-[#6B5A52] hover:text-[#2D221E]">Sign in</Link>
            <Link to="/signup" data-testid="landing-signup-link" className="btn-coffee text-sm">Get started</Link>
          </div>
        </div>
      </header>
      <section className="max-w-7xl mx-auto px-6 py-24 relative z-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#C85A32] bg-[#FEF3EC] border border-[#F4D8C6] px-3 py-1.5 rounded-full mb-6">
            <Zap className="w-3.5 h-3.5"/> Café SaaS for modern operators
          </div>
          <h1 className="font-display text-5xl lg:text-6xl font-extrabold text-[#2D221E] leading-[1.05] tracking-tight">
            Café Operations,<br/><span className="text-[#C85A32]">Simplified.</span>
          </h1>
          <p className="mt-6 text-lg text-[#6B5A52] max-w-2xl leading-relaxed">
            NexoraOS is a single, elegant workspace for POS, tables, kitchen, inventory, staff and reports — built for the way small cafés actually run.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/signup" data-testid="landing-cta-signup" className="btn-coffee inline-flex items-center gap-2">Start free 14-day trial <ArrowRight className="w-4 h-4"/></Link>
            <Link to="/login" className="px-5 py-2.5 rounded-lg border border-[#E8DCCF] text-sm font-medium text-[#2D221E] hover:bg-[#F5ECE1]">Sign in</Link>
          </div>
          <div className="mt-6 text-sm text-[#9C8A80]">No credit card. ₹149/month, ₹1,199/year after trial.</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-20">
          {[
            {icon: ShoppingBag, t: "Fast POS", d: "Ring up orders in under 5 seconds with categories, notes and split payments."},
            {icon: ChefHat, t: "Live Kitchen Display", d: "Real-time orders on a KDS with elapsed timers and one-tap status."},
            {icon: BarChart3, t: "Reports that matter", d: "Sales, tax, top products and payment mix — always ready for review."},
          ].map((f) => (
            <div key={f.t} className="card p-6">
              <div className="w-10 h-10 rounded-xl bg-[#F5ECE1] flex items-center justify-center mb-3"><f.icon className="w-5 h-5 text-[#3D271D]"/></div>
              <div className="font-display font-semibold text-lg text-[#2D221E]">{f.t}</div>
              <div className="text-sm text-[#6B5A52] mt-1 leading-relaxed">{f.d}</div>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t border-[#F2E8DC] py-6 text-center text-xs text-[#9C8A80]">Powered by PEAN</footer>
    </div>
  );
}
