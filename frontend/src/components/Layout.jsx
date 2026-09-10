import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { api, formatApiErrorDetail } from "../lib/api";
import { LayoutDashboard, ShoppingBag, Grid3x3, ClipboardList, ChefHat, Utensils, Package, Users, Shield, BarChart3, CreditCard, Settings as SettingsIcon, LogOut, Coffee, ChevronDown, Plus, Check, Building2 } from "lucide-react";

const NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", testid: "sidebar-nav-dashboard" },
  { to: "/pos", icon: ShoppingBag, label: "POS", testid: "sidebar-nav-pos", roles: ["owner","manager","cashier"] },
  { to: "/tables", icon: Grid3x3, label: "Tables", testid: "sidebar-nav-tables", roles: ["owner","manager","cashier"] },
  { to: "/orders", icon: ClipboardList, label: "Orders", testid: "sidebar-nav-orders" },
  { to: "/kitchen", icon: ChefHat, label: "Kitchen", testid: "sidebar-nav-kitchen" },
  { to: "/menu", icon: Utensils, label: "Menu", testid: "sidebar-nav-menu", roles: ["owner","manager"] },
  { to: "/inventory", icon: Package, label: "Inventory", testid: "sidebar-nav-inventory", roles: ["owner","manager"] },
  { to: "/customers", icon: Users, label: "Customers", testid: "sidebar-nav-customers", roles: ["owner","manager","cashier"] },
  { to: "/staff", icon: Shield, label: "Staff", testid: "sidebar-nav-staff", roles: ["owner","manager"] },
  { to: "/reports", icon: BarChart3, label: "Reports", testid: "sidebar-nav-reports", roles: ["owner","manager"] },
];
const BOTTOM = [
  { to: "/subscription", icon: CreditCard, label: "Subscription", testid: "sidebar-nav-subscription", roles: ["owner"] },
  { to: "/settings", icon: SettingsIcon, label: "Settings", testid: "sidebar-nav-settings" },
];

