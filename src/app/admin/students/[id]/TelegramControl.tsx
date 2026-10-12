"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { formatJalaliDateTime } from "@/lib/planning";

type TelegramStatus = {
  connection: { group_connected: boolean; student_connected: boolean; chat_title: string | null; telegram_username: string | null };
  access: { enabled: boolean; suspended: boolean; banned: boolean };
  group: { locked: boolean };
  bot: { reachable: boolean; last_activity_at: string | null; last_error_at: string | null; last_error_message: string | null; last_error_code: string | null; is_locked?: boolean };
};

type AuditEntry = { id: number; actor: string | null; action: string; reason: string; success: boolean; details: unknown; created_at: string };

type PendingAction = { path: string; label: string; needReason: boolean; danger: boolean } | null;

export default function TelegramControl({ studentId, token }: { studentId: string; token: string }) {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(
    () => api<TelegramStatus>(`/admin/students/${studentId}/telegram/`, token),
    [studentId, token],
  );

  const loadAudit = useCallback(async () => {
    try {
      const res = await api<{ results: AuditEntry[] }>(`/admin/students/${studentId}/telegram/audit/`, token);
      setAudit(res.results);
    } catch (e) { setError(errorMessage(e)); }
  }, [studentId, token]);

  useEffect(() => {
    let active = true;
    load().then((result) => { if (active) setStatus(result); })
      .catch((reason) => { if (active) setError(errorMessage(reason)); });
    return () => { active = false; };
  }, [load]);

  async function act(path: string, needReason: boolean, pendingReason?: string) {
    const effectiveReason = pendingReason !== undefined ? pendingReason : reason;
    if (needReason && !effectiveReason.trim()) { setReasonError("دلیل الزامی است."); return; }
    setReasonError("");
    setLoading(path); setError("");
    try {
      await api(path, token, "POST", effectiveReason.trim() ? { reason: effectiveReason.trim() } : {});
      setReason("");
      setStatus(await load());
      if (showAudit) await loadAudit();
      setToast("عملیات با موفقیت انجام شد.");
      setTimeout(()=> setToast(""), 2500);
    } catch (e) { setError(errorMessage(e)); }
    finally { setLoading(null); }
  }

  function confirmAct(path: string, label: string, needReason: boolean, danger: boolean) {
    if (needReason) {
      setPending({ path, label, needReason, danger });
    } else {
      void act(path, false);
    }
  }

  function submitPending() {
    if (!pending) return;
    if (pending.needReason && !reason.trim()) { setReasonError("دلیل الزامی است."); return; }
    const p = pending;
    setPending(null);
    void act(p.path, p.needReason, reason);
  }

  if (!status) return <section><h2 style={{fontWeight:800, color:"#16041E"}}>تلگرام</h2><p>{error || "در حال بارگذاری..."}</p></section>;

  const { connection, access, group, bot } = status;

  return (
    <section style={{display:"grid", gap:".7rem", direction:"rtl"}}>
      <h2 style={{fontWeight:800, color:"#16041E", fontSize:"1rem"}}>تلگرام</h2>
      {toast && <div style={{background:"#ecfdf5", border:"1px solid #a7f3d0", color:"#065f46", padding:".5rem .7rem", borderRadius:".45rem", fontSize:".82rem"}}>{toast}</div>}
      {error && <p role="alert" style={{ color: "#991b1b", background:"#fef2f2", border:"1px solid #fecaca", padding:".5rem .7rem", borderRadius:".45rem", fontSize:".82rem" }}>{error}</p>}
      <div style={{ display: "grid", gap: ".4rem", fontSize: ".85rem", background:"#f8fafc", border:"1px solid #e2e8f0", padding:".6rem", borderRadius:".5rem" }}>
        <div>گروه: {connection.group_connected ? <span style={{color:"#065f46", fontWeight:700}}>✅ متصل{connection.chat_title ? ` — ${connection.chat_title}` : ""}</span> : <span style={{color:"#991b1b"}}>❌ متصل نیست</span>}</div>
        <div>دانش‌آموز: {connection.student_connected ? <span style={{color:"#065f46", fontWeight:700}}>✅ متصل{connection.telegram_username ? ` — @${connection.telegram_username}` : ""}</span> : <span style={{color:"#991b1b"}}>❌ متصل نیست</span>}</div>
        <div>دسترسی: {access.enabled ? <span className="admin-badge ok">فعال</span> : <span className="admin-badge bad">غیرفعال</span>} {access.suspended ? <span className="admin-badge bad" style={{marginInlineStart:".3rem"}}>تعلیق</span> : null} {access.banned ? <span className="admin-badge bad" style={{marginInlineStart:".3rem"}}>بن</span> : null}</div>
        <div>گروه: {group.locked ? <span className="admin-badge bad">قفل</span> : <span className="admin-badge ok">باز</span>}</div>
        <div>آخرین فعالیت: {bot.last_activity_at ? formatJalaliDateTime(bot.last_activity_at) : "—"} · ربات: {bot.reachable ? <span style={{color:"#065f46"}}>متصل</span> : <span style={{color:"#991b1b"}}>قطع</span>}</div>
        {bot.last_error_message && <div style={{color:"#991b1b", fontSize:".8rem"}}>آخرین خطا: {bot.last_error_message}{bot.last_error_at ? ` (${formatJalaliDateTime(bot.last_error_at)})` : ""}{bot.last_error_code ? ` [${bot.last_error_code}]` : ""}</div>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem", marginTop: ".6rem" }}>
        {access.enabled
          ? <button className="tc-btn tc-btn-danger" disabled={!!loading} onClick={() => confirmAct(`/admin/students/${studentId}/telegram/disable/`, "غیرفعال کردن دسترسی", true, true)}>{loading === `/admin/students/${studentId}/telegram/disable/` ? "…" : "غیرفعال کردن"}</button>
          : <button className="tc-btn tc-btn-primary" disabled={!!loading} onClick={() => void act(`/admin/students/${studentId}/telegram/enable/`, false)}>{loading === `/admin/students/${studentId}/telegram/enable/` ? "…" : "فعال کردن"}</button>}
        {access.suspended
          ? <button className="tc-btn tc-btn-primary" disabled={!!loading} onClick={() => void act(`/admin/students/${studentId}/telegram/resume/`, false)}>رفع تعلیق</button>
          : <button className="tc-btn tc-btn-danger" disabled={!!loading} onClick={() => confirmAct(`/admin/students/${studentId}/telegram/suspend/`, "تعلیق", true, true)}>تعلیق</button>}
        {access.banned
          ? <button className="tc-btn tc-btn-primary" disabled={!!loading} onClick={() => void act(`/admin/students/${studentId}/telegram/unban/`, false)}>رفع بن</button>
          : <button className="tc-btn tc-btn-danger" disabled={!!loading} onClick={() => confirmAct(`/admin/students/${studentId}/telegram/ban/`, "بن کردن دانش‌آموز", true, true)}>بن کردن</button>}
        {group.locked
          ? <button className="tc-btn tc-btn-primary" disabled={!!loading} onClick={() => void act(`/admin/students/${studentId}/telegram/group/unlock/`, false)}>باز کردن گروه</button>
          : <button className="tc-btn tc-btn-danger" disabled={!!loading} onClick={() => confirmAct(`/admin/students/${studentId}/telegram/group/lock/`, "قفل گروه", true, true)}>قفل گروه</button>}
        <button className="tc-btn tc-btn-neutral" disabled={!!loading} onClick={() => void act(`/admin/students/${studentId}/telegram/resend-plan/`, false)}>ارسال مجدد برنامه امروز</button>
        <button className="tc-btn tc-btn-neutral" onClick={() => { setShowAudit((v) => !v); if (!showAudit) void loadAudit(); }}>{showAudit ? "بستن تاریخچه" : "مشاهده تاریخچه عملیات"}</button>
      </div>

      <div style={{ display:"grid", gap:".25rem" }}>
        <label style={{fontSize:".8rem", color:"#475569"}}>دلیل عملیات <span style={{color:"#991b1b"}}>* الزامی برای عملیات حساس</span></label>
        <input placeholder="دلیل این عملیات (برای غیرفعال/تعلیق/بن/قفل الزامی)" value={reason} onChange={(e) => { setReason(e.target.value); if(e.target.value.trim()) setReasonError(""); }} style={{ width: "100%", padding: ".45rem .6rem", border:`1px solid ${reasonError?"#fecaca":"#cbd5e1"}`, borderRadius:".4rem", background: reasonError?"#fef2f2":"white" }} />
        {reasonError && <span style={{color:"#991b1b", fontSize:".75rem"}}>{reasonError}</span>}
      </div>

      {pending && (
        <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,.38)", display:"grid", placeItems:"center", zIndex:60, padding:"1rem"}}>
          <div style={{background:"white", borderRadius:".7rem", padding:"1rem", width:"100%", maxWidth:"26rem", display:"grid", gap:".7rem", border:"1px solid #e2e8f0"}}>
            <h3 style={{fontWeight:800, color:"#16041E"}}>تأیید: {pending.label}</h3>
            <p style={{fontSize:".85rem", color:"#475569"}}>این عملیات حساس است. لطفاً دلیل را وارد و تأیید کنید.</p>
            <input autoFocus placeholder="دلیل را وارد کنید" value={reason} onChange={(e)=>{ setReason(e.target.value); if(e.target.value.trim()) setReasonError(""); }} style={{border:`1px solid ${reasonError?"#fecaca":"#cbd5e1"}`, borderRadius:".4rem", padding:".5rem", background: reasonError?"#fef2f2":"white"}}/>
            {reasonError && <span style={{color:"#991b1b", fontSize:".75rem"}}>{reasonError}</span>}
            <div style={{display:"flex", gap:".5rem"}}>
              <button className={pending.danger ? "tc-btn tc-btn-danger" : "tc-btn tc-btn-primary"} disabled={!!loading} onClick={submitPending} style={{flex:1}}>
                {loading ? "…" : "تأیید و اجرا"}
              </button>
              <button className="tc-btn tc-btn-neutral" disabled={!!loading} onClick={()=>{ setPending(null); setReasonError(""); }} style={{flex:1}}>انصراف</button>
            </div>
          </div>
        </div>
      )}

      {showAudit && (
        <div style={{ marginTop: ".6rem", overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: ".8rem", borderCollapse: "collapse" }}>
            <thead><tr><th>زمان</th><th>Admin</th><th>Action</th><th>Result</th><th>Reason</th></tr></thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id}><td>{formatJalaliDateTime(row.created_at)}</td><td>{row.actor || "—"}</td><td>{row.action}</td><td>{row.success ? "✅" : "❌"}</td><td>{row.reason || "—"}</td></tr>
              ))}
              {audit.length === 0 && <tr><td colSpan={5}>موردی یافت نشد.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <style>{`.tc-btn{padding:.4rem .7rem; border-radius:.4rem; border:1px solid transparent; cursor:pointer; font-size:.82rem; font-weight:600} .tc-btn:disabled{opacity:.45; cursor:default} .tc-btn-primary{background:#5B0FAD; color:white; border-color:#5B0FAD} .tc-btn-danger{background:#dc2626; color:white; border-color:#dc2626} .tc-btn-neutral{background:white; color:#334155; border-color:#cbd5e1}`}</style>
    </section>
  );
}
