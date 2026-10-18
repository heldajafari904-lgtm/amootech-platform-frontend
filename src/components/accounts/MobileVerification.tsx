"use client";
import "./mobile.css";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { canRetrySync, syncLabel, normalizeOTPInput, type MobileStatus } from "./mobile";

export default function MobileVerification({ token }: { token: string }) {
  const [status, setStatus] = useState<MobileStatus | null>(null);
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    api<MobileStatus>("/auth/profile/student/", token).then(data => { if (live) { setStatus(data); setMobile(data.mobile || ""); } }).catch(e => { if (live) setError(errorMessage(e)); });
    return () => { live = false; };
  }, [token]);
  async function act(action: "request" | "verify" | "sync") {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (action === "request") {
        await api("/auth/mobile/request/", token, "POST", { mobile });
        setSent(true); setCode(""); setNotice("کد تأیید ارسال شد؛ تا پنج دقیقه معتبر است. ارسال دوباره پس از یک دقیقه امکان‌پذیر است.");
        setStatus(await api<MobileStatus>("/auth/profile/student/", token));
      } else {
        const data = await api<MobileStatus>(action === "verify" ? "/auth/mobile/verify/" : "/auth/quiz24/sync/", token, "POST", action === "verify" ? { code } : {});
        setStatus(data);
        if (action === "verify") { setSent(false); setCode(""); setNotice("شماره موبایل تأیید شد."); }
      }
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <section dir="rtl" className="workspace-panel student-mobile-panel" aria-labelledby="mobile-verification-heading">
    <h2 id="mobile-verification-heading">شماره موبایل و اتصال آزمون</h2>
    {!status && !error && <p role="status">در حال دریافت وضعیت…</p>}
    {status && <><p>موبایل: {status.mobile_verified_at ? "تأییدشده" : "تأییدنشده"} · حساب آزمون: {syncLabel(status.quiz24_sync_status)}</p>
      {status.quiz24_sync_error && <p role="status">{status.quiz24_sync_error}</p>}
      <form onSubmit={e => { e.preventDefault(); void act("request"); }}>
        <fieldset disabled={busy}><label>شماره موبایل<input type="tel" dir="ltr" inputMode="tel" autoComplete="tel" maxLength={20} required value={mobile} onChange={e => { setMobile(e.target.value); setSent(false); setCode(""); }}/></label>
          <p>تغییر شماره نیازمند تأیید دوباره است. نام کاربری حساب آزمون از شماره تأییدشده شما تعیین می‌شود.</p>
          <button disabled={busy || (!!status.mobile_verified_at && mobile === status.mobile)}>{busy ? "در حال بررسی…" : "دریافت کد تأیید"}</button></fieldset>
      </form>
      {sent && <form onSubmit={e => { e.preventDefault(); void act("verify"); }}><label>کد تأیید<input type="text" dir="ltr" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={e => setCode(normalizeOTPInput(e.target.value))}/></label><button disabled={busy}>تأیید شماره و اتصال حساب آزمون</button></form>}
      {canRetrySync(status) && <><button disabled={busy} onClick={() => void act("sync")}>بررسی و تلاش مجدد اتصال آزمون</button><small>بین تلاش‌های اتصال یک دقیقه فاصله لازم است.</small></>}
    </>}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
