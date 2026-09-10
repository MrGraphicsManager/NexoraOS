import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import { Coffee, Plus, Minus, Check, ShoppingBag, Smartphone, Wallet, Clock, ChefHat, Bell, ArrowRight, Receipt, RotateCcw } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const money = (n) => `₹${Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const LS_KEY = "nx_qr_orders";

function loadStore() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } }
function saveStore(s) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {} }
function rememberOrder(cafeId, tableId, orderId) {
  const s = loadStore(); const k = `${cafeId}:${tableId}`;
  s[k] = { orderId, ts: Date.now() };
  saveStore(s);
}
function forgetOrder(cafeId, tableId) { const s = loadStore(); delete s[`${cafeId}:${tableId}`]; saveStore(s); }

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true); s.onerror = () => resolve(false); document.body.appendChild(s);
  });
}

export default function PublicOrder() {
  const [params] = useSearchParams();
  const cafe_id = params.get("c");
  const table_id = params.get("t");
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [cat, setCat] = useState("all");
  const [cart, setCart] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pm, setPm] = useState("upi");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [checkoutMode, setCheckoutMode] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);

  useEffect(() => {
    if (!cafe_id) { setErr("Invalid QR code"); return; }
    axios.get(`${API}/public/menu`, { params: { cafe_id, table_id: table_id || undefined } })
      .then((r) => { setData(r.data); setPm(r.data.cafe.upi_enabled ? "upi" : "cash"); loadRazorpay(); })
      .catch(() => setErr("Café not found"));
  }, [cafe_id, table_id]);

  // Fetch table's active orders + reconcile with localStorage
  const reloadActive = async () => {
    if (!cafe_id) return;
    try {
      const { data } = await axios.get(`${API}/public/active-orders`, { params: { cafe_id, table_id: table_id || undefined } });
      setActiveOrders(data);
    } catch {}
  };
  useEffect(() => {
    reloadActive();
    const t = setInterval(reloadActive, 5000);
    return () => clearInterval(t);
  }, [cafe_id, table_id]);

  const cats = data?.categories || [];
  const products = data?.products || [];
  const filtered = useMemo(() => products.filter(p => cat === "all" || p.category_id === cat), [products, cat]);
  const add = (p) => setCart(c => { const ex=c.find(i=>i.product_id===p.id); return ex?c.map(i=>i.product_id===p.id?{...i,qty:i.qty+1}:i):[...c,{product_id:p.id,name:p.name,price:p.price,qty:1}]; });
  const dec = (id) => setCart(c => c.flatMap(i => i.product_id!==id?[i]:(i.qty>1?[{...i,qty:i.qty-1}]:[])));
  const subtotal = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const taxRate = data?.cafe?.tax_rate ?? 5;
  const tax = subtotal * taxRate / 100;
  const total = subtotal + tax;
  const qty = cart.reduce((s,i)=>s+i.qty, 0);
  const phoneOk = phone.replace(/\D/g,"").length >= 10;
  const upiOn = data?.cafe?.upi_enabled;

  // Prefill from most recent active order (name/phone reuse)
  useEffect(() => {
    if (activeOrders?.length && !phone) {
      const last = activeOrders[0];
      if (last.customer_name && last.customer_name !== "Guest") setName(last.customer_name);
    }
  }, [activeOrders]);

  const place = async () => {
    if (!phoneOk) return toast.error("Enter a valid 10-digit mobile number");
    if (!cart.length) return toast.error("Add at least one item");
    if (!table_id) return toast.error("Table missing — rescan QR");
    setBusy(true);
    try {
      const items = cart.map(i => ({ product_id: i.product_id, qty: i.qty }));
      const { data: r } = await axios.post(`${API}/public/orders`, { cafe_id, table_id, customer_name: name, customer_phone: phone, payment_method: pm, items });
      if (pm === "upi") {
        const ok = await loadRazorpay();
        if (!ok) { toast.error("Failed to load Razorpay. Try again."); setBusy(false); return; }
        const options = {
          key: r.razorpay_key_id, amount: r.amount, currency: "INR", order_id: r.razorpay_order_id,
          name: data.cafe.name, description: `Order #${r.order_no}`,
          prefill: { contact: phone, name },
          theme: { color: "#3D271D" },
          handler: async (res) => {
            try {
              await axios.post(`${API}/public/orders/verify`, { order_id: r.order_id, razorpay_payment_id: res.razorpay_payment_id, razorpay_signature: res.razorpay_signature });
              rememberOrder(cafe_id, table_id, r.order_id);
              setPlaced({ ...r, payment_status: "paid" });
              setCart([]); setCheckoutMode(false);
              reloadActive();
              toast.success("Payment successful");
            } catch { toast.error("Payment verification failed"); }
          },
          modal: { ondismiss: () => { setBusy(false); toast.info("Payment cancelled — order not placed. Try again."); } },
        };
        new window.Razorpay(options).open();
      } else {
        rememberOrder(cafe_id, table_id, r.order_id);
        setPlaced({ ...r });
        setCart([]); setCheckoutMode(false);
        reloadActive();
        toast.success(`Order #${r.order_no} placed`);
      }
    } catch (e) { toast.error(e.response?.data?.detail || "Could not place order"); }
    finally { setBusy(false); }
  };

  if (err) return <FullMessage title="Oops" body={err}/>;
  if (!data) return <FullMessage title="Loading…" body="Fetching the menu"/>;
  if (placed) return <TrackOrder orderId={placed.order_id} readyMessage={data.cafe.ready_message} onOrderMore={()=>{ setPlaced(null); setCart([]); setCheckoutMode(false); }} onDone={()=>{ forgetOrder(cafe_id, table_id); setPlaced(null); setCart([]); setName(""); setPhone(""); setCheckoutMode(false); reloadActive(); }}/>;

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-40">
      <header className="sticky top-0 z-10 bg-white border-b border-[#E8DCCF]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3D271D] flex items-center justify-center"><Coffee className="w-5 h-5 text-[#FDFBF7]"/></div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-lg truncate">{data.cafe.name}</div>
            <div className="text-[11px] text-[#9C8A80] uppercase tracking-wide">{data.table ? `Table ${data.table.number} · Order from your seat` : "Menu"}</div>
          </div>
        </div>
      </header>

      {!checkoutMode ? (
        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {activeOrders.length > 0 && (
            <div className="bg-[#FEF3EC] border border-[#F4D8C6] rounded-xl p-3.5" data-testid="public-active-banner">
              <div className="text-xs font-bold uppercase tracking-wider text-[#C85A32] mb-1.5">Your active order{activeOrders.length>1?"s":""} at this table</div>
              <div className="space-y-1.5">
                {activeOrders.map(o => (
                  <button key={o.id} onClick={()=>setPlaced({order_id:o.id, order_no:o.order_no, payment_status:o.payment_status})} data-testid={`public-active-${o.order_no}`} className="w-full flex items-center gap-2 py-2 px-2.5 rounded-lg bg-white hover:bg-[#F5ECE1]">
                    <Receipt className="w-4 h-4 text-[#C85A32]"/>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-[#2D221E]">Order #{o.order_no} · <span className="capitalize">{o.status.replace("_"," ")}</span></div>
                      <div className="text-[11px] text-[#6B5A52]">{o.items_count} item{o.items_count!==1?"s":""} · {money(o.total)} · {o.payment_status==="paid"?"Paid":"Payment pending"}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#6B5A52]"/>
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-[#9C8A80] mt-2">Add to your table by picking more items below.</div>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1 scrollable">
            <button onClick={()=>setCat("all")} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${cat==="all"?"bg-[#3D271D] text-[#FDFBF7]":"bg-white border border-[#E8DCCF]"}`}>All</button>
            {cats.map(c => <button key={c.id} onClick={()=>setCat(c.id)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${cat===c.id?"bg-[#3D271D] text-[#FDFBF7]":"bg-white border border-[#E8DCCF]"}`}>{c.name}</button>)}
          </div>
          <div className="space-y-2.5">
            {filtered.length === 0 ? <div className="text-center text-[#9C8A80] py-10 text-sm">No items available.</div> :
              filtered.map(p => {
                const inCart = cart.find(i=>i.product_id===p.id);
                return (
                  <div key={p.id} className="card p-3.5 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-[#F5ECE1] flex items-center justify-center font-display font-bold text-[#3D271D]">{p.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{p.name}</div>
                      <div className="text-xs text-[#9C8A80] mt-0.5 line-clamp-1">{p.description || " "}</div>
                      <div className="tabular text-sm font-bold text-[#C85A32] mt-0.5">{money(p.price)}</div>
                    </div>
                    {inCart ? <div className="flex items-center gap-1.5">
                      <button onClick={()=>dec(p.id)} className="w-9 h-9 rounded-lg bg-[#F5ECE1] flex items-center justify-center"><Minus className="w-4 h-4"/></button>
                      <div className="w-6 text-center tabular font-semibold">{inCart.qty}</div>
                      <button onClick={()=>add(p)} className="w-9 h-9 rounded-lg bg-[#3D271D] text-[#FDFBF7] flex items-center justify-center"><Plus className="w-4 h-4"/></button>
                    </div> : <button onClick={()=>add(p)} data-testid={`public-add-${p.id}`} className="px-3.5 py-2 rounded-lg btn-coffee text-xs">Add</button>}
                  </div>
                );
              })}
          </div>
        </main>
      ) : (
        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          <button onClick={()=>setCheckoutMode(false)} className="text-sm text-[#6B5A52]">← Back to menu</button>
          <div className="card p-5 space-y-3">
            <h2 className="font-display font-bold text-lg">Your order</h2>
            <div className="space-y-2 text-sm">
              {cart.map(i => <div key={i.product_id} className="flex justify-between border-b border-[#F2E8DC] pb-2"><span className="flex-1">{i.qty}× {i.name}</span><span className="tabular font-semibold">{money(i.price*i.qty)}</span></div>)}
            </div>
            <div className="flex justify-between text-sm text-[#6B5A52]"><span>Subtotal</span><span className="tabular">{money(subtotal)}</span></div>
            <div className="flex justify-between text-sm text-[#6B5A52]"><span>Tax ({taxRate}%)</span><span className="tabular">{money(tax)}</span></div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-[#F2E8DC]"><span>Total</span><span className="tabular text-[#C85A32]">{money(total)}</span></div>
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="font-display font-bold text-lg">Your details</h2>
            <label className="block"><div className="text-xs font-semibold text-[#6B5A52] uppercase tracking-wide mb-1">Mobile number *</div>
              <input value={phone} onChange={(e)=>setPhone(e.target.value)} data-testid="public-phone-input" type="tel" inputMode="numeric" pattern="\d{10,15}" required className={`input tabular ${!phoneOk && phone ? "border-[#B91C1C]" : ""}`} placeholder="10-digit mobile"/>
              <div className="text-[11px] text-[#9C8A80] mt-1">Required for order tracking &amp; receipt.</div>
            </label>
            <label className="block"><div className="text-xs font-semibold text-[#6B5A52] uppercase tracking-wide mb-1">Name (optional)</div>
              <input value={name} onChange={(e)=>setName(e.target.value)} className="input" placeholder="Your name"/>
            </label>
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="font-display font-bold text-lg">Payment</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={()=>upiOn && setPm("upi")} disabled={!upiOn} data-testid="public-pay-upi" className={`p-4 rounded-xl border-2 text-left transition ${pm==="upi"?"border-[#3D271D] bg-[#F5ECE1]":"border-[#E8DCCF] bg-white"} disabled:opacity-50`}>
                <Smartphone className="w-5 h-5 text-[#3D271D] mb-1.5"/>
                <div className="font-semibold text-sm">UPI · Card · Netbanking</div>
                <div className="text-[11px] text-[#6B5A52] mt-0.5">{upiOn?"Pay online now, straight to café.":"Not available"}</div>
              </button>
              <button onClick={()=>setPm("cash")} data-testid="public-pay-cash" className={`p-4 rounded-xl border-2 text-left transition ${pm==="cash"?"border-[#3D271D] bg-[#F5ECE1]":"border-[#E8DCCF] bg-white"}`}>
                <Wallet className="w-5 h-5 text-[#3D271D] mb-1.5"/>
                <div className="font-semibold text-sm">Cash at counter</div>
                <div className="text-[11px] text-[#6B5A52] mt-0.5">Pay the cashier at your table.</div>
              </button>
            </div>
            <div className="text-[11px] text-[#9C8A80]">Kitchen only starts once payment is confirmed.</div>
          </div>

          <button onClick={place} disabled={busy || !phoneOk || !cart.length} data-testid="public-place-order-button" className="btn-coffee w-full py-4 text-base font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? "Processing…" : (pm==="upi" ? `Pay ${money(total)} & Place Order` : `Place Order · ${money(total)}`)}
            <ArrowRight className="w-4 h-4"/>
          </button>
        </main>
      )}

      {cart.length > 0 && !checkoutMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8DCCF] shadow-[0_-8px_24px_rgba(45,34,30,0.06)] z-20">
          <div className="max-w-2xl mx-auto p-4">
            <button onClick={()=>setCheckoutMode(true)} data-testid="public-review-button" className="btn-coffee w-full inline-flex items-center justify-between py-3.5 px-5">
              <span className="inline-flex items-center gap-2"><ShoppingBag className="w-5 h-5"/> {qty} item{qty!==1?"s":""}</span>
              <span className="inline-flex items-center gap-2 tabular font-bold">{money(total)} <ArrowRight className="w-4 h-4"/></span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackOrder({ orderId, readyMessage, onOrderMore, onDone }) {
  const [order, setOrder] = useState(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try { const { data } = await axios.get(`${API}/public/orders/${orderId}`); if (!stop) setOrder(data); } catch {}
    };
    tick();
    const t = setInterval(tick, 3000);
    return () => { stop = true; clearInterval(t); };
  }, [orderId]);

  const STEPS = [
    { key: "new", label: "Waiting for payment", icon: Wallet },
    { key: "preparing", label: "Preparing", icon: ChefHat },
    { key: "almost_ready", label: "Almost ready", icon: Clock },
    { key: "ready", label: "Ready", icon: Bell },
    { key: "completed", label: "Enjoy", icon: Check },
  ];
  const idx = order ? STEPS.findIndex(s => s.key === order.status) : 0;
  const paid = order?.payment_status === "paid";
  const isReady = order?.status === "ready" || order?.status === "completed";
  const isDone = order?.status === "completed";

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <header className="bg-white border-b border-[#E8DCCF] px-4 py-4 text-center">
        <div className="inline-flex items-center gap-2"><Coffee className="w-5 h-5 text-[#3D271D]"/><span className="font-display font-bold">{order?.cafe_name || "Café"}</span></div>
      </header>
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="text-center">
          <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${isReady?"bg-[#ECFDF5]":"bg-[#F5ECE1]"} mb-4`}>
            {isReady ? <Bell className="w-8 h-8 text-[#047857] animate-pulse"/> : <Clock className="w-8 h-8 text-[#3D271D]"/>}
          </div>
          <h1 className="font-display text-3xl font-extrabold text-[#2D221E]">{isReady ? "Your order is ready!" : "Thanks — order placed"}</h1>
          <p className="text-[#6B5A52] mt-1">Order <span className="font-mono font-bold text-[#3D271D]">#{order?.order_no || "—"}</span> · Total <span className="tabular font-bold">{order?money(order.total):""}</span></p>
        </div>

        <div className={`card p-4 text-sm ${paid?"bg-[#ECFDF5] border-[#047857]/20":"bg-[#FFFBEB] border-[#B45309]/20"}`}>
          <div className="flex items-center gap-2 font-semibold">
            {paid ? <><Check className="w-4 h-4 text-[#047857]"/> <span className="text-[#047857]">Payment received</span></>
                  : <><Clock className="w-4 h-4 text-[#B45309]"/> <span className="text-[#B45309]">
                    {order?.payment_method === "cash" ? "Cash pending — pay the cashier at your table" : "Waiting for payment…"}
                  </span></>}
          </div>
          <div className="text-[11px] text-[#6B5A52] mt-1">{order?.payment_method?.toUpperCase()}</div>
          {!paid && <div className="text-[11px] text-[#B45309] mt-2 font-medium">Kitchen will start preparing only after payment is confirmed.</div>}
        </div>

        {isReady && !isDone && <div className="card p-5 bg-[#3D271D] text-[#FDFBF7] text-center">
          <Bell className="w-6 h-6 mx-auto mb-2 text-[#E8C8B5]"/>
          <div className="font-display font-semibold text-lg leading-snug">{readyMessage}</div>
        </div>}

        <div className="card p-5">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#9C8A80] mb-3">Live status</div>
          <div className="space-y-3">
            {STEPS.map((s, i) => {
              const active = i <= idx && order?.status !== "cancelled";
              const current = i === idx && !isDone;
              return (
                <div key={s.key} className={`flex items-center gap-3 ${active?"":"opacity-40"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${active?"bg-[#3D271D] text-[#FDFBF7]":"bg-[#F5ECE1] text-[#6B5A52]"} ${current?"ring-4 ring-[#3D271D]/10 animate-pulse":""}`}>
                    <s.icon className="w-4 h-4"/>
                  </div>
                  <div className="text-sm font-semibold">{s.label}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-[11px] text-[#9C8A80]">Refreshes every 3s. You can safely close and reopen — your order will be waiting.</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onOrderMore} data-testid="public-order-more" className="py-2.5 rounded-lg border border-[#E8DCCF] text-sm font-medium inline-flex items-center justify-center gap-1.5"><Plus className="w-4 h-4"/> Order more</button>
          <button onClick={onDone} className="py-2.5 rounded-lg border border-[#E8DCCF] text-sm font-medium inline-flex items-center justify-center gap-1.5 text-[#6B5A52]"><RotateCcw className="w-4 h-4"/> Start over</button>
        </div>
        <div className="text-[10px] text-center text-[#9C8A80] tracking-widest">POWERED BY PEAN · NEXORAOS</div>
      </div>
    </div>
  );
}

const FullMessage = ({title, body}) => (
  <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6 text-center">
    <div><h1 className="font-display text-2xl font-bold text-[#2D221E]">{title}</h1><p className="text-sm text-[#6B5A52] mt-1">{body}</p></div>
  </div>
);