export default function Layout() {
  const { user, cafe, logout, refresh, setTokenAndUser } = useAuth();
  const nav = useNavigate();
  const filter = (items) => items.filter((n) => !n.roles || n.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex bg-[#FDFBF7]">
      <aside className="w-64 shrink-0 border-r border-[#E8DCCF] bg-white flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-[#F2E8DC]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3D271D] flex items-center justify-center"><Coffee className="w-5 h-5 text-[#FDFBF7]"/></div>
            <div>
              <div className="font-display font-bold text-[17px] text-[#2D221E]">NexoraOS</div>
              <div className="text-[10.5px] text-[#9C8A80] font-medium tracking-wide">CAFÉ OPERATIONS</div>
            </div>
          </div>
        </div>

        <CafeSwitcher user={user} cafe={cafe} onSwitched={async (token)=>{ await setTokenAndUser(token); window.location.reload(); }}/>

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto scrollable">
          {filter(NAV).map((n) => (
            <NavLink key={n.to} to={n.to} data-testid={n.testid} className={({isActive}) => `sidebar-link ${isActive ? "active" : ""}`}>
              <n.icon className="w-4.5 h-4.5" size={17}/> <span>{n.label}</span>
            </NavLink>
          ))}
          <div className="pt-3 mt-3 border-t border-[#F2E8DC] space-y-0.5">
            {filter(BOTTOM).map((n) => (
              <NavLink key={n.to} to={n.to} data-testid={n.testid} className={({isActive}) => `sidebar-link ${isActive ? "active" : ""}`}>
                <n.icon className="w-4.5 h-4.5" size={17}/> <span>{n.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="p-3 border-t border-[#F2E8DC]">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-[#F5ECE1] flex items-center justify-center font-semibold text-[#3D271D]">{(user?.name || user?.email || "?").charAt(0).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-[#2D221E] truncate">{user?.name || user?.email}</div><div className="text-[11px] text-[#9C8A80] uppercase tracking-wide font-medium">{user?.role?.replace("_"," ")}</div></div>
            <button data-testid="sidebar-logout-button" onClick={() => { logout(); nav("/login"); }} className="p-2 rounded-lg hover:bg-[#F5ECE1] text-[#6B5A52]" title="Logout"><LogOut className="w-4 h-4" /></button>
          </div>
          <div className="text-[10px] text-center text-[#9C8A80] mt-2 tracking-wide">Powered by PEAN</div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="max-w-[1600px] mx-auto p-6 lg:p-8"><Outlet context={{ user, cafe }} /></div>
      </main>
    </div>
  );
}

function CafeSwitcher({ user, cafe, onSwitched }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const { data } = await api.get("/cafes/mine"); setData(data); }
    catch { setData({ cafes: [cafe].filter(Boolean), current_id: cafe?.id, max_cafes: 1, is_pro: false }); }
  };
  useEffect(() => { load(); }, [cafe?.id]);

  const switchTo = async (cid) => {
    if (cid === user?.cafe_id) { setOpen(false); return; }
    try { const { data } = await api.post("/cafes/switch", { cafe_id: cid }); toast.success("Switched café"); setOpen(false); onSwitched(data.token); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const create = async () => {
    setBusy(true);
    try { await api.post("/cafes", { name: newName }); toast.success("Café created"); setNewName(""); setShowAdd(false); await load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const cafes = data?.cafes || [];
  const canAdd = user?.role === "owner" && (cafes.length < (data?.max_cafes || 1));
  if (cafes.length <= 1 && user?.role !== "owner") return null;

  return (
    <div className="px-3 pt-3 pb-1 relative">
      <button onClick={()=>setOpen(o=>!o)} data-testid="cafe-switcher-button" className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#F5ECE1] hover:bg-[#EFE3D2] transition">
        <div className="w-7 h-7 rounded-md bg-[#3D271D] flex items-center justify-center text-[#FDFBF7] text-xs font-bold shrink-0">{(cafe?.name || "C").charAt(0).toUpperCase()}</div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[13px] font-semibold text-[#2D221E] truncate">{cafe?.name || "Café"}</div>
          <div className="text-[10px] text-[#9C8A80] uppercase tracking-wide font-medium">{data?.is_pro ? "PRO · Multi-café" : `${cafes.length}/${data?.max_cafes || 1} café`}</div>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#6B5A52] transition ${open?"rotate-180":""}`}/>
      </button>
      {open && (
        <div className="absolute left-3 right-3 top-[calc(100%-4px)] card p-1.5 z-30 shadow-lg">
          {cafes.map(c => (
            <button key={c.id} onClick={()=>switchTo(c.id)} data-testid={`cafe-switch-${c.id}`} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-sm ${c.id===user?.cafe_id?"bg-[#F5ECE1]":"hover:bg-[#FDFBF7]"}`}>
              <Building2 className="w-3.5 h-3.5 text-[#6B5A52]"/>
              <span className="flex-1 truncate">{c.name}</span>
              {c.id === user?.cafe_id && <Check className="w-3.5 h-3.5 text-[#047857]"/>}
            </button>
          ))}
          <div className="mt-1 border-t border-[#F2E8DC] pt-1">
            {canAdd ? (
              !showAdd ? <button onClick={()=>setShowAdd(true)} data-testid="cafe-add-button" className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-medium text-[#C85A32] hover:bg-[#FEF3EC]"><Plus className="w-3.5 h-3.5"/> Add café</button>
              : <div className="p-1.5 space-y-1.5">
                  <input autoFocus value={newName} onChange={(e)=>setNewName(e.target.value)} placeholder="New café name" className="input py-1.5 text-sm"/>
                  <div className="flex gap-1"><button onClick={()=>{setShowAdd(false);setNewName("");}} className="flex-1 py-1 text-xs rounded-md border border-[#E8DCCF]">Cancel</button><button onClick={create} disabled={!newName || busy} data-testid="cafe-create-button" className="flex-1 py-1 text-xs rounded-md btn-coffee disabled:opacity-50">{busy?"…":"Create"}</button></div>
                </div>
            ) : user?.role === "owner" && !data?.is_pro && cafes.length >= 1 ? (
              <div className="px-2.5 py-2 text-[11px] text-[#9C8A80]">Upgrade to <a href="/subscription" className="text-[#C85A32] font-semibold">Pro Plan</a> to add more cafés.</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
