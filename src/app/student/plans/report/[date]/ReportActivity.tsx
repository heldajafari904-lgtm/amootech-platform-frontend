"use client";

import { useRef, useState } from "react";
import { DailyReportItem, minutesText, reportStatus } from "@/lib/dailyReports";
import { kindLabel } from "@/lib/planning";
import { quickLabels, quickStatuses, submittedStatus, type ReportedStatus } from "@/lib/reportQuick";

type Values = Record<string, number | null | string>;

export default function ReportActivity({ item, onSave, onSameAsPlan, onEdit, onRemove, editable = true }: {
  item: DailyReportItem; editable?: boolean;
  onSave: (item: DailyReportItem, values: Values) => Promise<boolean>;
  onSameAsPlan: (item: DailyReportItem) => Promise<void>;
  onEdit: (item: DailyReportItem) => void;
  onRemove: (item: DailyReportItem) => Promise<void>;
}) {
  const [duration, setDuration] = useState(item.duration_source === "MANUAL" ? String(item.entered_actual_duration_minutes ?? "") : "");
  const [testCount, setTestCount] = useState(item.actual_test_count === null ? "" : String(item.actual_test_count));
  const [wrong, setWrong] = useState(item.wrong_count === null ? "" : String(item.wrong_count));
  const [correct, setCorrect] = useState(item.correct_count === null ? "" : String(item.correct_count));
  const [unanswered, setUnanswered] = useState(item.unanswered_count === null ? "" : String(item.unanswered_count));
  const [note, setNote] = useState(item.note || "");
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  function changed(field: string) { setDirty(current => new Set([...current, field])); }
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<ReportedStatus | null>(null);
  const [failed, setFailed] = useState<Values | null>(null);
  const [saved, setSaved] = useState(false);
  const submitting = useRef(false);
  const status = submittedStatus(item);
  const label = item.title || item.subject_name || kindLabel[item.kind];
  const detail = item.taxonomy?.provider ? Object.values(item.taxonomy.labels ?? {}).filter(Boolean).join(" ← ") : [item.chapter_name, item.topic_name].filter(Boolean).join(" ← ");
  const canSameAsPlan = item.plan_item && item.duration_source !== "TIMER" &&
    (item.execution_status === "NOT_STARTED" || item.execution_status === "COMPLETED") &&
    (item.planned_duration_minutes !== null || item.planned_test_count !== null);

  async function save(values: Values) {
    if (submitting.current || !editable) return;
    submitting.current = true; setBusy(true); setSaved(false); setFailed(null);
    setPending((values.reported_status as ReportedStatus) ?? null);
    try {
      if (await onSave(item, values)) setSaved(true); else setFailed(values);
    } catch { setFailed(values); }
    finally { submitting.current = false; setBusy(false); setPending(null); }
  }
  const metrics = (): Values => {
    const values: Values = {};
    if (dirty.has('note')) values.note = note;
    if (dirty.has('duration')) {
      values.actual_duration_minutes = duration === '' ? null : Number(duration);
      values.duration_source = duration === '' ? '' : 'MANUAL';
    }
    if (item.kind === 'TEST') {
      for (const [key, value] of Object.entries({ actual_test_count: testCount, wrong_count: wrong, correct_count: correct, unanswered_count: unanswered })) {
        if (dirty.has(key)) values[key] = value === '' ? null : Number(value);
      }
    }
    return values;
  };

  return <article className="report-activity report-quick-card" data-report-item={item.id} aria-busy={busy}>
    <div className="report-activity-heading"><span className="planning-badge">{kindLabel[item.kind]}</span><strong>{label}</strong><span className="execution-status">{item.plan_item ? status ? quickLabels[status] : 'ثبت نشده' : reportStatus[item.execution_status]}</span></div>
    {item.start_time && item.end_time && <p className="planning-block-detail">{item.start_time} تا {item.end_time}</p>}
    <div className="report-activity-facts">{item.planned_duration_minutes !== null && <span>برنامه: {minutesText(item.planned_duration_minutes)}</span>}{item.planned_test_count !== null && <span>تست برنامه: {item.planned_test_count}</span>}{item.actual_duration_minutes !== null && <strong>واقعی: {minutesText(item.actual_duration_minutes)}</strong>}{item.actual_test_count !== null && <strong>تست واقعی: {item.actual_test_count}</strong>}</div>
    {item.plan_item && <div className="report-status-actions" role="group" aria-label={`نتیجه فعالیت ${label}`}>
      {quickStatuses.map(value => <button key={value} type="button" className={`report-status-button ${pending === value || (!pending && status === value) ? 'is-selected' : ''}`} aria-pressed={status === value} disabled={busy || !editable} onClick={() => { if (status !== value || failed) void save({ reported_status: value }); }}>{quickLabels[value]}</button>)}
    </div>}
    <div className="report-save-feedback" role="status" aria-live="polite">{busy ? 'در حال ذخیره…' : saved ? 'ذخیره شد' : item.plan_item && !status ? 'هنوز نتیجه‌ای ثبت نکرده‌اید.' : ''}</div>
    {failed && <div className="report-save-error" role="alert">ذخیره انجام نشد؛ انتخاب قبلی حفظ شده است. <button type="button" disabled={busy || !editable} onClick={() => void save(failed)}>تلاش دوباره</button></div>}
    <details className="report-activity-details"><summary>جزئیات بیشتر</summary>
      {detail && <p className="planning-block-detail">محتوای برنامه: {detail}</p>}
      {item.resource && <p className="planning-block-detail">منبع: {item.resource}</p>}
      {item.plan_item && <p className="planning-hint">وضعیت زمان‌سنج: {reportStatus[item.execution_status]} · نتیجه فعالیت تأیید پوشش دقیق فصل یا مبحث نیست.</p>}
      <fieldset disabled={busy || !editable} className="report-optional-fields"><div className="report-detail-fields"><label>زمان واقعی (دقیقه)<input type="number" min="0" inputMode="numeric" value={duration} placeholder={item.actual_duration_minutes === null ? "نامشخص" : String(item.actual_duration_minutes)} onChange={e => { changed('duration'); setDuration(e.target.value); }}/></label></div>
        {item.kind === 'TEST' && <div className="report-detail-fields"><label>تعداد تست واقعی<input type="number" min="0" inputMode="numeric" value={testCount} onChange={e => { changed('actual_test_count'); setTestCount(e.target.value); }}/></label><label>صحیح<input type="number" min="0" inputMode="numeric" value={correct} onChange={e => { changed('correct_count'); setCorrect(e.target.value); }}/></label><label>غلط<input type="number" min="0" inputMode="numeric" value={wrong} onChange={e => { changed('wrong_count'); setWrong(e.target.value); }}/></label><label>نزده<input type="number" min="0" inputMode="numeric" value={unanswered} onChange={e => { changed('unanswered_count'); setUnanswered(e.target.value); }}/></label></div>}
        <label>یادداشت کوتاه<input maxLength={500} value={note} onChange={e => { changed('note'); setNote(e.target.value); }}/></label><div className="report-activity-actions"><button type="button" onClick={() => void save(metrics())}>ذخیره جزئیات</button>{item.plan_item && item.duration_source === 'MANUAL' && <button type="button" onClick={() => void save({ actual_duration_minutes: null, duration_source: '' })}>بازگشت به زمان‌سنج</button>}
        {canSameAsPlan && <button type="button" onClick={async () => { if (submitting.current) return; submitting.current = true; setBusy(true); try { await onSameAsPlan(item); } finally { submitting.current = false; setBusy(false); } }}>ثبت مقادیر طبق برنامه</button>}
        {!item.plan_item && <><button type="button" onClick={() => onEdit(item)}>ویرایش فعالیت</button><button type="button" onClick={() => onRemove(item)}>حذف</button></>}
      </div></fieldset>
    </details>
  </article>;
}
