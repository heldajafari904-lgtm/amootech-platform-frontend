"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";

type TelegramStatus = {
  connection: { group_connected: boolean; student_connected: boolean; chat_title: string | null; telegram_username: string | null };
  access: { enabled: boolean; suspended: boolean; banned: boolean };
  group: { locked: boolean };
  bot: { reachable: boolean; last_activity_at: string | null; last_error_at: string | null; last_error_message: string | null; last_error_code: string | null; is_locked?: boolean };
};

type AuditEntry = { id: number; actor: string | null; action: string; reason: string; success: boolean; details: unknown; created_at: string };

export default function TelegramControl({ studentId, token }: { studentId: string; token: string }) {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api<TelegramStatus>(`/admin/students/${studentId}/telegram/`, token);
      setStatus(s);
    } catch (e) { setError(errorMessage(e)); }
  }, [studentId, token]);

  const loadAudit = useCallback(async () => {
    try {
      const res = await api<{ results: AuditEntry[] }>(`/admin/students/${studentId}/telegram/audit/`, token);
      setAudit(res.results);
    } catch (e) { setError(errorMessage(e)); }
  }, [studentId, token]);

  useEffect(() => { void load(); }, [load]);

  async function act(path: string, needReason: boolean) {
    if (needReason && !reason.trim()) { setError("دلیل را وارد کنید."); return; }
    setLoading(path); setError("");
    try {
      await api(path, token, "POST", reason.trim() ? { reason: reason.trim() } : {});
      setReason("");
      await load();
      if (showAudit) await loadAudit();
    } catch (e) { setError(errorMessage(e)); }
    finally { setLoading(null); }
  }

  if (!status) return <section><h2>تلگرام</h2><p>{error || "در حال بارگذاری..."}</p></section>;

  const { connection, access, group, bot } = status;

  return (
    <section className="workspace-panel">
      <h2>تلگرام</h2>
      <p role="alert" style={{ color: "crimson" }}>{error}</p>
      <div style={{ display: "grid", gap: ".3rem", fontSize: ".85rem" }}>
        <div>گروه: {connection.group_connected ? `✅ متصل${connection.chat_title ? ` — ${connection.chat_title}` : ""}` : "❌ متصل نیست"}</div>
        <div>دانش‌آموز: {connection.student_connected ? `✅ متصل${connection.telegram_username ? ` — @${connection.telegram_username}` : ""}` : "❌ متصل نیست"}</div>
        <div>دسترسی: {access.enabled ? "فعال" : "غیرفعال"}</div>
        <div>تعلیق: {access.suspended ? "بله" : "خیر"}</div>
        <div>بن: {access.banned ? "بله" : "خیر"}</div>
        <div>گروه: {group.locked ? "Locked" : "Unlocked"}</div>
        <div>آخرین فعالیت: {bot.last_activity_at ? new Date(bot.last_activity_at).toLocaleString("fa-IR") : "—"}</div>
        <div>آخرین خطا: {bot.last_error_message || "—"}{bot.last_error_at ? ` (${new Date(bot.last_error_at).toLocaleString("fa-IR")})` : ""}</div>
        <div>ربات: {bot.reachable ? "Online" : "Unavailable"}</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem", marginTop: ".6rem" }}>
        {access.enabled
          ? <button disabled={!!loading} onClick={() => { if (confirm("تلگرام غیرفعال شود؟")) void act(`/admin/students/${studentId}/telegram/disable/`, true); }}>{loading === `/admin/students/${studentId}/telegram/disable/` ? "..." : "غیرفعال کردن"}</button>
          : <button disabled={!!loading} onClick={() => void act(`/admin/students/${studentId}/telegram/enable/`, false)}>{loading === `/admin/students/${studentId}/telegram/enable/` ? "..." : "فعال کردن"}</button>}
        {access.suspended
          ? <button disabled={!!loading} onClick={() => void act(`/admin/students/${studentId}/telegram/resume/`, false)}>رفع تعلیق</button>
          : <button disabled={!!loading} onClick={() => { if (confirm("تعلیق شود؟")) void act(`/admin/students/${studentId}/telegram/suspend/`, true); }}>تعلیق</button>}
        {access.banned
          ? <button disabled={!!loading} onClick={() => void act(`/admin/students/${studentId}/telegram/unban/`, false)}>Unban</button>
          : <button disabled={!!loading} onClick={() => { if (confirm("Ban شود؟")) void act(`/admin/students/${studentId}/telegram/ban/`, true); }}>Ban</button>}
        {group.locked
          ? <button disabled={!!loading} onClick={() => void act(`/admin/students/${studentId}/telegram/group/unlock/`, false)}>باز کردن گروه</button>
          : <button disabled={!!loading} onClick={() => { if (confirm("گروه قفل شود؟")) void act(`/admin/students/${studentId}/telegram/group/lock/`, true); }}>قفل گروه</button>}
        <button disabled={!!loading} onClick={() => void act(`/admin/students/${studentId}/telegram/resend-plan/`, false)}>ارسال مجدد برنامه امروز</button>
        <button onClick={() => { setShowAudit((v) => !v); if (!showAudit) void loadAudit(); }}>{showAudit ? "بستن تاریخچه" : "مشاهده تاریخچه عملیات"}</button>
      </div>

      <div style={{ marginTop: ".4rem" }}>
        <input placeholder="دلیل این عملیات" value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: "100%", padding: ".3rem" }} />
      </div>

      {showAudit && (
        <div style={{ marginTop: ".6rem", overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: ".8rem", borderCollapse: "collapse" }}>
            <thead><tr><th>زمان</th><th>Admin</th><th>Action</th><th>Result</th><th>Reason</th></tr></thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id}><td>{new Date(row.created_at).toLocaleString("fa-IR")}</td><td>{row.actor || "—"}</td><td>{row.action}</td><td>{row.success ? "✅" : "❌"}</td><td>{row.reason || "—"}</td></tr>
              ))}
              {audit.length === 0 && <tr><td colSpan={5}>موردی یافت نشد.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
