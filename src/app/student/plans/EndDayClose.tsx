"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { DailyReport, minutesText } from "@/lib/dailyReports";
import { PlanItemExecution, kindLabel } from "@/lib/planning";
import { ReportResponse } from "@/lib/reports";

type Unresolved = { id: number; title: string; kind: "STUDY" | "TEST" | "REVIEW" | "EXAM"; subject_name: string; chapter_name: string; topic_name: string; planned_duration_minutes: number | null; planned_test_count: number | null; status: string };
type Review = { date: string; active_timer: number | null; unresolved: Unresolved[] };
type Outcome = "COMPLETED" | "PARTIAL" | "NOT_DONE";

export default function EndDayClose({ report, summary, executions, token, onResolved, onClosed, onEdit, editingClosed }: {
  report: DailyReport; summary: ReportResponse | null; executions: Record<number, PlanItemExecution>; token: string;
  onResolved: () => Promise<void>; onClosed: () => Promise<void>; onEdit: () => void; editingClosed: boolean;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [duration, setDuration] = useState("");
  const [tests, setTests] = useState("");
  const [wrong, setWrong] = useState("");
  const [rating, setRating] = useState(report.self_rating === null ? "" : String(report.self_rating));
  const [reason, setReason] = useState(report.note);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const reviewUrl = `/daily-reports/${report.id}/close-review/?date=${encodeURIComponent(report.date)}`;
  const currentId = review?.unresolved[0]?.id;

  async function reload() { const data = await api<Review>(reviewUrl, token); setReview(data); return data; }
  useEffect(() => { if (!reviewing) return; let live = true;
    api<Review>(reviewUrl, token).then((data) => { if (live) setReview(data); }).catch((reason) => { if (live) setError(errorMessage(reason)); });
    return () => { live = false; };
  }, [reviewing, reviewUrl, token, executions]);
  useEffect(() => { cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [currentId]);

  async function begin() { setError(""); try { await reload(); setReviewing(true); } catch (reason) { setError(errorMessage(reason)); } }
  function choose(value: Outcome, current: Unresolved) {
    setOutcome(value); setError("");
    if (value !== "NOT_DONE") {
      const execution = executions[current.id];
      const seconds = execution?.elapsed_seconds || execution?.accumulated_seconds || 0;
      setDuration(seconds > 0 ? String(Math.round(seconds / 60)) : "");
    }
  }
  async function resolve(event: React.FormEvent, current: Unresolved) {
    event.preventDefault(); if (!outcome || busy) return;
    if (outcome !== "NOT_DONE" && duration === "") { setError("زمان واقعی را وارد کنید."); return; }
    if (current.kind === "TEST" && outcome !== "NOT_DONE" && (tests === "" || wrong === "")) { setError("تعداد تست و تعداد غلط را وارد کنید."); return; }
    if (Number(wrong) > Number(tests)) { setError("تعداد غلط نمی‌تواند بیشتر از تعداد تست‌ها باشد."); return; }
    setBusy(true); setError("");
    try {
      if (outcome === "NOT_DONE") await api(`/planning/items/${current.id}/not-done/`, token, "POST");
      else {
        const values: Record<string, string | number> = { completion_status: outcome, actual_duration_minutes: Number(duration) };
        if (current.kind === "TEST") { values.actual_test_count = Number(tests); values.wrong_count = Number(wrong); }
        await api(`/daily-reports/${report.id}/planned/${current.id}/`, token, "PUT", values);
      }
      setOutcome(null); setDuration(""); setTests(""); setWrong("");
      await onResolved(); await reload();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }
  async function close(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { await api(`/daily-reports/${report.id}/close/`, token, "POST", { date: report.date, self_rating: Number(rating), note: reason.trim() }); await onClosed(); setReviewing(false); }
    catch (reason) { setError(errorMessage(reason)); await reload().catch(() => undefined); }
    finally { setBusy(false); }
  }

  if (report.closed_at) return <section className="planning-day-close"><h3>برنامه امروز پایان یافت</h3>
    <p>برنامه: {minutesText(summary?.summary.planned_minutes || 0)}</p><p>عملکرد: {minutesText(summary?.summary.actual_minutes || 0)}</p>
    <p>تست: {summary?.summary.actual_tests || 0} / {summary?.summary.planned_tests || 0}</p>
    <p>وضعیت: {report.summary.completed_plan_items} کامل · {report.summary.partial_plan_items} ناقص · {report.summary.not_done_plan_items} انجام نشده</p>
    <p>ارزیابی شما: {report.self_rating}/۲۰</p>
    <div className="planning-actions"><Link href={`/student/plans/report/${report.date}`}>مشاهده گزارش امروز</Link><button type="button" onClick={onEdit}>{editingClosed ? "پایان ویرایش" : "ویرایش گزارش امروز"}</button></div>
  </section>;

  const current = review?.unresolved[0];
  const active = current && review?.active_timer === current.id;
  return <section className="planning-day-close">
    {!reviewing ? <button type="button" className="planning-primary" onClick={begin}>پایان برنامه امروز</button> : <>
      <div className="planning-editor-heading"><h3>مرور پایان برنامه امروز</h3><button type="button" className="planning-subtle" onClick={() => setReviewing(false)}>بازگشت</button></div>
      {current && <article ref={cardRef} className="planning-block planning-end-day-focus">
        <div className="planning-block-top"><span className="planning-badge">{kindLabel[current.kind]}</span><span>{review.unresolved.length} باکس باقی مانده</span></div>
        <strong>{current.subject_name || current.title}</strong>{current.topic_name && <span>{current.topic_name}</span>}{current.chapter_name && !current.topic_name && <span>{current.chapter_name}</span>}
        <div className="planning-block-meta"><span>برنامه مشاور: {current.planned_duration_minutes ?? "—"} دقیقه</span>{current.planned_test_count !== null && <span>{current.planned_test_count} تست</span>}</div>
        {active && !outcome ? <><p role="alert">این فعالیت هنوز در حال اجراست.</p><div className="planning-actions"><button type="button" onClick={() => choose("COMPLETED", current)}>پایان فعالیت و ثبت عملکرد</button><button type="button" className="planning-subtle" onClick={() => setReviewing(false)}>بازگشت</button></div></> : <><p><strong>این پارت درسی چی شد؟</strong></p><div className="planning-actions"><button type="button" onClick={() => choose("COMPLETED", current)}>کامل انجام دادم</button><button type="button" onClick={() => choose("PARTIAL", current)}>بخشی انجام دادم</button><button type="button" className="planning-subtle" onClick={() => choose("NOT_DONE", current)}>انجام ندادم</button></div></>}
        {outcome && <form onSubmit={(event) => resolve(event, current)}>
          {outcome !== "NOT_DONE" && <label>چقدر زمان گذاشتی؟ (دقیقه)<input required type="number" min="0" inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)}/></label>}
          {current.kind === "TEST" && outcome !== "NOT_DONE" && <div className="planning-form-row"><label>چند تست زدی؟<input required type="number" min="0" value={tests} onChange={(event) => setTests(event.target.value)}/></label><label>چند غلط داشتی؟<input required type="number" min="0" value={wrong} onChange={(event) => setWrong(event.target.value)}/></label></div>}
          <button disabled={busy}>{busy ? "در حال ذخیره…" : "ثبت این باکس"}</button>
        </form>}
      </article>}
      {review && !current && <form className="planning-reflection" onSubmit={close}><h3>امروز به عملکرد درسی خودت چند میدی؟</h3><div className="planning-form-row"><label>نمره (۱ تا ۲۰)<input required type="number" min="1" max="20" inputMode="numeric" value={rating} onChange={(event) => setRating(event.target.value)}/></label><label>چرا؟<textarea required rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)}/></label></div><button disabled={busy}>{busy ? "در حال ثبت…" : "ثبت و پایان روز"}</button></form>}
    </>}
    <p className="planning-error" role="alert">{error}</p>
  </section>;
}
