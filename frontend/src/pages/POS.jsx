import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, money, formatApiErrorDetail } from "../lib/api";
import { Search, Plus, Minus, Trash2, X, Printer, CreditCard, Coffee } from "lucide-react";

const PAYMENTS = [{k:"cash",label:"Cash"},{k:"upi",label:"UPI"},{k:"card",label:"Card"}];
const TYPES = [{k:"dine_in",label:"Dine-in"},{k:"takeaway",label:"Takeaway"},{k:"delivery",label:"Delivery"}];

export default function POS() {
  const qc = useQueryClient();
  const { data: products=[] } = useQuery({ queryKey:["products"], queryFn: async () => (await api.get("/products")).data });
  const { data: categories=[] } = useQuery({ queryKey:["categories"], queryFn: async () => (await api.get("/categories")).data });
  const { data: tables=[] } = useQuery({ queryKey:["tables"], queryFn: async () => (await api.get("/tables")).data });
  const { data: customers=[] } = useQuery({ queryKey:["customers"], queryFn: async () => (await api.get("/customers")).data });

  const [activeCat, setActiveCat] = useState("all");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState("dine_in");
  const [tableId, setTableId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState("cash");
  const [invoice, setInvoice] = useState(null);

  const filtered = useMemo(() => products.filter(p => p.available !== false)
    .filter(p => activeCat === "all" || p.category_id === activeCat)
    .filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase())), [products, activeCat, q]);

  const add = (p) => setCart(c => {
    const ex = c.find(i => i.product_id === p.id);
    if (ex) return c.map(i => i.product_id === p.id ? { ...i, qty: i.qty+1 } : i);
    return [...c, { product_id: p.id, name: p.name, price: p.price, qty: 1 }];
  });
  const dec = (id) => setCart(c => c.flatMap(i => i.product_id!==id ? [i] : (i.qty>1 ? [{...i, qty:i.qty-1}] : [])));
  const rm = (id) => setCart(c => c.filter(i => i.product_id !== id));

  const subtotal = cart.reduce((s,i) => s + i.price*i.qty, 0);
  const taxRate = 5;
  const tax = Math.max(0, (subtotal - discount) * taxRate / 100);
  const total = Math.max(0, subtotal - discount + tax);

  const place = async (withPayment) => {
    if (!cart.length) return toast.error("Cart is empty");
    if (orderType === "dine_in" && !tableId) return toast.error("Select a table for dine-in");
    try {
      const body = { items: cart, order_type: orderType, table_id: tableId || null,
        customer_id: customerId || null, discount, tax_rate: taxRate,
        payment_method: withPayment ? payment : null };
      const { data } = await api.post("/orders", body);
      toast.success(withPayment ? `Order #${data.order_no} paid & sent` : `Order #${data.order_no} sent to kitchen`);
      qc.invalidateQueries();
      if (withPayment) { setInvoice(data); }
      else { setCart([]); setTableId(""); setCustomerId(""); setDiscount(0); }
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const newOrder = () => { setInvoice(null); setCart([]); setTableId(""); setCustomerId(""); setDiscount(0); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6" data-testid="pos-page">
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Point of Sale</h1>
          <p className="text-sm text-[#6B5A52]">Tap to add items. Send to kitchen, or take payment.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9C8A80]"/>
          <input data-testid="pos-search-input" value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search menu…" className="input pl-10"/>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollable">
          <button onClick={()=>setActiveCat("all")} data-testid="pos-category-all" className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeCat==="all"?"bg-[#3D271D] text-[#FDFBF7]":"bg-white border border-[#E8DCCF] text-[#2D221E]"}`}>All</button>
          {categories.map(c => (
            <button key={c.id} onClick={()=>setActiveCat(c.id)} data-testid={`pos-category-${c.name.toLowerCase().replace(/\s+/g,"-")}`} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${activeCat===c.id?"bg-[#3D271D] text-[#FDFBF7]":"bg-white border border-[#E8DCCF] text-[#2D221E]"}`}>{c.name}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(p => (
            <button key={p.id} data-testid={`pos-product-${p.id}`} onClick={()=>add(p)} className="card p-4 text-left hover:border-[#3D271D] transition">
              <div className="w-10 h-10 rounded-lg bg-[#F5ECE1] flex items-center justify-center mb-2 font-display font-bold text-[#3D271D]">{p.name.charAt(0)}</div>
              <div className="text-sm font-semibold text-[#2D221E] leading-tight line-clamp-2">{p.name}</div>
              <div className="tabular text-sm text-[#C85A32] font-bold mt-1">{money(p.price)}</div>
            </button>
          ))}
          {!filtered.length && <div className="col-span-full text-center text-sm text-[#9C8A80] py-12">No products. <a href="/menu" className="text-[#C85A32] font-medium">Add some →</a></div>}
        </div>
      </div>
      <aside className="card p-5 flex flex-col h-fit sticky top-6 max-h-[calc(100vh-3rem)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-lg">Cart</h3>
          {cart.length>0 && <button onClick={()=>setCart([])} className="text-xs text-[#B91C1C] font-medium">Clear</button>}
        </div>
        <div className="grid grid-cols-3 gap-1 mb-3">
          {TYPES.map(t => <button key={t.k} onClick={()=>setOrderType(t.k)} data-testid={`pos-type-${t.k}`} className={`text-xs py-2 rounded-lg font-medium ${orderType===t.k?"bg-[#3D271D] text-[#FDFBF7]":"bg-[#F5ECE1] text-[#2D221E]"}`}>{t.label}</button>)}
        </div>
        {orderType==="dine_in" && (
          <select data-testid="pos-table-select" value={tableId} onChange={(e)=>setTableId(e.target.value)} className="input mb-2 text-sm">
            <option value="">Select table…</option>
            {tables.filter(t=>t.status!=="occupied"||t.id===tableId).map(t => <option key={t.id} value={t.id}>Table {t.number} · {t.capacity} seats</option>)}
          </select>
        )}
        <select data-testid="pos-customer-select" value={customerId} onChange={(e)=>setCustomerId(e.target.value)} className="input mb-3 text-sm">
          <option value="">Walk-in customer</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
        </select>
        <div className="flex-1 min-h-0 overflow-y-auto scrollable -mx-1 px-1">
          {cart.length===0 ? <div className="text-sm text-[#9C8A80] py-8 text-center">Empty cart</div> :
            cart.map(i => (
              <div key={i.product_id} className="flex items-center gap-2 py-2 border-b border-[#F2E8DC]">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{i.name}</div>
                  <div className="text-xs text-[#9C8A80] tabular">{money(i.price)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={()=>dec(i.product_id)} className="w-7 h-7 rounded-lg bg-[#F5ECE1] flex items-center justify-center"><Minus className="w-3.5 h-3.5"/></button>
                  <div className="w-6 text-center tabular font-semibold text-sm">{i.qty}</div>
                  <button onClick={()=>{const p=products.find(x=>x.id===i.product_id); if(p) add(p);}} data-testid={`pos-inc-${i.product_id}`} className="w-7 h-7 rounded-lg bg-[#3D271D] text-[#FDFBF7] flex items-center justify-center"><Plus className="w-3.5 h-3.5"/></button>
                  <button onClick={()=>rm(i.product_id)} className="w-7 h-7 rounded-lg text-[#B91C1C] flex items-center justify-center"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              </div>
            ))}
        </div>
        <div className="pt-3 border-t border-[#F2E8DC] space-y-1.5 text-sm">
          <div className="flex justify-between text-[#6B5A52]"><span>Subtotal</span><span className="tabular">{money(subtotal)}</span></div>
          <div className="flex justify-between items-center text-[#6B5A52]"><span>Discount</span>
            <input type="number" min={0} value={discount} onChange={(e)=>setDiscount(Math.max(0,+e.target.value||0))} data-testid="pos-discount-input" className="input py-1 px-2 text-right w-24 text-sm tabular"/></div>
          <div className="flex justify-between text-[#6B5A52]"><span>Tax ({taxRate}%)</span><span className="tabular">{money(tax)}</span></div>
          <div className="flex justify-between text-lg font-bold pt-1.5 border-t border-[#F2E8DC]"><span>Total</span><span className="tabular text-[#C85A32]" data-testid="pos-total">{money(total)}</span></div>
        </div>
        <div className="grid grid-cols-3 gap-1 mt-3">
          {PAYMENTS.map(p => <button key={p.k} onClick={()=>setPayment(p.k)} data-testid={`pos-payment-${p.k}`} className={`text-xs py-2 rounded-lg font-medium ${payment===p.k?"bg-[#C85A32] text-white":"bg-[#F5ECE1] text-[#2D221E]"}`}>{p.label}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={()=>place(false)} data-testid="pos-send-kitchen-button" className="px-4 py-3 rounded-lg border border-[#E8DCCF] text-sm font-semibold">Send to Kitchen</button>
          <button onClick={()=>place(true)} data-testid="pos-pay-button" className="btn-coffee text-sm inline-flex items-center justify-center gap-2"><CreditCard className="w-4 h-4"/> Pay & Complete</button>
        </div>
      </aside>

      {invoice && <InvoiceModal invoice={invoice} onClose={newOrder}/>}
    </div>
  );
}

function InvoiceModal({invoice, onClose}) {
  const print = () => window.print();
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="pos-invoice-modal">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-[#F2E8DC]">
          <div className="flex items-center gap-2"><Coffee className="w-5 h-5 text-[#3D271D]"/><h3 className="font-display font-bold text-lg">Invoice</h3></div>
          <button onClick={onClose}><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6" id="invoice-content">
          <div className="text-center mb-4">
            <div className="font-display font-bold text-xl">NexoraOS Café</div>
            <div className="text-xs text-[#9C8A80]">Tax Invoice · Order #{invoice.order_no}</div>
            <div className="text-xs text-[#9C8A80] tabular">{new Date(invoice.created_at).toLocaleString()}</div>
          </div>
          <div className="space-y-1.5 text-sm border-y border-[#F2E8DC] py-3">
            {invoice.items.map((i,idx) => (
              <div key={idx} className="flex justify-between">
                <div><span className="tabular">{i.qty}×</span> {i.name}</div>
                <div className="tabular">{money(i.price*i.qty)}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1 text-sm mt-3">
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular">{money(invoice.subtotal)}</span></div>
            {invoice.discount>0 && <div className="flex justify-between text-[#B91C1C]"><span>Discount</span><span className="tabular">-{money(invoice.discount)}</span></div>}
            <div className="flex justify-between"><span>Tax</span><span className="tabular">{money(invoice.tax)}</span></div>
            <div className="flex justify-between font-bold pt-2 border-t border-[#F2E8DC] text-base"><span>Total</span><span className="tabular text-[#C85A32]">{money(invoice.total)}</span></div>
            <div className="flex justify-between text-xs text-[#9C8A80] pt-1"><span>Payment</span><span className="uppercase">{invoice.payment_method}</span></div>
          </div>
          <div className="text-center text-[10px] text-[#9C8A80] mt-6">Thank you! · Powered by NexoraOS</div>
        </div>
        <div className="p-4 border-t border-[#F2E8DC] flex gap-2">
          <button onClick={print} className="flex-1 px-4 py-2.5 rounded-lg border border-[#E8DCCF] text-sm font-medium inline-flex items-center justify-center gap-2"><Printer className="w-4 h-4"/> Print</button>
          <button onClick={onClose} data-testid="pos-invoice-new-order" className="flex-1 btn-coffee text-sm">New Order</button>
        </div>
      </div>
    </div>
  );
}
