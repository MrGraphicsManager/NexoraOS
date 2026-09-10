import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthShell, Field } from "./Login";
import { api, formatApiErrorDetail } from "../lib/api";

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      toast.success("If that email is registered, an OTP has been sent");
      setStep(2);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Failed");
    } finally { setBusy(false); }
  };

  const reset = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { email, otp, new_password: pw });
      toast.success("Password reset. Please sign in.");
      nav("/login");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Reset password" subtitle={step===1 ? "We'll email you a 6-digit code." : `Enter the code sent to ${email}`}>
      {step === 1 ? (
        <form onSubmit={send} className="space-y-4">
          <Field label="Email"><input data-testid="forgot-email-input" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} className="input"/></Field>
          <button data-testid="forgot-submit-button" disabled={busy} className="btn-coffee w-full disabled:opacity-60">{busy ? "Sending…" : "Send OTP"}</button>
          <div className="text-sm text-center"><Link to="/login" className="text-[#C85A32] font-semibold hover:underline">← Back to sign in</Link></div>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4">
          <Field label="6-digit code"><input data-testid="forgot-otp-input" maxLength={6} required value={otp} onChange={(e)=>setOtp(e.target.value)} className="input tabular text-center text-2xl tracking-[0.5em]"/></Field>
          <Field label="New password"><input data-testid="forgot-newpassword-input" type="password" required minLength={6} value={pw} onChange={(e)=>setPw(e.target.value)} className="input"/></Field>
          <button data-testid="forgot-reset-button" disabled={busy} className="btn-coffee w-full disabled:opacity-60">{busy ? "Resetting…" : "Reset password"}</button>
        </form>
      )}
    </AuthShell>
  );
}
