"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { downloadPlanExport, persianDate, Plan, PlanItemExecution, planningError, weekDates } from "@/lib/planning";
import { useStudentPlanAuth } from "../layout";
import PlanBlock from "../PlanBlock";
import ExecutionControls from "../ExecutionControls";
import ManualPerformance from "../ManualPerformance";
import { minutesText } from "@/lib/dailyReports";
import type { DailyReport, DailyReportItem, ReportStudent } from "@/lib/dailyReports";
import { daysAgoIso, tehranTodayIso, type ReportResponse } from "@/lib/reports";
import UnplannedEditor from "../report/[date]/UnplannedEditor";
import EndDayClose from "../EndDayClose";

type ExecutionAction = "start" | "pause" | "resume" | "quick-complete" | "not-done";

export default function StudentPlanDetail({ id }: { id: string }) {
  const { token } = useStudentPlanAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [executions, setExecutions] = useState<Record<number, PlanItemExecution>>({});
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const busyRef = useRef<number | null>(null);
  const [now, setNow] = useState(0);
  const [today, setToday] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [error, setError] = useState("");
  const [todayReport, setTodayReport] = useState<ReportResponse | null>(null);
  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [student, setStudent] = useState<ReportStudent | null>(null);
  const [extraEditor, setExtraEditor] = useState<DailyReportItem | "new" | null>(null);
  const [editing, setEditing] = useState<{ item: NonNullable<Plan["days"]>[number]["items"][number]; date: string; status: "COMPLETED" | "PARTIAL"; timerMinutes?: number } | null>(null);
  const [editingClosed, setEditingClosed] = useState(false);

  async function refreshToday(date = today) {
    if (!date) return;
    const query = new URLSearchParams({ start_date: date, end_date: date, metric: "all" });
    const [summary, report] = await Promise.all([api<ReportResponse>(`/student/reports/?${query}`, token), api<DailyReport>("/daily-reports/open/", token, "POST", { date })]);
    setTodayReport(summary); setDaily(report);
  }

  async function refreshExecutionAndToday() {
    await refreshToday();
    const records = await api<PlanItemExecution[]>(`/planning/plans/${id}/executions/`, token);
    setExecutions(Object.fromEntries(records.map((record) => [record.plan_item, record])));
  }

  useEffect(() => {
    if (!today) return;
    let live = true;
    Promise.all([api<DailyReport>("/daily-reports/open/", token, "POST", { date: today }), api<ReportStudent>("/auth/profile/student/", token)]).then(([report, profile]) => { if (live) { setDaily(report); setStudent(profile); } })
      .catch((reason) => { if (live) setError(planningError(reason)); });
    const query = new URLSearchParams({ start_date: today, end_date: today, metric: "all" });
    api<ReportResponse>(`/student/reports/?${query}`, token).then((data) => { if (live) setTodayReport(data); }).catch((reason) => { if (live) setError(planningError(reason)); });
    return () => { live = false; };
  }, [today, token]);

  useEffect(() => {
    let live = true;
    Promise.all([
      api<Plan>(`/planning/plans/${id}/`, token),
      api<PlanItemExecution[]>(`/planning/plans/${id}/executions/`, token),
    ]).then(([loadedPlan, records]) => {
      if (!live) return;
      setPlan(loadedPlan);
      setExecutions(Object.fromEntries(records.map((record) => [record.plan_item, record])));
    }).catch((reason) => { if (live) setError(planningError(reason)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id, token]);

  useEffect(() => {
    const tick = () => { setNow(Date.now()); setToday(tehranTodayIso()); };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function act(itemId: number, action: ExecutionAction): Promise<boolean> {
    if (busyRef.current !== null) return false;
    busyRef.current = itemId; setBusyItem(itemId); setError("");
    try {
      const updated = await api<PlanItemExecution>(`/planning/items/${itemId}/${action}/`, token, "POST");
      setExecutions((current) => ({ ...current, [itemId]: updated }));
      setNow(Date.now());
      await refreshToday();
      return true;
    } catch (reason) {
      setError(planningError(reason));
      return false;
    } finally { busyRef.current = null; setBusyItem(null); }
  }

  function openPerformance(item: NonNullable<Plan["days"]>[number]["items"][number], date: string, status: "COMPLETED" | "PARTIAL") {
    const execution = executions[item.id];
    const running = execution?.status === "IN_PROGRESS" && execution.current_session_started_at
      ? Math.max(0, Math.floor((now - Date.parse(execution.current_session_started_at)) / 1000)) : 0;
    const timerMinutes = execution?.started_at ? Math.round(((execution.accumulated_seconds || 0) + running) / 60) : undefined;
    setEditing({ item, date, status, timerMinutes });
  }


  async function exportPlan(format: "pdf" | "excel") {
    if (!plan) return;
    setExporting(format); setError("");
    try { await downloadPlanExport(plan.id, format, token); }
    catch (reason) { setError(planningError(reason)); }
    finally { setExporting(null); }
  }

  async function saveExtra(values: Record<string, string | number | null>) {
    if (!daily) return false;
    setError("");
    try {
      const editing = extraEditor && extraEditor !== "new" ? extraEditor : null;
      const path = editing ? `/daily-reports/${daily.id}/unplanned/${editing.id}/` : `/daily-reports/${daily.id}/unplanned/`;
      await api(path, token, editing ? "PATCH" : "POST", values);
      await refreshToday(); return true;
    } catch (reason) { setError(planningError(reason)); return false; }
  }

  async function removeExtra(item: DailyReportItem) {
    if (!daily || !window.confirm("این فعالیت حذف شود؟")) return;
    try { await api(`/daily-reports/${daily.id}/unplanned/${item.id}/`, token, "DELETE"); await refreshToday(); }
    catch (reason) { setError(planningError(reason)); }
  }


  const dates = plan ? weekDates(plan.start_date, plan.end_date) : [];
  const orderedDates = today && dates.includes(today) ? [today, ...dates.filter((date) => date !== today)] : dates;
  const canEditToday = !daily?.closed_at || editingClosed;
  return <main className="planning-content" dir="rtl" lang="fa"><Link href="/student/plans">← همه برنامه‌ها</Link>{loading && <p>در حال بارگذاری…</p>}<p className="planning-error" role="alert">{error}</p>{plan && <><h1>{plan.title || `برنامه هفته ${persianDate(plan.start_date)}`}</h1><p>{persianDate(plan.start_date)} تا {persianDate(plan.end_date)}</p><div className="planning-actions"><button type="button" onClick={() => exportPlan("pdf")} disabled={exporting !== null}>{exporting === "pdf" ? "در حال دریافت…" : "دریافت PDF"}</button><button type="button" onClick={() => exportPlan("excel")} disabled={exporting !== null}>{exporting === "excel" ? "در حال دریافت…" : "دریافت اکسل"}</button></div>
    {today && dates.includes(today) && todayReport && <section className="report-summary"><h2>امروز · برنامه و عملکرد</h2><div className="report-summary-grid"><strong>برنامه مشاور<span>{minutesText(todayReport.summary.planned_minutes)}</span></strong><strong>عملکرد شما<span>{minutesText(todayReport.summary.actual_minutes)}</span></strong><strong>باقی‌مانده<span>{minutesText(Math.max(todayReport.summary.planned_minutes - todayReport.summary.actual_minutes, 0))}</span></strong><strong>باکس‌های انجام‌شده<span>{todayReport.summary.completed_blocks} از {todayReport.summary.planned_blocks}</span></strong><strong>تست<span>{todayReport.summary.actual_tests} از {todayReport.summary.planned_tests}</span></strong></div>
      {todayReport.subjects.length > 0 && <div className="report-subject-totals">{todayReport.subjects.map((subject) => <span key={subject.id}>{subject.name}: {minutesText(subject.actual_minutes)} / {minutesText(subject.planned_minutes)}{subject.actual_tests > 0 && ` · ${subject.actual_tests} تست`}</span>)}</div>}
    </section>}
    <div className="planning-week planning-week-readonly">{orderedDates.map((date) => {
    const day = plan.days?.find((entry) => entry.date === date);
    const extras = date === today ? daily?.items.filter((item) => item.plan_item === null) || [] : [];
    type Entry = { plan: NonNullable<Plan["days"]>[number]["items"][number]; extra?: never } | { plan?: never; extra: DailyReportItem };
    const entries: Entry[] = [...(day?.items || []).map((plan) => ({ plan })), ...extras.map((extra) => ({ extra }))];
    const time = (entry: Entry) => entry.plan?.start_time || entry.extra?.start_time || null;
    const timed = entries.filter((entry) => time(entry)).sort((a, b) => time(a)!.localeCompare(time(b)!));
    const flexible = entries.filter((entry) => !time(entry));
    const block = (entry: Entry) => {
      if (entry.extra) { const item = entry.extra; return <article className="planning-block planning-extra-block" key={`extra-${item.id}`}><div className="planning-block-top"><span className="planning-badge">خارج از برنامه · {item.kind === "EVENT" ? "رویداد" : item.kind === "TEST" ? "تست" : item.kind === "REVIEW" ? "مرور" : "مطالعه"}</span>{item.start_time && <span dir="ltr">{item.start_time}–{item.end_time}</span>}</div><strong>{item.title || item.subject_name}</strong>{item.topic_name && <span>{item.topic_name}</span>}<div className="planning-block-meta">{item.kind !== "EVENT" && <span>{item.actual_duration_minutes ?? 0} دقیقه</span>}{item.actual_test_count !== null && <span>{item.actual_test_count} تست</span>}</div>{canEditToday && <div className="planning-block-actions"><button type="button" onClick={() => setExtraEditor(item)}>ویرایش</button><button type="button" onClick={() => removeExtra(item)}>حذف</button></div>}</article>; }
      const item = entry.plan!; const actual = date === today ? daily?.items.find((row) => row.plan_item === item.id) : null;
      const remaining = item.planned_duration_minutes === null || actual?.actual_duration_minutes === null || actual?.actual_duration_minutes === undefined ? null : item.planned_duration_minutes - actual.actual_duration_minutes;
      return <PlanBlock key={`plan-${item.id}`} item={item} plannedLabel actions={<>{date === today && <div className="planning-actual"><strong>عملکرد شما</strong><span>{actual?.actual_duration_minutes === null || actual?.actual_duration_minutes === undefined ? "زمان ثبت نشده" : `${actual.actual_duration_minutes} دقیقه`}{actual?.actual_test_count !== null && actual?.actual_test_count !== undefined && ` · ${actual.actual_test_count} تست`}{actual?.wrong_count !== null && actual?.wrong_count !== undefined && ` · ${actual.wrong_count} غلط`}</span>{remaining !== null && <span>{remaining > 0 ? `${remaining} دقیقه باقی‌مانده` : remaining < 0 ? `${-remaining} دقیقه بیشتر از برنامه` : "زمان برنامه کامل شد"}</span>}</div>}{(date !== today || canEditToday) && <ExecutionControls itemId={item.id} kind={item.kind} execution={executions[item.id]} now={now} busy={busyItem === item.id} onAction={act} onFinish={(status) => openPerformance(item, date, status)}/>}{item.kind !== "EVENT" && date <= today && date >= daysAgoIso(today, 30) && (date !== today || canEditToday) && (executions[item.id]?.status === "COMPLETED" || executions[item.id]?.status === "PARTIAL") && <button type="button" onClick={() => openPerformance(item, date, executions[item.id].status === "PARTIAL" ? "PARTIAL" : "COMPLETED")}>ویرایش عملکرد</button>}</>}/>;
    };
    return <section className={`planning-day ${date === today ? "planning-day-today" : ""}`} key={date}><header><h2>{date === today && <span className="planning-today-label">امروز</span>}{persianDate(date)}</h2><Link href={`/student/plans/report/${date}`}>گزارش این روز</Link>{date === today && canEditToday && <button type="button" onClick={() => setExtraEditor("new")}>+ افزودن فعالیت خارج از برنامه</button>}</header><div className="planning-day-content">{editing?.date === date && <ManualPerformance key={`${editing.item.id}-${editing.status}`} item={editing.item} date={date} token={token} status={editing.status} timerMinutes={editing.timerMinutes} onClose={() => setEditing(null)} onSaved={refreshExecutionAndToday}/>}{date === today && extraEditor && student && <UnplannedEditor key={extraEditor === "new" ? "new" : extraEditor.id} token={token} student={student} initial={extraEditor === "new" ? undefined : extraEditor} onSave={saveExtra} onCancel={() => setExtraEditor(null)}/>}<div className="planning-day-lane"><h3>زمان‌بندی‌شده</h3><div className="planning-timeline">{timed.length ? timed.map(block) : <p className="planning-empty">باکس زمان‌دار ندارد.</p>}</div></div><div className="planning-day-lane planning-flexible"><h3>فعالیت‌های بدون ساعت مشخص</h3><div className="planning-timeline">{flexible.length ? flexible.map(block) : <p className="planning-empty">فعالیتی ندارد.</p>}</div></div>{date === today && daily && <EndDayClose report={daily} summary={todayReport} executions={executions} token={token} editingClosed={editingClosed} onResolved={refreshExecutionAndToday} onClosed={async () => { await refreshToday(); }} onEdit={() => setEditingClosed((value) => !value)}/>}</div></section>;
  })}</div></>}</main>;
}
