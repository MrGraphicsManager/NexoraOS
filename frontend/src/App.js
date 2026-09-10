import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./App.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Tables from "./pages/Tables";
import Orders from "./pages/Orders";
import Kitchen from "./pages/Kitchen";
import Menu from "./pages/Menu";
import Inventory from "./pages/Inventory";
import Customers from "./pages/Customers";
import Staff from "./pages/Staff";
import Reports from "./pages/Reports";
import Subscription from "./pages/Subscription";
import Settings from "./pages/Settings";
import PublicOrder from "./pages/PublicOrder";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCafes from "./pages/admin/AdminCafes";
import AdminCafeDetail from "./pages/admin/AdminCafeDetail";
import AdminInvoices from "./pages/admin/AdminInvoices";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#6B5A52]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/nexoraosadmin/dashboard" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AdminProtected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#6B5A52]">Loading…</div>;
  if (!user || user.role !== "admin") return <Navigate to="/nexoraosadmin" replace />;
  return children;
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/order" element={<PublicOrder />} />

            {/* Admin */}
            <Route path="/nexoraosadmin" element={<AdminLogin />} />
            <Route element={<AdminProtected><AdminLayout /></AdminProtected>}>
              <Route path="/nexoraosadmin/dashboard" element={<AdminDashboard />} />
              <Route path="/nexoraosadmin/cafes" element={<AdminCafes />} />
              <Route path="/nexoraosadmin/cafes/:id" element={<AdminCafeDetail />} />
              <Route path="/nexoraosadmin/invoices" element={<AdminInvoices />} />
            </Route>

            {/* Main app */}
            <Route element={<Protected><Layout /></Protected>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/pos" element={<Protected roles={["owner","manager","cashier"]}><POS /></Protected>} />
              <Route path="/tables" element={<Protected roles={["owner","manager","cashier"]}><Tables /></Protected>} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/kitchen" element={<Kitchen />} />
              <Route path="/menu" element={<Protected roles={["owner","manager"]}><Menu /></Protected>} />
              <Route path="/inventory" element={<Protected roles={["owner","manager"]}><Inventory /></Protected>} />
              <Route path="/customers" element={<Protected roles={["owner","manager","cashier"]}><Customers /></Protected>} />
              <Route path="/staff" element={<Protected roles={["owner","manager"]}><Staff /></Protected>} />
              <Route path="/reports" element={<Protected roles={["owner","manager"]}><Reports /></Protected>} />
              <Route path="/subscription" element={<Protected roles={["owner"]}><Subscription /></Protected>} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
