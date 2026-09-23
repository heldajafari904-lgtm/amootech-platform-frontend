"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { DailyReport, DailyReportItem, minutesText, ReportStudent } from "@/lib/dailyReports";
import { persianDate, planningError } from "@/lib/planning";
import { useStudentPlanAuth } from "../../layout";
import ReportActivity from "./ReportActivity";
import UnplannedEditor from "./UnplannedEditor";
import { daysAgoIso, tehranTodayIso } from "@/lib/reports";

type DailyForm = { wake_time: string; sleep_time: string; mobile_minutes: string; self_rating: string; note: string };
const formFrom = (report: DailyReport): DailyForm => ({
  wake_time: report.wake_time || "", sleep_time: report.sleep_time || "",
  mobile_minutes: report.mobile_minutes === null ? "" : String(report.mobile_minutes),
  self_rating: report.self_rating === null ? "" : String(report.self_rating), note: report.note,
});

export default function DailyReportPage({ date }: { date: string }) {
  const router = useRouter();
  const { token } = useStudentPlanAuth();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [student, setStudent] = useState<ReportStudent | null>(null);
  const [daily, setDaily] = useState<DailyForm>({ wake_time: "", sleep_time: "", mobile_minutes: "", self_rating: "", note: "" });
  const [editingOutside, setEditingOutside] = useState<DailyReportItem | "new" | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    Promise.all([
      api<DailyReport>("/daily-reports/open/", token, "POST", { date }),
      api<ReportStudent>("/auth/profile/student/", token),
    ]).then(([loaded, profile]) => {
      if (!live) return;
      setReport(loaded); setStudent(profile); setDaily(formFrom(loaded));
    }).catch((reason) => { if (live) setError(planningError(reason)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [date, token]);

  async function saveDaily(event: React.FormEvent) {
    event.preventDefault(); if (!report || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const updated = await api<DailyReport>(`/daily-reports/${report.id}/`, token, "PATCH", {
        wake_time: daily.wake_time || null, sleep_time: daily.sleep_time || null,
        mobile_minutes: daily.mobile_minutes === "" ? null : Number(daily.mobile_minutes),
        self_rating: daily.self_rating === "" ? null : Number(daily.self_rating), note: daily.note,
      });
      setReport(updated); setDaily(formFrom(updated)); setNotice("اطلاعات روز ذخیره شد.");
    } catch (reason) { setError(planningError(reason)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function saveItem(item: DailyReportItem, values: Record<string, number | null | string>): Promise<boolean> {
    if (!report) return false;
    setError(""); setNotice("");
    try {
      const path = item.plan_item ? `/daily-reports/${report.id}/planned/${item.plan_item}/` : `/daily-reports/${report.id}/unplanned/${item.id}/`;
      const updated = await api<DailyReport>(path, token, item.plan_item ? "PUT" : "PATCH", values);
      setReport(updated); setNotice("فعالیت ذخیره شد."); return true;
    } catch (reason) { setError(planningError(reason)); return false; }
  }

  async function sameAsPlan(item: DailyReportItem) {
    if (!report || !item.plan_item) return;
    setError(""); setNotice("");
    try {
      if (item.execution_status === "NOT_STARTED") {
        await api(`/planning/items/${item.plan_item}/quick-complete/`, token, "POST", {});
      }
      const values: Record<string, number | string> = {};
      if (item.planned_duration_minutes !== null) values.duration_source = "PLAN";
      if (item.planned_test_count !== null) values.actual_test_count = item.planned_test_count;
      const updated = await api<DailyReport>(`/daily-reports/${report.id}/planned/${item.plan_item}/`, token, "PUT", values);
      setReport(updated); setNotice("طبق برنامه ثبت شد.");
    } catch (reason) {
      setError(planningError(reason));
      try { setReport(await api<DailyReport>(`/daily-reports/${report.id}/`, token)); } catch { /* Preserve the first error. */ }
    }
  }

  async function saveOutside(values: Record<string, string | number | null>): Promise<boolean> {
    if (!report) return false;
    setError(""); setNotice("");
    try {
      const path = editingOutside && editingOutside !== "new" ? `/daily-reports/${report.id}/unplanned/${editingOutside.id}/` : `/daily-reports/${report.id}/unplanned/`;
      const updated = await api<DailyReport>(path, token, editingOutside && editingOutside !== "new" ? "PATCH" : "POST", values);
      setReport(updated); setNotice("فعالیت خارج از برنامه ذخیره شد."); return true;
    } catch (reason) { setError(planningError(reason)); return false; }
  }

  async function removeOutside(item: DailyReportItem) {
    if (!report || !window.confirm("این فعالیت خارج از برنامه حذف شود؟")) return;
    setError("");
    try { setReport(await api<DailyReport>(`/daily-reports/${report.id}/unplanned/${item.id}/`, token, "DELETE")); setNotice("فعالیت حذف شد."); }
    catch (reason) { setError(planningError(reason)); }
  }

  const planned = report?.items.filter((item) => item.plan_item !== null) || [];
  const outside = report?.items.filter((item) => item.plan_item === null) || [];
  const today = tehranTodayIso();
  return <main className="planning-content report-page" dir="rtl" lang="fa"><Link href="/student/plans">← برنامه من</Link><header className="report-page-header"><div><p className="workspace-eyebrow">گزارش یک روز</p><h1>گزارش کار · {/^\d{4}-\d{2}-\d{2}$/.test(date) ? persianDate(date) : date}</h1></div><div className="report-day-nav"><Link href={`/student/plans/report/${daysAgoIso(date, 1)}`}>روز قبل</Link>{date < today && <Link href={`/student/plans/report/${daysAgoIso(date, -1)}`}>روز بعد</Link>}</div></header><label className="report-date-picker">روز گزارش<input type="date" max={today} value={date} onChange={(event) => { if (event.target.value) router.push(`/student/plans/report/${event.target.value}`); }}/></label>{loading && <p>در حال آماده‌سازی گزارش…</p>}<p className="planning-error" role="alert">{error}</p><p className="planning-notice" role="status">{notice}</p>
    {report && <><section className="report-summary"><h2>خلاصه روز</h2><div className="report-summary-grid"><strong>برنامه مشاور <span>{minutesText(report.summary.planned_minutes)}</span></strong><strong>عملکرد من <span>{minutesText(report.summary.total_actual_minutes)}</span></strong><strong>تست واقعی / برنامه <span>{report.summary.total_tests} / {report.summary.planned_tests}</span></strong><strong>انجام‌شده <span>{report.summary.completed_plan_items} از {report.summary.planned_items}</span></strong><strong>ناقص <span>{report.summary.partial_plan_items}</span></strong><strong>انجام‌نشده <span>{report.summary.not_done_plan_items}</span></strong><strong>فعالیت خارج از برنامه <span>{outside.length}</span></strong>{report.self_rating !== null && <strong>ارزیابی من <span>{report.self_rating} از ۲۰</span></strong>}</div>{report.summary.by_subject.length > 0 && <ul className="report-subject-totals">{report.summary.by_subject.map((entry) => <li key={entry.name}>{entry.name}: {minutesText(entry.minutes)}</li>)}</ul>}</section>
    <section className="report-section"><h2>فعالیت‌های برنامه</h2><p className="planning-hint">درس، مبحث و زمان برنامه از برنامهٔ مشاور آمده‌اند. فقط نتیجهٔ واقعی را در صورت نیاز ثبت کنید.</p>{planned.length ? <div className="report-activities">{planned.map((item) => <ReportActivity key={`${item.id}-${item.actual_test_count}-${item.duration_source}`} item={item} onSave={saveItem} onSameAsPlan={sameAsPlan} onEdit={setEditingOutside} onRemove={removeOutside}/>)}</div> : <p>برای این روز فعالیت برنامه‌ریزی‌شده‌ای ثبت نشده است.</p>}</section>
    <section className="report-section"><div className="planning-editor-heading"><h2>فعالیت خارج از برنامه</h2><button type="button" onClick={() => setEditingOutside("new")}>+ فعالیت خارج از برنامه</button></div>{outside.length > 0 && <div className="report-activities">{outside.map((item) => <ReportActivity key={`${item.id}-${item.actual_test_count}-${item.actual_duration_minutes}`} item={item} onSave={saveItem} onSameAsPlan={sameAsPlan} onEdit={setEditingOutside} onRemove={removeOutside}/>)}</div>}{editingOutside && student && <UnplannedEditor key={editingOutside === "new" ? "new" : editingOutside.id} token={token} student={student} initial={editingOutside === "new" ? undefined : editingOutside} onSave={saveOutside} onCancel={() => setEditingOutside(null)}/>}</section>
    <details className="report-section report-daily-details"><summary>جزئیات روز (اختیاری)</summary><form onSubmit={saveDaily}><div className="planning-form-row"><label>ساعت بیداری<input type="time" value={daily.wake_time} onChange={(event) => setDaily({ ...daily, wake_time: event.target.value })}/></label><label>ساعت خواب<input type="time" value={daily.sleep_time} onChange={(event) => setDaily({ ...daily, sleep_time: event.target.value })}/></label><label>استفاده از موبایل (دقیقه)<input type="number" min="0" inputMode="numeric" value={daily.mobile_minutes} onChange={(event) => setDaily({ ...daily, mobile_minutes: event.target.value })}/></label><label>نمره روز (۱ تا ۲۰)<input type="number" min="1" max="20" inputMode="numeric" value={daily.self_rating} onChange={(event) => setDaily({ ...daily, self_rating: event.target.value })}/></label></div><label>یادداشت کوتاه (اختیاری)<textarea rows={2} value={daily.note} onChange={(event) => setDaily({ ...daily, note: event.target.value })}/></label><button disabled={busy}>{busy ? "در حال ذخیره…" : "ذخیره جزئیات روز"}</button></form></details></>}
  </main>;
}
