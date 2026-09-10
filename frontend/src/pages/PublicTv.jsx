import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { Coffee, ChefHat, Clock, Bell } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLS = [
  { key: "preparing",    title: "Preparing",    icon: ChefHat, color: "#EFF6FF", text: "#1D4ED8" },
  { key: "almost_ready", title: "Almost Ready", icon: Clock,   color: "#FEF3EC", text: "#C2410C" },
  { key: "ready",        title: "Ready — Please Collect", icon: Bell, color: "#ECFDF5", text: "#047857" },
];

export default function PublicTv() {
  const [params] = useSearchParams();
  const cafe_id = params.get("c");
  const [data, setData] = useState(null);
  const [now, setNow] = useState(new Date());
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!cafe_id) { setErr("Missing café id (add ?c=<cafe_id>)"); return; }
    let stop = false;
    const tick = async () => {
      try { const { data } = await axios.get(`${API}/public/tv`, { params: { cafe_id } }); if (!stop) setData(data); }
      catch { if (!stop) setErr("Café not found"); }
    };
    tick();
    const t = setInterval(tick, 3000);
    const clk = setInterval(() => setNow(new Date()), 1000);
    return () => { stop = true; clearInterval(t); clearInterval(clk); };
  }, [cafe_id]);

  if (err) return <div className="min-h-screen bg-[#1A1412] text-[#F7F2EC] flex items-center justify-center text-center p-10"><div><h1 className="font-display text-4xl font-bold">Oops</h1><p className="text-[#9E8E81] mt-2">{err}</p></div></div>;
  if (!data) return <div className="min-h-screen bg-[#1A1412] text-[#F7F2EC] flex items-center justify-center"><div className="font-display text-2xl">Loading…</div></div>;

  const groups = {};
  COLS.forEach(c => { groups[c.key] = data.orders.filter(o => o.status === c.key); });
  const totalActive = data.orders.length;
  const readyList = groups["ready"] || [];

  return (
    <div className="min-h-screen bg-[#1A1412] text-[#F7F2EC] overflow-hidden">
      <header className="border-b border-[#3D312A] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#E8C8B5] flex items-center justify-center"><Coffee className="w-6 h-6 text-[#1A1412]"/></div>
          <div>
            <div className="font-display text-3xl font-extrabold">{data.cafe_name}</div>
            <div className="text-sm text-[#9E8E81] uppercase tracking-widest font-semibold">Live Order Board</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-4xl tabular font-bold">{now.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}</div>
          <div className="text-sm text-[#9E8E81] tabular">{now.toLocaleDateString([], {weekday:"short", day:"numeric", month:"short"})}</div>
        </div>
      </header>

      {totalActive === 0 ? (
        <div className="flex items-center justify-center h-[70vh] text-center">
          <div>
            <div className="w-24 h-24 rounded-full bg-[#241D1A] flex items-center justify-center mx-auto mb-6"><Coffee className="w-12 h-12 text-[#E8C8B5]"/></div>
            <div className="font-display text-5xl font-extrabold">Take a seat</div>
            <p className="text-[#9E8E81] text-xl mt-3">Fresh orders will appear here shortly.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-8">
          {COLS.map(col => {
            const list = groups[col.key] || [];
            const highlight = col.key === "ready";
            return (
              <section key={col.key} className={`rounded-2xl border ${highlight?"border-[#4ADE80]/40 bg-[#0B2A20]":"border-[#3D312A] bg-[#241D1A]"} min-h-[70vh] flex flex-col`}>
                <div className="px-6 py-4 border-b border-[#3D312A] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <col.icon className={`w-6 h-6`} style={{color: col.text}}/>
                    <div className={`font-display font-extrabold text-xl tracking-wide ${highlight?"text-[#4ADE80]":""}`}>{col.title}</div>
                  </div>
                  <div className={`tabular font-bold text-2xl ${highlight?"text-[#4ADE80]":"text-[#9E8E81]"}`}>{list.length}</div>
                </div>
                <div className="p-4 space-y-3 flex-1 overflow-hidden">
                  {list.length === 0 ? <div className="text-center text-[#9E8E81] py-16 text-lg">—</div> :
                    list.map(o => (
                      <div key={o.order_no} className={`rounded-xl p-5 flex items-center gap-4 ${highlight?"bg-[#0F3D2B] border-2 border-[#4ADE80]/50 animate-pulse":"bg-[#1A1412] border border-[#3D312A]"}`}>
                        <div className={`shrink-0 w-24 h-24 rounded-xl flex items-center justify-center font-display font-black tabular ${highlight?"bg-[#4ADE80] text-[#0B2A20] text-5xl":"bg-[#241D1A] text-[#E8C8B5] text-4xl"}`}>#{o.order_no}</div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-display font-bold truncate ${highlight?"text-4xl":"text-3xl"}`}>{o.name}</div>
                          {o.table && <div className={`text-lg mt-1 ${highlight?"text-[#4ADE80]/80":"text-[#9E8E81]"}`}>Table {o.table}</div>}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {readyList.length > 0 && data.ready_message && (
        <div className="fixed bottom-0 inset-x-0 bg-[#4ADE80] text-[#0B2A20] py-3 text-center font-display font-bold text-xl">
          {data.ready_message}
        </div>
      )}

      <div className="fixed bottom-2 right-4 text-[10px] text-[#6B5A52] tracking-widest">NEXORAOS · POWERED BY PEAN</div>
    </div>
  );
}
