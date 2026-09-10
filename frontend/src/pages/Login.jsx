import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Coffee } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { formatApiErrorDetail } from "../lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      nav("/dashboard");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Login failed");
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Sign in to NexoraOS" subtitle="Café operations, simplified.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input data-testid="login-email-input" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)}
            className="input" placeholder="you@cafe.com" />
        </Field>
        <Field label="Password">
          <input data-testid="login-password-input" type="password" required value={password} onChange={(e)=>setPassword(e.target.value)}
            className="input" placeholder="••••••••" />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" data-testid="login-forgot-link" className="text-xs text-[#C85A32] hover:underline font-medium">Forgot password?</Link>
        </div>
        <button data-testid="login-submit-button" disabled={busy} className="btn-coffee w-full disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <div className="mt-6 text-sm text-[#6B5A52] text-center">
        New to NexoraOS? <Link to="/signup" data-testid="login-signup-link" className="text-[#C85A32] font-semibold hover:underline">Create account</Link>
      </div>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-[#FDFBF7] grain flex items-center justify-center p-6">
      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#3D271D] flex items-center justify-center"><Coffee className="w-5 h-5 text-[#FDFBF7]"/></div>
          <div className="font-display font-bold text-xl">NexoraOS</div>
        </Link>
        <div className="card p-8">
          <h1 className="font-display text-2xl font-bold text-[#2D221E]">{title}</h1>
          <p className="text-sm text-[#6B5A52] mt-1 mb-6">{subtitle}</p>
          {children}
        </div>
        <div className="text-center text-xs text-[#9C8A80] mt-6">Powered by PEAN</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-[#6B5A52] mb-1.5 uppercase tracking-wide">{label}</div>
      {children}
    </label>
  );
}

// shared input style
const style = document.createElement("style");
style.textContent = `.input { width:100%; padding:11px 14px; border:1px solid #E8DCCF; border-radius:10px; background:white; font-size:14px; outline:none; transition: border-color .15s; }
.input:focus { border-color:#3D271D; box-shadow: 0 0 0 3px rgba(61,39,29,0.08); }`;
if (typeof document !== "undefined" && !document.getElementById("nx-input-style")) { style.id = "nx-input-style"; document.head.appendChild(style); }
