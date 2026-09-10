import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "../lib/api";
import { Clock, ChefHat, ArrowRight, Radio } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const COLS = [
  { key: "new", title: "NEW", tone: "warn", next: "preparing", nextLabel: "Start Preparing" },
  { key: "preparing", title: "PREPARING", tone: "info", next: "almost_ready", nextLabel: "Almost Ready" },
  { key: "almost_ready", title: "ALMOST READY", tone: "amber", next: "ready", nextLabel: "Mark Ready" },
  { key: "ready", title: "READY", tone: "success", next: "completed", nextLabel: "Complete" },
  { key: "completed", title: "COMPLETED", tone: "muted", next: null },
];

function elapsed(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;
}

export default function Kitchen() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [live, setLive] = React.useState(false);
  const { data: orders=[] } = useQuery({ queryKey:["orders","kds"], queryFn: async () => (await api.get("/orders")).data, refetchInterval: 15000 });

  // WebSocket live sync
  React.useEffect(() => {
    const token = localStorage.getItem("nx_token");
    if (!token) return;
    const base = process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws");
    const wsUrl = `${base}/api/ws/kds?token=${encodeURIComponent(token)}`;
    let ws, ka, retry;
    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => { setLive(true); ka = setInterval(()=>{ try{ws.send("ping");}catch{} }, 25000); };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "order.new") {
            toast.success(`New order #${msg.order_no}${msg.source==="qr"?" (QR)":""}`);
            qc.invalidateQueries({queryKey:["orders","kds"]});
            qc.invalidateQueries({queryKey:["orders"]});
            qc.invalidateQueries({queryKey:["dashboard"]});
          } else if (msg.type === "order.updated") {
            qc.invalidateQueries({queryKey:["orders","kds"]});
            qc.invalidateQueries({queryKey:["orders"]});
          }
        } catch {}
      };
      ws.onclose = () => { setLive(false); if (ka) clearInterval(ka); retry = setTimeout(connect, 3000); };
      ws.onerror = () => { try { ws.close(); } catch {} };
    };
    connect();
    return () => { if (ka) clearInterval(ka); if (retry) clearTimeout(retry); if (ws) { ws.onclose = null; try{ws.close();}catch{} } };
  }, [qc, user?.cafe_id]);

  const advance = async (o, status) => {
    try { await api.patch(`/orders/${o.id}`, { status }); toast.success(`#${o.order_no} → ${status}`); qc.invalidateQueries(); }
    catch(e){ toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-5" data-testid="kitchen-page">
      <div className="flex items-center justify-between">
        <div><h1 className="font-display text-2xl font-bold flex items-center gap-2"><ChefHat className="w-6 h-6 text-[#3D271D]"/> Kitchen Display</h1><p className="text-sm text-[#6B5A52]">Real-time order queue.</p></div>
        <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full ${live?"bg-[#ECFDF5] text-[#047857]":"bg-[#F5ECE1] text-[#6B5A52]"}`} data-testid="kitchen-live-status">
          <Radio className={`w-3 h-3 ${live?"animate-pulse":""}`}/> {live ? "LIVE" : "polling"}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {COLS.map(col => {
          const list = orders.filter(o => o.status === col.key);
          return (
            <div key={col.key} className="bg-white border border-[#E8DCCF] rounded-xl overflow-hidden flex flex-col min-h-[500px]">
              <div className={`px-4 py-3 border-b border-[#E8DCCF] flex justify-between items-center ${col.tone==="warn"?"bg-[#FFFBEB]":col.tone==="info"?"bg-[#EFF6FF]":col.tone==="amber"?"bg-[#FEF3EC]":col.tone==="success"?"bg-[#ECFDF5]":"bg-[#F5ECE1]"}`}>
                <div className="font-display font-bold text-sm tracking-wider">{col.title}</div>
                <div className="text-xs tabular font-semibold text-[#6B5A52]">{list.length}</div>
              </div>
              <div className="p-3 space-y-3 flex-1 overflow-y-auto scrollable">
                {list.length===0 ? <div className="text-xs text-[#9C8A80] text-center py-12">Empty</div> :
                  list.map(o => {
                    const mins = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
                    const overdue = mins > 15 && col.key !== "completed";
                    return (
                      <div key={o.id} data-testid={`kds-card-${o.order_no}`} className={`border rounded-lg p-3 ${overdue?"border-[#B91C1C]/40 bg-[#FEF2F2]":"border-[#E8DCCF] bg-white"}`}>
                        <div className="flex justify-between items-start mb-1">
                          <div className="font-display font-bold text-base tabular flex items-center gap-1">#{o.order_no}{o.source==="qr" && <span className="text-[9px] font-bold uppercase bg-[#C85A32] text-white px-1.5 py-0.5 rounded">QR</span>}</div>
                          <div className={`text-[11px] tabular font-semibold flex items-center gap-1 ${overdue?"text-[#B91C1C]":"text-[#9C8A80]"}`}><Clock className="w-3 h-3"/> {elapsed(o.created_at)}</div>
                        </div>
                        <div className="text-[11px] text-[#6B5A52] mb-2 uppercase tracking-wide font-medium">{o.order_type.replace("_"," ")}</div>
                        <div className="space-y-0.5 text-sm border-t border-[#F2E8DC] pt-2">
                          {o.items.map((i,idx)=>(<div key={idx} className="flex gap-2"><span className="tabular font-bold text-[#C85A32] w-6">{i.qty}×</span><span className="flex-1">{i.name}</span></div>))}
                        </div>
                        {o.notes && <div className="text-[11px] italic text-[#6B5A52] bg-[#F5ECE1] rounded-md px-2 py-1 mt-2">&ldquo;{o.notes}&rdquo;</div>}
                        {col.next && (
                          <button onClick={()=>advance(o, col.next)} data-testid={`kds-advance-${o.order_no}`} className="mt-3 w-full btn-coffee text-xs inline-flex items-center justify-center gap-1 py-2">{col.nextLabel} <ArrowRight className="w-3 h-3"/></button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
