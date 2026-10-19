"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { examDateTime } from "@/components/exams/schedule";
import { ResultDetails, type ExamResult } from "@/components/exams/ExamUI";
import { AnalyticsSession, effectiveAnalytics, resultLabels, resultNumber } from "./analytics";

export default function AnalyticsPanel({ examId, token }: { examId: number; token: string }) {
  const [session] = useState(() => new AnalyticsSession(examId, <T,>(path: string, method?: string) => api<T>(path, token, method)));
  const [state, setState] = useState(session.state);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [ordering, setOrdering] = useState("rank");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<{ student: number; name: string; result?: ExamResult; error?: string } | null>(null);
  const detailGuard = useRef({ revision: 0 });
  const [now, setNow] = useState(() => Date.now());
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const guard = detailGuard.current;
    session.connect(setState);
    return () => { session.dispose(); ++guard.revision; };
  }, [session]);
  useEffect(() => {
    const timer = setTimeout(() => void session.load(query, status, ordering, page), 250);
    return () => clearTimeout(timer);
  }, [session, query, status, ordering, page]);
  async function openDetail(student: number, name: string) {
    const revision = ++detailGuard.current.revision;
    setDetail({ student, name });
    try { const result = await session.detail(student); if (revision === detailGuard.current.revision) setDetail({ student, name, result }); }
    catch (reason) { if (revision === detailGuard.current.revision) setDetail({ student, name, error: errorMessage(reason) }); }
  }
  useEffect(() => { if (detail) detailRef.current?.focus(); }, [detail]);
  useEffect(() => {
    if (!state.data) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [state.data]);
  const data = effectiveAnalytics(state.data, now);
  return <section className="exam-analytics" aria-labelledby="exam-analytics-title" aria-busy={state.loading || state.syncing}>
    <div className="exam-section-heading"><h3 id="exam-analytics-title">نتایج و تحلیل آزمون</h3><button className="exam-primary" type="button" disabled={state.loading || state.syncing} onClick={() => { ++detailGuard.current.revision; setDetail(null); void session.sync(); }}>{state.syncing ? "در حال دریافت نتایج…" : "به‌روزرسانی نتایج"}</button></div>
    <p className="exam-muted">هر بار حداکثر ۱۰ نتیجه از شرکت‌کنندگان تکمیل‌شده بررسی می‌شود؛ بین درخواست‌ها یک دقیقه فاصله لازم است.</p>
    {state.loading && <p role="status">در حال دریافت نتایج و تحلیل…</p>}
    {state.error && <div className="exam-feedback" role="alert"><p>{state.error}</p><button className="exam-secondary" type="button" disabled={state.syncing || state.loading} onClick={() => void session.load()}>بازخوانی نتایج</button></div>}
    {state.notice && <p className="participant-success" role="status">{state.notice}</p>}
    {data && <>
      <p role="status"><strong>{data.fresh ? "نمره‌های دریافت‌شده به‌روز هستند" : "پوشش ناقص یا نتایج ذخیره‌شده؛ تازگی را بررسی کنید"}</strong> · رتبه‌بندی گروه موقت است.</p>
      <p className="exam-muted">آخرین دریافت موفق: {data.last_success_at ? examDateTime(data.last_success_at) : "هنوز دریافت نشده"} · باقی‌مانده این دور: {resultNumber(data.remaining_in_cycle)} · خطای بسته اخیر: {resultNumber(data.last_error_count)}</p>
      {(data.error || data.metrics.valid_scored < data.metrics.completed) && <p className="exam-feedback" role="status">{data.error || "همه نتایج تکمیل‌شده، نمره قابل مقایسه و تأییدشده ندارند."}</p>}
      {data.syncing && <p role="status">دریافت دیگری در سرور در حال انجام است؛ فهرست را دوباره بازخوانی کنید.</p>}
      <dl className="monitoring-totals">{([
        ["تخصیص‌یافته", data.metrics.assigned], ["تکمیل‌شده", data.metrics.completed], ["نمره قابل مقایسه", data.metrics.valid_scored],
        ["درصد تکمیل از تخصیص‌ها", data.metrics.participation_percentage == null ? "—" : `${resultNumber(data.metrics.participation_percentage)}٪`],
        ["میانگین نمره", data.metrics.average_score], ["میانه نمره", data.metrics.median_score], ["بیشترین نمره", data.metrics.highest_score], ["کمترین نمره", data.metrics.lowest_score], ["میانگین Balance در Quiz24", data.metrics.average_quiz24_balance],
      ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{typeof value === "string" ? value : resultNumber(value)}</dd></div>)}</dl>
      <p className="exam-muted">{data.score_scale.label}. آمار نمره فقط از {resultNumber(data.metrics.valid_scored)} نتیجه تأییدشده همین آزمون محاسبه شده؛ نتیجه مفقود، صفر نیست. میانگین Balance از {resultNumber(data.metrics.balance_contributors)} مقدار موجود است.</p>
      <dl className="analytics-answer-counts">{([['correct_count', 'صحیح'], ['wrong_count', 'غلط'], ['no_answer_count', 'بی‌پاسخ']] as const).map(([key, label]) => <div key={key}><dt>پاسخ‌های {label}</dt><dd>جمع {resultNumber(data.metrics.answer_counts[key]?.total)} · میانگین {resultNumber(data.metrics.answer_counts[key]?.average)} · از {resultNumber(data.metrics.answer_counts[key]?.contributors)} نتیجه</dd></div>)}</dl>
      <h4>توزیع نمره خام در بازه مشاهده‌شده</h4>
      {!data.metrics.distribution.length ? <p className="exam-muted">هنوز نمره قابل مقایسه‌ای برای توزیع موجود نیست.</p> : <ul className="analytics-distribution">{data.metrics.distribution.map((bin, index) => <li key={index}><span>{resultNumber(bin.lower)} تا {resultNumber(bin.upper)}{bin.upper_inclusive ? " (شامل انتهای بازه)" : " (بدون انتهای بازه)"}</span><meter min={0} max={Math.max(1, data.metrics.valid_scored)} value={bin.count} aria-label={`تعداد نتایج در بازه ${bin.lower} تا ${bin.upper}`}/><strong>{resultNumber(bin.count)}</strong></li>)}</ul>}
    </>}
    <div className="monitoring-filters analytics-filters"><label>جستجوی دانش‌آموز<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}/></label><label>وضعیت نتیجه<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">همه وضعیت‌ها</option>{Object.entries(resultLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>مرتب‌سازی<select value={ordering} onChange={event => { setOrdering(event.target.value); setPage(1); }}><option value="rank">رتبه گروه آموزتک</option><option value="name">نام دانش‌آموز</option><option value="score_asc">نمره صعودی</option></select></label></div>
    {data && !state.loading && !data.results.length && <p className="participant-empty">دانش‌آموزی با این وضعیت یا جستجو موجود نیست؛ تخصیص‌ها و پایش آزمون را بررسی کنید.</p>}
    {data && !!data.results.length && <div className="exam-table-scroll" role="region" aria-label="نتایج و رتبه‌های گروه آزمون" tabIndex={0}><table className="monitoring-table"><thead><tr><th scope="col">دانش‌آموز</th><th scope="col">نمره خام</th><th scope="col">Balance در Quiz24</th><th scope="col">رتبه گروه آموزتک</th><th scope="col">رتبه Quiz24</th><th scope="col">رتبه کلاس Quiz24</th><th scope="col">وضعیت نتیجه</th><th scope="col">کارنامه</th></tr></thead><tbody>{data.results.map(row => <tr key={row.student}><th scope="row">{row.student_name}</th><td>{resultNumber(row.score)}</td><td>{resultNumber(row.quiz24_balance)}</td><td>{resultNumber(row.group_rank)}</td><td>{resultNumber(row.provider_rank)}</td><td>{resultNumber(row.provider_rank_in_class)}</td><td>{resultLabels[row.status]}{row.stale && <small>نمره ذخیره‌شده؛ نیاز به بازخوانی</small>}{row.verified_at && <small>{examDateTime(row.verified_at)}</small>}</td><td><button type="button" className="exam-secondary" disabled={!row.details_available || state.syncing} onClick={() => void openDetail(row.student, row.student_name)}>کارنامه فردی</button></td></tr>)}</tbody></table></div>}
    {data && <div className="participant-pagination" aria-label="صفحه‌بندی نتایج"><button type="button" disabled={state.loading || !data.previous} onClick={() => setPage(value => Math.max(1, value - 1))}>قبلی</button><span>صفحه {resultNumber(page)} · {resultNumber(data.count)} دانش‌آموز</span><button type="button" disabled={state.loading || !data.next} onClick={() => setPage(value => value + 1)}>بعدی</button></div>}
    {detail && <div className="analytics-detail" ref={detailRef} tabIndex={-1} aria-label={`کارنامه ${detail.name}`}><div className="exam-section-heading"><h4>کارنامه {detail.name}</h4><button className="exam-secondary" type="button" onClick={() => { ++detailGuard.current.revision; setDetail(null); }}>بستن کارنامه</button></div>{detail.error ? <p role="alert" className="exam-feedback">{detail.error}</p> : detail.result ? <ResultDetails result={detail.result} collapseAnswers/> : <p role="status">در حال دریافت کارنامه…</p>}</div>}
  </section>;
}
