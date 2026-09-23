"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { minutesText } from "@/lib/dailyReports";
import { persianDate } from "@/lib/planning";
import { daysAgoIso, tehranTodayIso, type ReportResponse } from "@/lib/reports";
import { PlannedActualChart, ReportInsights, ReportSummary, SubjectDistribution, TrendChart } from "@/components/ReportVisuals";
import { useStudentPlanAuth } from "../layout";

type Period = "seven" | "thirty" | "custom";

export default function ProgressPage() {
  const { token } = useStudentPlanAuth();
  const today = tehranTodayIso();
  const [period, setPeriod] = useState<Period>("seven");
  const [customStart, setCustomStart] = useState(daysAgoIso(today, 6));
  const [customEnd, setCustomEnd] = useState(today);
  const [range, setRange] = useState({ start: daysAgoIso(today, 6), end: today });
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    const query = new URLSearchParams({ start_date: range.start, end_date: range.end, metric: "all" });
    api<ReportResponse>(`/student/reports/?${query}`, token)
      .then((data) => { if (live) setReport(data); })
      .catch(() => { if (live) { setReport(null); setError("دریافت اطلاعات پیشرفت با مشکل مواجه شد."); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [range, retry, token]);

  function preset(value: Exclude<Period, "custom">) {
    setPeriod(value); setError(""); setLoading(true);
    setRange({ start: daysAgoIso(today, value === "seven" ? 6 : 29), end: today });
  }

  function trend(metric: "study" | "tests" | "plan"): ReportResponse | null {
    if (!report) return null;
    return { ...report, metric, trend: report.days.map((day) => ({
      date: day.date,
      value: metric === "tests" ? day.actual_tests : metric === "plan" ? day.completion_percent || 0 : day.actual_minutes,
    })) };
  }

  const study = trend("study"), tests = trend("tests"), completion = trend("plan");
  return <main className="planning-content progress-page"><header className="report-page-header"><div><p className="workspace-eyebrow">روند و جمع‌بندی</p><h1>پیشرفت من</h1>{report && !loading && <p>{persianDate(report.start_date)} تا {persianDate(report.end_date)}</p>}</div></header>
    <section className="report-section reports-filters"><div className="planning-type-picker"><button className={period === "seven" ? "is-selected" : ""} onClick={() => preset("seven")}>۷ روز گذشته</button><button className={period === "thirty" ? "is-selected" : ""} onClick={() => preset("thirty")}>۳۰ روز گذشته</button><button className={period === "custom" ? "is-selected" : ""} onClick={() => setPeriod("custom")}>بازه دلخواه</button></div>{period === "custom" && <form className="planning-form-row" onSubmit={(event) => { event.preventDefault(); if (customStart > customEnd) { setError("تاریخ شروع باید پیش از تاریخ پایان باشد."); return; } setError(""); setLoading(true); setRange({ start: customStart, end: customEnd }); }}><label>از تاریخ<input type="date" required max={today} value={customStart} onChange={(event) => setCustomStart(event.target.value)}/></label><label>تا تاریخ<input type="date" required max={today} value={customEnd} onChange={(event) => setCustomEnd(event.target.value)}/></label><button>نمایش</button></form>}</section>
    {error && <div className="report-error"><p>{error}</p><button onClick={() => { setError(""); setLoading(true); setRetry((value) => value + 1); }}>تلاش مجدد</button></div>}{loading && <div className="report-loading"><span/><span/><span/><div/></div>}
    {report && !loading && <><ReportSummary report={report}/>{study && <TrendChart report={study}/>} {tests && <TrendChart report={tests}/>} {completion && <TrendChart report={completion}/>}<PlannedActualChart report={report}/><SubjectDistribution report={report}/><ReportInsights report={report}/><section className="report-section"><h2>پیشرفت درس‌ها</h2>{report.subjects.length ? report.subjects.map((subject) => <details className="reports-subject" key={subject.id}><summary><strong>{subject.name}</strong><span>برنامه {minutesText(subject.planned_minutes)}</span><span>عملکرد {minutesText(subject.actual_minutes)}</span><span>{subject.actual_tests} تست</span><span>{subject.completion_percent ?? "—"}٪ اجرا</span></summary><div className="reports-subject-details"><p>باقی‌مانده: {minutesText(Math.max(0, subject.planned_minutes - subject.actual_minutes))} · ناقص/انجام‌نشده: {subject.incomplete}</p>{report.topic_repetition.filter((topic) => topic.subject_id === subject.id).map((topic) => <p key={topic.id}>مبحث «{topic.name}»: برنامه {topic.planned} بار · فعالیت واقعی {topic.actual} بار · {minutesText(topic.actual_minutes)} · {topic.actual_tests} تست</p>)}</div></details>) : <p className="report-empty">برای این بازه هنوز عملکردی ثبت نشده است.</p>}</section></>}
  </main>;
}
