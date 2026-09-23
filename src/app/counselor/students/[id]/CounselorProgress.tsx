"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { CounselorPlanItemProgress, CounselorProgress } from "@/lib/counselorProgress";
import { minutesText } from "@/lib/dailyReports";
import { persianDate } from "@/lib/planning";

const statusLabel: Record<CounselorPlanItemProgress["status"], string> = {
  NOT_STARTED: "انجام نشده", IN_PROGRESS: "در حال انجام", PAUSED: "متوقف شده",
  COMPLETED: "انجام شد", PARTIAL: "ناقص", NOT_DONE: "انجام نشد",
};

function ItemComparison({ item }: { item: CounselorPlanItemProgress }) {
  const name = [item.subject || item.title, item.chapter, item.topic].filter(Boolean).join(" — ");
  const hasDetails = [item.correct, item.wrong, item.unanswered].some((value) => value !== null);
  return <article className="counselor-progress-item">
    <div className="progress-day-heading"><strong>{name}</strong><span className="planning-status">{statusLabel[item.status]}</span></div>
    <div className="progress-day-facts">
      <span>برنامه: {item.planned_minutes === null ? "—" : minutesText(item.planned_minutes)}{item.planned_tests !== null && ` · ${item.planned_tests} تست`}</span>
      <span>عملکرد: {item.actual_minutes === null ? "ثبت نشده" : minutesText(item.actual_minutes)}{item.actual_tests !== null && ` · ${item.actual_tests} تست`}</span>
    </div>
    {hasDetails && <div className="progress-day-facts planning-hint">
      {item.correct !== null && <span>صحیح: {item.correct}</span>}
      {item.wrong !== null && <span>غلط: {item.wrong}</span>}
      {item.unanswered !== null && <span>نزده: {item.unanswered}</span>}
    </div>}
  </article>;
}

export default function CounselorProgressView({ studentId, token }: { studentId: number; token: string }) {
  const [progress, setProgress] = useState<CounselorProgress | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<CounselorProgress>(`/counselor/students/${studentId}/progress/`, token)
      .then(setProgress).catch((reason) => setError(errorMessage(reason)));
  }, [studentId, token]);
  if (!progress) return <section className="report-section"><h2>پیشرفت اخیر</h2><p className="planning-error" role="alert">{error}</p>{!error && <p>در حال بارگذاری…</p>}</section>;
  const today = progress.today;
  const flags = [
    today.remaining > 0 ? `${today.remaining} باکس انجام‌نشده` : null,
    today.planned_minutes > 0 && today.actual_minutes < today.planned_minutes ? "زمان واقعی کمتر از برنامه" : null,
    !today.has_report ? "گزارش امروز ثبت نشده" : null,
  ].filter(Boolean);
  const daysWithItems = progress.recent_days.filter((day) => progress.planned_items.some((item) => item.date === day.date));

  return <div className="counselor-progress">
    <section className="report-summary" aria-labelledby="counselor-today"><h2 id="counselor-today">امروز، {persianDate(today.date)}</h2>
      <div className="report-summary-grid">
        <strong>مطالعه<span>{minutesText(today.actual_minutes)}</span><small>برنامه: {minutesText(today.planned_minutes)}</small></strong>
        <strong>تست<span>{today.actual_tests}</span><small>برنامه: {today.planned_tests}</small></strong>
        <strong>باکس انجام‌شده<span>{today.completed} از {today.planned_blocks}</span><small>ناقص: {today.partial} · باقی‌مانده: {today.remaining}</small></strong>
        <strong>موبایل<span>{today.mobile_minutes === null ? "ثبت نشده" : minutesText(today.mobile_minutes)}</span></strong>
        <strong>نمره روز<span>{today.self_rating === null ? "ثبت نشده" : `${today.self_rating}/۲۰`}</span></strong>
      </div>
      {flags.length > 0 && <div className="counselor-progress-flags" aria-label="نکات امروز">{flags.map((flag) => <span key={flag}>{flag}</span>)}</div>}
    </section>
    <section className="report-section"><h2>روزهای اخیر</h2><div className="progress-days">{progress.recent_days.map((day) => <div className="progress-day" key={day.date}>
      <div className="progress-day-facts"><strong>{persianDate(day.date)}</strong><span>{minutesText(day.actual_minutes)} / {minutesText(day.planned_minutes)}</span><span>{day.actual_tests} / {day.planned_tests} تست</span><span>باکس: {day.completed}/{day.planned_blocks}</span><span>ناقص: {day.partial}</span>{day.self_rating !== null && <span>نمره: {day.self_rating}/۲۰</span>}</div>
    </div>)}</div></section>
    <section className="report-section"><h2>زمان واقعی بر اساس درس، ۷ روز اخیر</h2>
      {progress.subject_workload.length ? <div className="report-subject-totals">{progress.subject_workload.map((subject) => <span key={subject.name}>{subject.name}: {minutesText(subject.minutes)}</span>)}</div> : <p className="planning-hint">زمانی برای درس‌ها ثبت نشده است.</p>}
    </section>
    <section className="report-section"><h2>برنامه در برابر عملکرد</h2>
      {daysWithItems.length ? daysWithItems.map((day) => <details className="counselor-progress-day" key={day.date} open={day.date === today.date}>
        <summary>{persianDate(day.date)} · {day.completed}/{day.planned_blocks} باکس انجام‌شده</summary>
        <div className="progress-days">{progress.planned_items.filter((item) => item.date === day.date).map((item) => <ItemComparison item={item} key={item.id}/>)}</div>
      </details>) : <p className="planning-hint">برنامه منتشرشده‌ای در این بازه وجود ندارد.</p>}
    </section>
  </div>;
}
