"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { examDateTime } from "@/components/exams/schedule";
import { MonitoringSession, effectiveMonitoring, participationLabels, type ParticipationStatus } from "./monitoring";

export default function MonitoringPanel({ examId, token }: { examId: number; token: string }) {
  const [session] = useState(() => new MonitoringSession(examId, <T,>(path: string, method?: string) => api<T>(path, token, method)));
  const [state, setState] = useState(session.state);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { session.connect(setState); return () => session.dispose(); }, [session]);
  useEffect(() => {
    const timer = setTimeout(() => void session.load(query, status, page), 250);
    return () => clearTimeout(timer);
  }, [session, query, status, page]);
  useEffect(() => {
    if (!state.data?.fresh) return;
    // Expire labels locally; this timer never sends a provider or API request.
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [state.data]);
  const data = effectiveMonitoring(state.data, now);
  return <section className="exam-monitoring" aria-labelledby="exam-monitoring-title" aria-busy={state.loading || state.syncing}>
    <div className="exam-section-heading"><h3 id="exam-monitoring-title">پایش شرکت‌کنندگان</h3><button type="button" className="exam-primary" disabled={state.syncing || state.loading} onClick={() => void session.sync()}>{state.syncing ? "در حال به‌روزرسانی…" : "به‌روزرسانی وضعیت"}</button></div>
    <p className="exam-muted">تخصیص در آموزتک با دعوت یا شرکت در Quiz24 متفاوت است. به‌روزرسانی دستی با حداقل یک دقیقه فاصله انجام می‌شود.</p>
    {state.error && <div role="alert" className="exam-feedback"><p>{state.error}</p><button type="button" className="exam-secondary" disabled={state.loading || state.syncing} onClick={() => void session.load()}>بازخوانی پایش</button></div>}
    {state.notice && <p role="status" className="participant-success">{state.notice}</p>}
    {state.loading && <p role="status">در حال دریافت اطلاعات پایش…</p>}
    {data && <>
      <p role="status"><strong>{data.fresh ? "اطلاعات به‌روز" : "اطلاعات قدیمی یا تأییدنشده"}</strong>{data.partial ? " · پوشش سرویس کامل نیست" : ""}</p>
      <p className="exam-muted">آخرین دریافت موفق: {data.last_success_at ? examDateTime(data.last_success_at) : "هنوز دریافت نشده"} · امکان شرکت: {data.availability.label}</p>
      {data.error && <p className="exam-feedback" role="status">{data.error}</p>}
      {data.syncing && <p role="status">درخواست دیگری در سرور در حال به‌روزرسانی است؛ پس از چند لحظه فهرست را بازخوانی کنید.</p>}
      <dl className="monitoring-totals">{([
        ["تخصیص‌یافته", data.summary.assigned], ["شروع تأییدشده", data.summary.started],
        ["در حال شرکت", data.summary.IN_PROGRESS], ["تکمیل‌شده", data.summary.COMPLETED],
        ["شروع نکرده (تأییدشده)", data.summary.NOT_STARTED], ["نامشخص", data.summary.UNKNOWN],
      ] as const).map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count.toLocaleString("fa-IR")}</dd></div>)}</dl>
    </>}
    <div className="monitoring-filters"><label>جستجوی نام دانش‌آموز<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}/></label><label>وضعیت شرکت<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">همه وضعیت‌ها</option>{Object.entries(participationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    {data && !state.loading && !data.results.length && <p className="participant-empty">{data.summary.assigned ? "دانش‌آموزی با این جستجو یا وضعیت پیدا نشد." : "هنوز دانش‌آموزی برای پایش تخصیص داده نشده است."}</p>}
    {data && !!data.results.length && <div className="exam-table-scroll" role="region" aria-label="جدول پایش شرکت‌کنندگان" tabIndex={0}><table className="monitoring-table"><thead><tr><th scope="col">دانش‌آموز</th><th scope="col">وضعیت شرکت</th><th scope="col">شروع تأییدشده</th><th scope="col">تکمیل تأییدشده</th><th scope="col">توضیحات</th></tr></thead><tbody>{data.results.map(row => <tr key={row.student}>
      <th scope="row">{row.student_name}</th><td>{participationLabels[row.status]}{row.absent && <small>عدم شرکت پس از مهلت تأیید شد</small>}{row.status === "UNKNOWN" && row.last_known_status && <small>آخرین وضعیت ثبت‌شده: {participationLabels[row.last_known_status as ParticipationStatus]}</small>}</td>
      <td>{row.started_at ? examDateTime(row.started_at) : "تأیید نشده"}</td><td>{row.completed_at ? examDateTime(row.completed_at) : "تأیید نشده"}</td><td>{row.warnings.map(warning => <small key={warning}>{warning}</small>)}{row.local_attempt && <small>رکورد محلی: {row.local_attempt.status === "COMPLETED" ? "نتیجه دریافت شده" : "درخواست لینک"}{row.local_attempt.finished_at && <> · زمان محلی ثبت‌شده: {examDateTime(row.local_attempt.finished_at)}</>}</small>}</td>
    </tr>)}</tbody></table></div>}
    {data && <div className="participant-pagination" aria-label="صفحه‌بندی پایش"><button type="button" disabled={state.loading || !data.previous} onClick={() => setPage(value => Math.max(1, value - 1))}>قبلی</button><span>صفحه {page.toLocaleString("fa-IR")} · {data.count.toLocaleString("fa-IR")} نتیجه</span><button type="button" disabled={state.loading || !data.next} onClick={() => setPage(value => value + 1)}>بعدی</button></div>}
    <p className="exam-muted">صدور لینک، شروع یا تکمیل آزمون را ثابت نمی‌کند. زمان‌های سرویس فقط در صورت تأیید قابل نمایش‌اند؛ نبودن در فهرست سرویس به‌معنای غیبت نیست.</p>
  </section>;
}
