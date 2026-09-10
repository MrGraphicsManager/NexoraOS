import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Store, Receipt, LogOut, Shield, Menu, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const NAV = [
  { to: "/nexoraosadmin/dashboard", icon: LayoutDashboard, label: "Overview" },
  { to: "/nexoraosadmin/cafes", icon: Store, label: "Cafés" },
  { to: "/nexoraosadmin/invoices", icon: Receipt, label: "Invoices" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [drawer, setDrawer] = useState(false);
  useEffect(()=>{ setDrawer(false); }, [loc.pathname]);

  const Sidebar = (
    <>
      <div className="px-5 py-5 border-b border-[#3D312A] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#E8C8B5] flex items-center justify-center"><Shield className="w-5 h-5 text-[#1A1412]"/></div>
          <div><div className="font-display font-bold text-[17px]">NexoraOS</div><div className="text-[10.5px] text-[#9E8E81] font-medium tracking-wide">ADMIN CONSOLE</div></div>
        </div>
        <button onClick={()=>setDrawer(false)} className="lg:hidden p-2 rounded-lg hover:bg-[#2E2521]"><X className="w-5 h-5"/></button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} data-testid={`admin-nav-${n.label.toLowerCase()}`}
            className={({isActive}) => `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium ${isActive ? "bg-[#E8C8B5] text-[#1A1412]" : "text-[#D1C4B8] hover:bg-[#2E2521]"}`}>
            <n.icon className="w-4 h-4"/><span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-[#3D312A]">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-full bg-[#3D312A] flex items-center justify-center font-semibold">{user?.name?.charAt(0) || "A"}</div>
          <div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{user?.name}</div><div className="text-[10px] text-[#9E8E81] uppercase tracking-wide">Admin</div></div>
          <button data-testid="admin-logout-button" onClick={()=>{logout();nav("/nexoraosadmin");}} className="p-2 rounded-lg hover:bg-[#2E2521] text-[#9E8E81]"><LogOut className="w-4 h-4"/></button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-[#1A1412] text-[#F7F2EC]">
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-[#3D312A] bg-[#241D1A] flex-col sticky top-0 h-screen">{Sidebar}</aside>
      {drawer && <div className="lg:hidden fixed inset-0 z-50 flex">
        <div className="absolute inset-0 bg-black/60" onClick={()=>setDrawer(false)}/>
        <aside className="relative w-72 max-w-[85vw] bg-[#241D1A] border-r border-[#3D312A] flex flex-col">{Sidebar}</aside>
      </div>}
      <main className="flex-1 min-w-0">
        <div className="lg:hidden sticky top-0 z-30 bg-[#241D1A]/95 backdrop-blur border-b border-[#3D312A] px-4 py-3 flex items-center justify-between">
          <button onClick={()=>setDrawer(true)} className="p-1.5 -ml-1.5"><Menu className="w-6 h-6"/></button>
          <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-[#E8C8B5]"/><span className="font-display font-bold text-[15px]">Admin</span></div>
          <div className="w-8"/>
        </div>
        <div className="max-w-[1500px] mx-auto p-4 sm:p-6 lg:p-8"><Outlet/></div>
      </main>
    </div>
  );
}
