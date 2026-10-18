"use client";
import "./mobile.css";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";

export default function StudentAccountForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [form, setForm] = useState({ username: "", password: "", first_name: "", last_name: "", mobile: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { await api("/students/", token, "POST", form); setForm({ username: "", password: "", first_name: "", last_name: "", mobile: "" }); onCreated(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <details dir="rtl" className="student-mobile-panel"><summary>افزودن دانش‌آموز</summary><form onSubmit={submit}><fieldset disabled={busy}>
    {([['username', 'نام کاربری'], ['password', 'رمز عبور'], ['first_name', 'نام'], ['last_name', 'نام خانوادگی'], ['mobile', 'شماره موبایل (اختیاری)']] as const).map(([key, label]) => <label key={key}>{label}<input type={key === "password" ? "password" : key === "mobile" ? "tel" : "text"} required={key !== "mobile"} autoComplete={key === "password" ? "new-password" : "off"} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}/></label>)}
    <p>شماره پس از تأیید توسط خود دانش‌آموز به حساب آزمون متصل می‌شود.</p><button disabled={busy}>ساخت حساب</button>
    </fieldset></form>{error && <p role="alert">{error}</p>}</details>;
}
