import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { formatApiErrorDetail } from "../../lib/api";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const u = await login(email, password);
      if (u.role !== "admin") { toast.error("Admin credentials required"); return; }
      toast.success("Signed in"); nav("/nexoraosadmin/dashboard");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Login failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#1A1412] grain flex items-center justify-center p-6">
      <div className="w-full max-w-md relative z-10">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#E8C8B5] flex items-center justify-center"><Shield className="w-5 h-5 text-[#1A1412]"/></div>
          <div className="font-display font-bold text-xl text-[#F7F2EC]">NexoraOS Admin</div>
        </div>
        <div className="bg-[#241D1A] border border-[#3D312A] rounded-2xl p-8">
          <h1 className="font-display text-2xl font-bold text-[#F7F2EC]">Sign in</h1>
          <p className="text-sm text-[#9E8E81] mt-1 mb-6">Restricted access · Admin only.</p>
          <form onSubmit={submit} className="space-y-4">
            <label className="block"><div className="text-xs font-semibold text-[#D1C4B8] mb-1.5 uppercase tracking-wide">Email</div>
              <input data-testid="admin-email-input" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg bg-[#1A1412] border border-[#3D312A] text-[#F7F2EC] outline-none focus:border-[#E8C8B5]" placeholder="admin@…"/>
            </label>
            <label className="block"><div className="text-xs font-semibold text-[#D1C4B8] mb-1.5 uppercase tracking-wide">Password</div>
              <input data-testid="admin-password-input" type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg bg-[#1A1412] border border-[#3D312A] text-[#F7F2EC] outline-none focus:border-[#E8C8B5]" placeholder="••••••••"/>
            </label>
            <button data-testid="admin-login-submit" disabled={busy} className="w-full py-3 rounded-lg bg-[#E8C8B5] text-[#1A1412] font-semibold disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        </div>
        <div className="text-center text-xs text-[#6B5A52] mt-6">NexoraOS · Powered by PEAN</div>
      </div>
    </div>
  );
}
