"use client";

import "./exams.css";

const examStatuses: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "پیش‌نویس", tone: "DRAFT" },
  READY: { label: "آماده انتشار", tone: "READY" },
  PUBLISHED: { label: "منتشرشده", tone: "PUBLISHED" },
  CLOSED: { label: "پایان‌یافته", tone: "CLOSED" },
};

export function ExamStatusBadge({ status }: { status: string }) {
  const presentation = (Object.hasOwn(examStatuses, status) ? examStatuses[status] : undefined) ?? { label: "وضعیت نامشخص", tone: "unknown" };
  return <span className={`exam-badge ${presentation.tone}`}>{presentation.label}</span>;
}

export function ExamPageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return <header className="exam-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{children}</header>;
}

export function ExamSectionNav<T extends string>({ sections, value, onChange }: { sections: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <nav className="exam-section-nav" aria-label="بخش‌های آزمون">{sections.map(section => <button key={section.value} type="button" aria-pressed={value === section.value} onClick={() => onChange(section.value)}>{section.label}</button>)}</nav>;
}

export function ExamEmptyState({ title = "هنوز آزمونی ساخته نشده است", description = "برای شروع، اولین آزمون خود را ایجاد کنید.", children }: { title?: string; description?: string; children?: React.ReactNode }) {
  return <section className="exam-empty"><h2>{title}</h2><p>{description}</p>{children}</section>;
}

export function ExamErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="exam-feedback" role="alert">{message}<button className="exam-secondary" type="button" onClick={onRetry}>تلاش دوباره</button></div>;
}

export type ExamResult = {
  score: number | null; balance: number | null; rank: number | null; provider_rank_in_class?: number | null;
  correct_count: number | null; wrong_count: number | null; no_answer_count: number | null;
  answers: { order: number; answer: string | null; correct_answer: string | null; is_correct: boolean | null }[];
};

export function ResultDetails({ result, student = false, collapseAnswers = false }: { result: ExamResult; student?: boolean; collapseAnswers?: boolean }) {
  const metrics: [string, number | null][] = [["نمره", result.score], ["Balance در Quiz24", result.balance], ["رتبه Quiz24", result.rank], ["درست", result.correct_count], ["غلط", result.wrong_count], ["نزده", result.no_answer_count]];
  const answerTable = <div className="exam-table-scroll" role="region" aria-label="پاسخ‌های آزمون" tabIndex={0}><table>
      <thead><tr><th scope="col">شماره</th><th scope="col">{student ? "پاسخ شما" : "پاسخ دانش‌آموز"}</th><th scope="col">پاسخ صحیح</th><th scope="col">وضعیت</th></tr></thead>
      <tbody>{result.answers.map(row => <tr key={row.order}><td>{row.order.toLocaleString("fa-IR")}</td><td>{row.answer || "—"}</td><td>{row.correct_answer || "—"}</td><td><span className={`exam-answer-state ${row.is_correct === true ? "correct" : row.is_correct === false ? "wrong" : "unknown"}`}>{row.is_correct === null ? "نامشخص" : row.is_correct ? "درست" : "غلط"}</span></td></tr>)}</tbody>
    </table></div>;
  return <section className="exam-results" aria-label="نتیجه آزمون">
    <div className="exam-section-heading"><h3>کارنامه آزمون</h3><span>خلاصه عملکرد</span></div>
    <dl className="exam-result-metrics">{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value == null ? "—" : value.toLocaleString("fa-IR")}</dd></div>)}</dl>
    {result.answers.length ? collapseAnswers ? <details className="exam-answer-details"><summary>مشاهده جزئیات</summary>{answerTable}</details> : answerTable : <p className="exam-muted">جزئیات پاسخ‌ها هنوز دریافت نشده است.</p>}
  </section>;
}

export function ExamSkeleton() {
  return <div className="exam-grid" role="status" aria-label="در حال دریافت آزمون‌ها">{[0, 1, 2].map(key => <div className="exam-card exam-skeleton" key={key}><span/><span/><span/></div>)}</div>;
}

export function examDate(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeZone: "Asia/Tehran" }).format(new Date(value));
}
