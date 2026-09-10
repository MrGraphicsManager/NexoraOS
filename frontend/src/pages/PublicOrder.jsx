import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import { Coffee, Plus, Minus, Trash2, Check, ShoppingBag } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const money = (n) => `₹${Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

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
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(null);

  useEffect(() => {
    if (!cafe_id) { setErr("Invalid QR code"); return; }
    axios.get(`${API}/public/menu`, { params: { cafe_id, table_id: table_id || undefined } })
      .then((r) => setData(r.data))
      .catch(() => setErr("Café not found"));
  }, [cafe_id, table_id]);

  const cats = data?.categories || [];
  const products = data?.products || [];
  const filtered = useMemo(() => products.filter(p => cat === "all" || p.category_id === cat), [products, cat]);
  const add = (p) => setCart(c => { const ex=c.find(i=>i.product_id===p.id); return ex?c.map(i=>i.product_id===p.id?{...i,qty:i.qty+1}:i):[...c,{product_id:p.id,name:p.name,price:p.price,qty:1}]; });
  const dec = (id) => setCart(c => c.flatMap(i => i.product_id!==id?[i]:(i.qty>1?[{...i,qty:i.qty-1}]:[])));
  const rm = (id) => setCart(c => c.filter(i=>i.product_id!==id));
  const subtotal = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const taxRate = data?.cafe?.tax_rate ?? 5;
  const tax = subtotal * taxRate / 100;
  const total = subtotal + tax;

  const place = async () => {
    if (!cart.length) return toast.error("Add at least one item");
    if (!table_id) return toast.error("Table missing — please rescan QR");
    setBusy(true);
    try {
      const items = cart.map(i => ({ product_id: i.product_id, qty: i.qty }));
      const { data: r } = await axios.post(`${API}/public/orders`, { cafe_id, table_id, customer_name: name, customer_phone: phone, items });
      setPlaced(r); toast.success(`Order #${r.order_no} placed`);
    } catch (e) { toast.error(e.response?.data?.detail || "Could not place order"); }
    finally { setBusy(false); }
  };

  if (err) return <FullMessage title="Oops" body={err}/>;
  if (!data) return <FullMessage title="Loading…" body="Fetching the menu"/>;
  if (placed) return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#ECFDF5] flex items-center justify-center mb-4"><Check className="w-8 h-8 text-[#047857]"/></div>
      <h1 className="font-display text-3xl font-extrabold text-[#2D221E]">Order placed!</h1>
      <p className="text-[#6B5A52] mt-2">Your order <span className="font-mono font-bold text-[#3D271D]">#{placed.order_no}</span> has been sent to the kitchen.</p>
      <p className="text-[#9C8A80] mt-1 tabular">Total {money(placed.total)}</p>
      <button onClick={()=>{setPlaced(null);setCart([]);}} className="btn-coffee mt-8 text-sm">Place another order</button>
      <div className="text-[10px] text-[#9C8A80] mt-16 tracking-widest">POWERED BY PEAN · NEXORAOS</div>
    </div>
  );

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

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
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
                    <button onClick={()=>dec(p.id)} className="w-8 h-8 rounded-lg bg-[#F5ECE1] flex items-center justify-center"><Minus className="w-4 h-4"/></button>
                    <div className="w-6 text-center tabular font-semibold">{inCart.qty}</div>
                    <button onClick={()=>add(p)} className="w-8 h-8 rounded-lg bg-[#3D271D] text-[#FDFBF7] flex items-center justify-center"><Plus className="w-4 h-4"/></button>
                  </div> : <button onClick={()=>add(p)} data-testid={`public-add-${p.id}`} className="px-3.5 py-2 rounded-lg btn-coffee text-xs">Add</button>}
                </div>
              );
            })}
        </div>
      </main>

      {cart.length > 0 && !placed && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8DCCF] shadow-[0_-8px_24px_rgba(45,34,30,0.06)] z-20">
          <div className="max-w-2xl mx-auto p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <div className="text-[#6B5A52]">{cart.reduce((s,i)=>s+i.qty,0)} items</div>
              <div className="tabular font-bold text-lg text-[#C85A32]">{money(total)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Your name (optional)" value={name} onChange={(e)=>setName(e.target.value)} className="input text-sm"/>
              <input placeholder="Phone (optional)" value={phone} onChange={(e)=>setPhone(e.target.value)} className="input text-sm tabular"/>
            </div>
            <button data-testid="public-place-order-button" onClick={place} disabled={busy} className="btn-coffee w-full inline-flex items-center justify-center gap-2 py-3 disabled:opacity-60"><ShoppingBag className="w-4 h-4"/> {busy?"Placing…":"Place Order"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const FullMessage = ({title, body}) => (
  <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6 text-center">
    <div><h1 className="font-display text-2xl font-bold text-[#2D221E]">{title}</h1><p className="text-sm text-[#6B5A52] mt-1">{body}</p></div>
  </div>
);
