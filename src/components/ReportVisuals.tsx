import { minutesText } from "@/lib/dailyReports";
import { persianDate } from "@/lib/planning";
import type { ReportMetric, ReportResponse } from "@/lib/reports";

export function reportValue(value: number, metric: ReportMetric) {
  return metric === "tests" ? `${value}` : metric === "plan" ? `${value}٪` : minutesText(value);
}

export function ReportSummary({ report, audience = "student" }: { report: ReportResponse; audience?: "student" | "counselor" }) {
  const remaining = report.summary.planned_minutes - report.summary.actual_minutes;
  return <section className="report-summary"><h2>خلاصه عملکرد</h2><div className="report-summary-grid report-summary-four">
    <strong>{audience === "student" ? "مطالعه من" : "عملکرد دانش‌آموز"}<span>{minutesText(report.summary.actual_minutes)}</span></strong>
    <strong>برنامه مشاور<span>{minutesText(report.summary.planned_minutes)}</span><small>{remaining > 0 ? `${minutesText(remaining)} باقی‌مانده` : remaining < 0 ? `${minutesText(-remaining)} بیشتر از برنامه` : "مطابق برنامه"}</small></strong>
    <strong>{audience === "student" ? "تست‌های من" : "تست واقعی"}<span>{report.summary.actual_tests}</span><small>برنامه: {report.summary.planned_tests}</small></strong>
    <strong>اجرای برنامه<span>{report.summary.completion_percent === null ? "—" : `${report.summary.completion_percent}٪`}</span><small>{report.summary.completed_blocks} از {report.summary.planned_blocks} باکس</small></strong>
  </div></section>;
}

export function TrendChart({ report }: { report: ReportResponse }) {
  const max = Math.max(1, ...report.trend.map((day) => day.value));
  const label = report.metric === "tests" ? "روند تست" : report.metric === "plan" ? "روند اجرای برنامه" : "روند مطالعه واقعی";
  if (!report.trend.some((day) => day.value > 0)) return <section className="report-section"><h2>{label}</h2><p className="report-empty">برای این بازه هنوز عملکردی ثبت نشده است.</p></section>;
  return <section className="report-section"><h2>{label}</h2><div className="reports-chart" role="img" aria-label={`${label} با مقادیر عددی`}>
    {report.trend.map((day) => <div className="reports-bar" key={day.date} title={`${persianDate(day.date)}: ${reportValue(day.value, report.metric)}`}><b>{reportValue(day.value, report.metric)}</b><span style={{ height: `${Math.max(day.value ? 7 : 2, day.value / max * 78)}%` }}/><small>{report.trend.length <= 7 ? persianDate(day.date).split("،")[0] : day.date.slice(8)}</small></div>)}
  </div></section>;
}

export function PlannedActualChart({ report }: { report: ReportResponse }) {
  const max = Math.max(1, ...report.days.flatMap((day) => [day.planned_minutes, day.actual_minutes]));
  return <section className="report-section"><h2>برنامه مشاور در برابر عملکرد</h2><div className="planned-actual-chart">{report.days.map((day) => <div className="planned-actual-day" key={day.date}><strong>{report.days.length <= 7 ? persianDate(day.date).split("،")[0] : day.date.slice(8)}</strong><div><span className="planned-bar" style={{ width: `${day.planned_minutes / max * 100}%` }}/><small>برنامه {minutesText(day.planned_minutes)}</small></div><div><span className="actual-bar" style={{ width: `${day.actual_minutes / max * 100}%` }}/><small>عملکرد {minutesText(day.actual_minutes)}</small></div></div>)}</div></section>;
}

export function SubjectDistribution({ report }: { report: ReportResponse }) {
  const rows = report.subjects.filter((subject) => subject.actual_minutes > 0).sort((a, b) => b.actual_minutes - a.actual_minutes);
  return <section className="report-section"><h2>سهم مطالعه هر درس</h2>{rows.length ? <div className="reports-distribution">{rows.map((subject) => <div className="reports-distribution-row" key={subject.id}><span>{subject.name}</span><div className="reports-distribution-track"><span style={{ width: `${subject.distribution_percent}%` }}/></div><strong>{subject.distribution_percent}٪</strong><small>{minutesText(subject.actual_minutes)}</small></div>)}</div> : <p className="report-empty">در این بازه مطالعه درسی ثبت نشده است.</p>}</section>;
}

export function ReportInsights({ report }: { report: ReportResponse }) {
  if (!report.subjects.length) return null;
  const study = [...report.subjects].sort((a, b) => b.actual_minutes - a.actual_minutes)[0];
  const tests = [...report.subjects].sort((a, b) => b.actual_tests - a.actual_tests)[0];
  const behind = [...report.subjects].sort((a, b) => (b.planned_minutes - b.actual_minutes) - (a.planned_minutes - a.actual_minutes))[0];
  const incomplete = report.subjects.reduce((sum, subject) => sum + subject.incomplete, 0);
  return <section className="report-section"><h2>نکات این بازه</h2><div className="report-insights"><div><small>بیشترین زمان مطالعه</small><strong>{study.name}</strong><span>{minutesText(study.actual_minutes)}</span></div><div><small>بیشترین تعداد تست</small><strong>{tests.name}</strong><span>{tests.actual_tests} تست</span></div><div><small>بیشترین زمان باقی‌مانده</small><strong>{behind.name}</strong><span>{minutesText(Math.max(0, behind.planned_minutes - behind.actual_minutes))}</span></div><div><small>باکس‌های ناقص/باقی‌مانده</small><strong>{incomplete}</strong></div></div></section>;
}
