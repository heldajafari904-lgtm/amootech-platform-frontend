"use client";
import "./mobile.css";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { syncLabel, type MobileStatus } from "./mobile";

export default function StudentMobileStatus({ token, studentId }: { token: string; studentId: string }) {
  const [status, setStatus] = useState<MobileStatus | null>(null);
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api<MobileStatus>(`/students/${studentId}/`, token).then(data => { if (live) { setStatus(data); setMobile(data.mobile || ""); } }).catch(e => { if (live) setError(errorMessage(e)); });
    return () => { live = false; };
  }, [token, studentId]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { setStatus(await api<MobileStatus>(`/students/${studentId}/mobile/`, token, "PATCH", { mobile })); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <section dir="rtl" className="workspace-panel student-mobile-panel"><h2>موبایل و حساب آزمون</h2>
    {!status && !error && <p role="status">در حال دریافت وضعیت…</p>}
    {status && <><p>{status.mobile_verified_at ? "موبایل تأییدشده" : "موبایل تأییدنشده"} · {syncLabel(status.quiz24_sync_status)}</p><p>{status.quiz24_sync_error}</p>
      <form onSubmit={save}><label>شماره موبایل<input type="tel" dir="ltr" inputMode="tel" maxLength={20} value={mobile} onChange={e => setMobile(e.target.value)}/></label><button disabled={busy}>{busy ? "در حال ذخیره…" : "ذخیره شماره"}</button></form>
      <small>ذخیره شماره به‌معنای تأیید نیست؛ دانش‌آموز باید کد تأیید را در پروفایل خود وارد کند.</small></>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
