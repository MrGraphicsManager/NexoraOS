import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { GoogleLogin } from "@react-oauth/google";
import { AuthShell, Field, Divider } from "./Login";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export default function Signup() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", cafe_name: "", email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const { setTokenAndUser } = useAuth();
  const nav = useNavigate();

  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const sendOtp = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/auth/signup", form); toast.success("OTP sent to your email"); setStep(2); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Signup failed"); }
    finally { setBusy(false); }
  };

  const verify = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.post("/auth/verify-otp", { email: form.email, otp }); await setTokenAndUser(data.token);
      toast.success("Account created 🎉"); nav("/dashboard"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Invalid OTP"); }
    finally { setBusy(false); }
  };

  const googleOk = async (resp) => {
    try {
      const { data } = await api.post("/auth/google", { credential: resp.credential, cafe_name: form.cafe_name || "" });
      await setTokenAndUser(data.token);
      toast.success("Welcome to NexoraOS 🎉"); nav("/dashboard");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Google sign-up failed"); }
  };

  return (
    <AuthShell title={step===1 ? "Create your café" : "Verify your email"} subtitle={step===1 ? "Start with a 14-day free trial." : `We sent a 6-digit code to ${form.email}`}>
      {step === 1 ? (
        <>
          <form onSubmit={sendOtp} className="space-y-4">
            <Field label="Your name"><input data-testid="signup-name-input" required value={form.name} onChange={upd("name")} className="input" placeholder="Priya Kumar"/></Field>
            <Field label="Café name"><input data-testid="signup-cafe-input" required value={form.cafe_name} onChange={upd("cafe_name")} className="input" placeholder="Nexora Café"/></Field>
            <Field label="Email"><input data-testid="signup-email-input" type="email" required value={form.email} onChange={upd("email")} className="input" placeholder="owner@cafe.com"/></Field>
            <Field label="Password (6+ chars)"><input data-testid="signup-password-input" type="password" required minLength={6} value={form.password} onChange={upd("password")} className="input"/></Field>
            <button data-testid="signup-submit-button" disabled={busy} className="btn-coffee w-full disabled:opacity-60">{busy ? "Sending OTP…" : "Send OTP"}</button>
          </form>
          <Divider/>
          <div className="flex justify-center" data-testid="signup-google-button"><GoogleLogin onSuccess={googleOk} onError={()=>toast.error("Google failed")} theme="outline" shape="pill" text="signup_with"/></div>
          <div className="text-sm text-[#6B5A52] text-center mt-5">Already have an account? <Link to="/login" className="text-[#C85A32] font-semibold hover:underline">Sign in</Link></div>
        </>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <Field label="6-digit code"><input data-testid="signup-otp-input" required maxLength={6} pattern="\d{6}" value={otp} onChange={(e)=>setOtp(e.target.value)} className="input tabular text-center text-2xl tracking-[0.5em] font-semibold" placeholder="000000"/></Field>
          <button data-testid="signup-verify-button" disabled={busy} className="btn-coffee w-full disabled:opacity-60">{busy ? "Verifying…" : "Verify & create account"}</button>
          <button type="button" onClick={()=>setStep(1)} className="text-sm text-[#6B5A52] w-full text-center hover:underline">← Change details</button>
        </form>
      )}
    </AuthShell>
  );
}
