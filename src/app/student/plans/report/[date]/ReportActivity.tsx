"use client";

import { useState } from "react";
import { DailyReportItem, minutesText, reportStatus } from "@/lib/dailyReports";
import { kindLabel } from "@/lib/planning";

type Values = Record<string, number | null | string>;

export default function ReportActivity({ item, onSave, onSameAsPlan, onEdit, onRemove }: {
  item: DailyReportItem;
  onSave: (item: DailyReportItem, values: Values) => Promise<boolean>;
  onSameAsPlan: (item: DailyReportItem) => Promise<void>;
  onEdit: (item: DailyReportItem) => void;
  onRemove: (item: DailyReportItem) => Promise<void>;
}) {
  const [duration, setDuration] = useState(item.duration_source === "MANUAL" ? String(item.entered_actual_duration_minutes ?? "") : "");
  const [testCount, setTestCount] = useState(item.actual_test_count === null ? "" : String(item.actual_test_count));
  const [wrong, setWrong] = useState(item.wrong_count === null ? "" : String(item.wrong_count));
  const [note, setNote] = useState(item.note || "");
  const [busy, setBusy] = useState(false);
  const label = item.title || item.subject_name || kindLabel[item.kind];
  const detail = [item.chapter_name, item.topic_name].filter(Boolean).join(" ← ");
  const canSameAsPlan = item.plan_item && item.duration_source !== "TIMER" &&
    (item.execution_status === "NOT_STARTED" || item.execution_status === "COMPLETED") &&
    (item.planned_duration_minutes !== null || item.planned_test_count !== null);
  async function save(values: Values) {
    if (busy) return;
    setBusy(true);
    try { await onSave(item, values); }
    finally { setBusy(false); }
  }

  async function saveTest() {
    if (testCount === "" || wrong === "") return;
    if (Number(wrong) > Number(testCount)) return;
    await save({ actual_test_count: Number(testCount), wrong_count: Number(wrong) });
  }

  return <article className="report-activity"><div className="report-activity-heading"><span className="planning-badge">{kindLabel[item.kind]}</span><strong>{label}</strong><span className="execution-status">{reportStatus[item.execution_status]}</span></div>
    {detail && <p className="planning-block-detail">{detail}</p>}
    {item.resource && <p className="planning-block-detail">منبع: {item.resource}</p>}
    {item.start_time && item.end_time && <p className="planning-block-detail">{item.start_time} تا {item.end_time}</p>}
    <div className="report-activity-facts">{item.planned_duration_minutes !== null && <span>برنامه: {minutesText(item.planned_duration_minutes)}</span>}{item.actual_duration_minutes !== null && <strong>واقعی: {minutesText(item.actual_duration_minutes)}{item.duration_source === "TIMER" && " · زمان‌سنج"}{item.duration_source === "PLAN" && " · طبق برنامه"}</strong>}{item.planned_test_count !== null && <span>تست برنامه: {item.planned_test_count}</span>}{item.actual_test_count !== null && <strong>تست واقعی: {item.actual_test_count}</strong>}</div>
    {item.kind === "TEST" && <div className="report-quick-test"><label>تعداد تست واقعی<input type="number" min="0" inputMode="numeric" value={testCount} placeholder={item.planned_test_count === null ? "تعداد" : String(item.planned_test_count)} onChange={(event) => setTestCount(event.target.value)}/></label><label>تعداد غلط<input type="number" min="0" inputMode="numeric" value={wrong} onChange={(event) => setWrong(event.target.value)}/></label><button type="button" disabled={busy || testCount === "" || wrong === "" || Number(wrong) > Number(testCount)} onClick={saveTest}>ثبت تست</button>{wrong !== "" && testCount !== "" && Number(wrong) > Number(testCount) && <span className="planning-error">تعداد غلط نمی‌تواند بیشتر از تعداد تست‌ها باشد.</span>}</div>}
    <div className="report-activity-actions">{canSameAsPlan && <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onSameAsPlan(item); } finally { setBusy(false); } }}>طبق برنامه انجام شد</button>}{!item.plan_item && <><button type="button" disabled={busy} onClick={() => onEdit(item)}>ویرایش فعالیت</button><button type="button" disabled={busy} onClick={() => onRemove(item)}>حذف</button></>}</div>
    <details className="report-activity-details"><summary>ثبت زمان و یادداشت</summary><div className="report-detail-fields"><label>زمان واقعی (دقیقه)<input type="number" min="0" inputMode="numeric" value={duration} placeholder={item.actual_duration_minutes === null ? "نامشخص" : String(item.actual_duration_minutes)} onChange={(event) => setDuration(event.target.value)}/></label>{item.kind === "TEST" && item.correct_count !== null && <span>صحیح محاسبه‌شده: {item.correct_count}</span>}{item.kind === "TEST" && item.unanswered_count !== null && <span>نزده ثبت‌شده قبلی: {item.unanswered_count}</span>}</div><label>یادداشت کوتاه<input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)}/></label><div className="report-activity-actions"><button type="button" disabled={busy} onClick={() => save({ note, ...(duration !== "" ? { actual_duration_minutes: Number(duration), duration_source: "MANUAL" } : {}), ...(item.kind === "TEST" && testCount !== "" && wrong !== "" ? { actual_test_count: Number(testCount), wrong_count: Number(wrong) } : {}) })}>ذخیره عملکرد</button>{item.plan_item && item.duration_source === "MANUAL" && <button type="button" disabled={busy} onClick={() => save({ actual_duration_minutes: null, duration_source: "" })}>بازگشت به زمان‌سنج</button>}</div></details>
  </article>;
}
