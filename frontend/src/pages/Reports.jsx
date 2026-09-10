import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, money } from "../lib/api";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

const RANGES = [{k:"1",label:"Today"},{k:"7",label:"7 Days"},{k:"30",label:"30 Days"},{k:"90",label:"90 Days"}];
const COLORS = ["#C85A32","#3D271D","#D97706","#047857","#B91C1C"];

export default function Reports() {
  const [range, setRange] = useState("7");
  const { data, isLoading } = useQuery({ queryKey:["reports",range], queryFn: async () => (await api.get(`/reports?range=${range}`)).data });
  if (isLoading) return <div className="text-[#6B5A52]">Loading…</div>;
  const d = data || {};

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div><h1 className="font-display text-2xl font-bold">Reports</h1><p className="text-sm text-[#6B5A52]">Analytics for your café.</p></div>
        <div className="flex gap-1 bg-white border border-[#E8DCCF] rounded-lg p-1">
          {RANGES.map(r=><button key={r.k} data-testid={`reports-range-${r.k}`} onClick={()=>setRange(r.k)} className={`px-3 py-1.5 text-xs font-semibold rounded-md ${range===r.k?"bg-[#3D271D] text-[#FDFBF7]":"text-[#6B5A52]"}`}>{r.label}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <KPI label="Total Sales" value={money(d.total_sales)} tone="terra"/>
        <KPI label="Orders" value={d.orders_count}/>
        <KPI label="Avg Order Value" value={money(d.aov)}/>
        <KPI label="Tax Collected" value={money(d.total_tax)}/>
        <KPI label="Discounts" value={money(d.total_discount)}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Sales trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.daily || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2E8DC"/>
                <XAxis dataKey="date" tick={{fontSize:11,fill:"#9C8A80"}}/>
                <YAxis tick={{fontSize:11,fill:"#9C8A80"}}/>
                <Tooltip contentStyle={{borderRadius:10,border:"1px solid #E8DCCF"}}/>
                <Line type="monotone" dataKey="value" stroke="#C85A32" strokeWidth={2.5} dot={{fill:"#C85A32",r:3}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Payment mix</h3>
          {(d.payments||[]).length===0 ? <div className="h-56 flex items-center justify-center text-[#9C8A80] text-sm">No data</div> :
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.payments} dataKey="value" nameKey="method" innerRadius={40} outerRadius={80}>
                  {d.payments.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v)=>money(v)}/>
              </PieChart>
            </ResponsiveContainer>
          </div>}
          <div className="space-y-1.5 text-sm mt-2">
            {d.payments?.map((p,i)=><div key={p.method} className="flex justify-between items-center"><span className="inline-flex items-center gap-2 capitalize"><span className="w-2.5 h-2.5 rounded-full" style={{background:COLORS[i%COLORS.length]}}/> {p.method}</span><span className="tabular font-semibold">{money(p.value)}</span></div>)}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-display font-semibold text-lg mb-4">Top products</h3>
        {(d.top_products||[]).length===0 ? <div className="text-sm text-[#9C8A80] text-center py-8">No product sales in this range.</div> :
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.top_products}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2E8DC"/>
              <XAxis dataKey="name" tick={{fontSize:11,fill:"#9C8A80"}}/>
              <YAxis tick={{fontSize:11,fill:"#9C8A80"}}/>
              <Tooltip contentStyle={{borderRadius:10,border:"1px solid #E8DCCF"}} formatter={(v,n)=>n==="revenue"?money(v):v}/>
              <Bar dataKey="revenue" fill="#3D271D" radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>}
      </div>
    </div>
  );
}
const KPI = ({label,value,tone}) => (
  <div className="card p-4 sm:p-5"><div className="kpi-label text-[10px] sm:text-xs">{label}</div><div className={`kpi-value text-2xl sm:text-3xl tabular mt-2 ${tone==="terra"?"text-[#C85A32]":""}`}>{value}</div></div>
);
