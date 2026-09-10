import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LayoutDashboard, ShoppingBag, Grid3x3, ClipboardList, ChefHat, Utensils, Package, Users, Shield, BarChart3, CreditCard, Settings as SettingsIcon, LogOut, Coffee } from "lucide-react";

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
  const { user, cafe, logout } = useAuth();
  const nav = useNavigate();
  const filter = (items) => items.filter((n) => !n.roles || n.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex bg-[#FDFBF7]">
      <aside className="w-64 shrink-0 border-r border-[#E8DCCF] bg-white flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-[#F2E8DC]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3D271D] flex items-center justify-center">
              <Coffee className="w-5 h-5 text-[#FDFBF7]" />
            </div>
            <div>
              <div className="font-display font-bold text-[17px] text-[#2D221E]">NexoraOS</div>
              <div className="text-[10.5px] text-[#9C8A80] font-medium tracking-wide">CAFÉ OPERATIONS</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollable">
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
            <div className="w-9 h-9 rounded-full bg-[#F5ECE1] flex items-center justify-center font-semibold text-[#3D271D]">
              {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[#2D221E] truncate">{user?.name || user?.email}</div>
              <div className="text-[11px] text-[#9C8A80] uppercase tracking-wide font-medium">{user?.role?.replace("_"," ")}</div>
            </div>
            <button data-testid="sidebar-logout-button" onClick={() => { logout(); nav("/login"); }} className="p-2 rounded-lg hover:bg-[#F5ECE1] text-[#6B5A52]" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="text-[10px] text-center text-[#9C8A80] mt-2 tracking-wide">Powered by PEAN</div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
          <Outlet context={{ user, cafe }} />
        </div>
      </main>
    </div>
  );
}
