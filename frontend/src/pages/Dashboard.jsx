import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, money } from "../lib/api";
import { TrendingUp, ShoppingBag, Grid3x3, ChefHat, AlertTriangle, Plus, Package, BarChart3 } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

const KPI = ({icon:Icon, label, value, tone="coffee", testid}) => (
  <div className="card p-4 sm:p-5" data-testid={testid}>
    <div className="flex items-center justify-between">
      <div className="kpi-label text-[10px] sm:text-xs">{label}</div>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone==="coffee"?"bg-[#F5ECE1] text-[#3D271D]":tone==="terra"?"bg-[#FEF3EC] text-[#C85A32]":tone==="green"?"bg-[#ECFDF5] text-[#047857]":"bg-[#FEF2F2] text-[#B91C1C]"}`}><Icon className="w-4.5 h-4.5" size={17}/></div>
    </div>
    <div className="kpi-value text-2xl sm:text-3xl mt-2 tabular">{value}</div>
  </div>
);

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey:["dashboard"], queryFn: async () => (await api.get("/dashboard")).data, refetchInterval: 15000 });
  if (isLoading) return <div className="text-[#6B5A52]">Loading dashboard…</div>;
  const d = data || {};
  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#2D221E]">Dashboard</h1>
          <p className="text-sm text-[#6B5A52] mt-1">Live snapshot of your café today.</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <Link to="/pos" data-testid="qa-new-order" className="btn-coffee text-sm inline-flex items-center justify-center gap-2"><Plus className="w-4 h-4"/> New Order</Link>
          <Link to="/menu" className="px-4 py-2.5 rounded-lg border border-[#E8DCCF] text-sm font-medium text-center">Add Product</Link>
          <Link to="/inventory" className="px-4 py-2.5 rounded-lg border border-[#E8DCCF] text-sm font-medium text-center">Add Stock</Link>
          <Link to="/reports" className="px-4 py-2.5 rounded-lg border border-[#E8DCCF] text-sm font-medium text-center">Reports</Link>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPI icon={TrendingUp} label="Today's Sales" value={money(d.total_sales)} tone="terra" testid="kpi-sales"/>
        <KPI icon={ShoppingBag} label="Today's Orders" value={d.orders_count ?? 0} tone="coffee" testid="kpi-orders"/>
        <KPI icon={Grid3x3} label="Active Tables" value={d.active_tables ?? 0} tone="green" testid="kpi-tables"/>
        <KPI icon={ChefHat} label="Kitchen Pending" value={d.kitchen_pending ?? 0} tone="red" testid="kpi-kitchen"/>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-lg">Sales trend — today</h3>
            <div className="text-xs text-[#9C8A80] font-medium">By hour</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.sales_by_hour || []}>
                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C85A32" stopOpacity={0.35}/><stop offset="100%" stopColor="#C85A32" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2E8DC"/>
                <XAxis dataKey="hour" tick={{fontSize:11, fill:"#9C8A80"}}/>
                <YAxis tick={{fontSize:11, fill:"#9C8A80"}}/>
                <Tooltip contentStyle={{borderRadius:10,border:"1px solid #E8DCCF"}}/>
                <Area type="monotone" dataKey="value" stroke="#C85A32" strokeWidth={2.5} fill="url(#g)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-lg">Low stock</h3>
            <AlertTriangle className="w-4 h-4 text-[#B45309]"/>
          </div>
          {(d.low_stock || []).length === 0 ? <div className="text-sm text-[#9C8A80] py-6 text-center">All items well stocked ✓</div> :
            <div className="space-y-2">
              {d.low_stock.slice(0,6).map((i)=> (
                <div key={i.id} className="flex items-center justify-between text-sm py-1.5 border-b border-[#F2E8DC] last:border-0">
                  <div><div className="font-medium text-[#2D221E]">{i.name}</div><div className="text-[11px] text-[#9C8A80]">{i.category}</div></div>
                  <div className="text-right tabular"><div className="text-[#B91C1C] font-semibold">{i.current_stock} {i.unit}</div><div className="text-[10px] text-[#9C8A80]">min {i.min_stock}</div></div>
                </div>
              ))}
            </div>}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Recent orders</h3>
          {(d.recent_orders || []).length === 0 ? <div className="text-sm text-[#9C8A80] py-8 text-center">No orders yet. <Link to="/pos" className="text-[#C85A32] font-medium">Take one →</Link></div> :
            <div className="space-y-1">
              {d.recent_orders.map((o)=> (
                <div key={o.id} className="flex items-center justify-between py-2.5 border-b border-[#F2E8DC] last:border-0">
                  <div>
                    <div className="text-sm font-semibold tabular">#{o.order_no}</div>
                    <div className="text-[11px] text-[#9C8A80]">{new Date(o.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div>
                  </div>
                  <span className={`badge-status status-${o.status}`}>{o.status}</span>
                  <div className="tabular font-semibold text-[#2D221E]">{money(o.total)}</div>
                </div>
              ))}
            </div>}
        </div>
        <div className="card p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Top products (30d)</h3>
          {(d.top_products || []).length === 0 ? <div className="text-sm text-[#9C8A80] py-8 text-center">No sales yet.</div> :
            <div className="space-y-3">
              {d.top_products.map((p, i)=> (
                <div key={p.name} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F5ECE1] flex items-center justify-center text-xs font-bold text-[#3D271D]">{i+1}</div>
                  <div className="flex-1 text-sm font-medium">{p.name}</div>
                  <div className="tabular text-sm text-[#6B5A52]">{p.count} sold</div>
                </div>
              ))}
            </div>}
        </div>
      </div>
    </div>
  );
}
