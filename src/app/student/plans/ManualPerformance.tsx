"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { DailyReport, DailyReportItem } from "@/lib/dailyReports";
import { kindLabel, type PlanItem } from "@/lib/planning";

export default function ManualPerformance({ item, date, token, status, timerMinutes, onSaved, onClose }: {
  item: PlanItem; date: string; token: string; status: "COMPLETED" | "PARTIAL"; timerMinutes?: number;
  onSaved: () => Promise<void>; onClose: () => void;
}) {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [row, setRow] = useState<DailyReportItem | null>(null);
  const [duration, setDuration] = useState("");
  const [tests, setTests] = useState("");
  const [wrong, setWrong] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => { sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, []);
  useEffect(() => {
    let live = true;
    api<DailyReport>("/daily-reports/open/", token, "POST", { date }).then((data) => {
      if (!live) return;
      const found = data.items.find((entry) => entry.plan_item === item.id);
      setReport(data); setRow(found || null);
      if (found) {
        setDuration(String(found.duration_source === "MANUAL" ? found.entered_actual_duration_minutes ?? "" : timerMinutes ?? found.actual_duration_minutes ?? ""));
        setTests(found.actual_test_count === null ? "" : String(found.actual_test_count));
        setWrong(found.wrong_count === null ? "" : String(found.wrong_count));
      }
    }).catch((reason) => { if (live) setError(errorMessage(reason)); });
    return () => { live = false; };
  }, [date, item.id, timerMinutes, token]);

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!report || !row || busy) return;
    if (item.kind !== "EVENT" && duration === "") { setError("زمان واقعی را وارد کنید."); return; }
    if (item.kind === "TEST" && (tests === "" || wrong === "")) { setError("تعداد تست و تعداد غلط را وارد کنید."); return; }
    if (item.kind === "TEST" && Number(wrong) > Number(tests)) { setError("تعداد غلط نمی‌تواند بیشتر از تعداد تست‌ها باشد."); return; }
    setBusy(true); setError("");
    const values: Record<string, string | number | null> = { completion_status: status };
    // An unchanged timer value remains timer-sourced. A correction becomes the single manual value.
    if (duration !== "" && (timerMinutes === undefined || Number(duration) !== timerMinutes || row.duration_source === "MANUAL")) {
      values.actual_duration_minutes = Number(duration);
    }
    if (item.kind === "TEST") {
      values.actual_test_count = Number(tests);
      values.wrong_count = Number(wrong);
    }
    try {
      await api(`/daily-reports/${report.id}/planned/${item.id}/`, token, "PUT", values);
      await onSaved(); onClose();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  return <section ref={sectionRef} className="report-unplanned-form manual-performance" aria-label="ثبت عملکرد">
    <div className="planning-editor-heading"><h3>{status === "PARTIAL" ? "ثبت عملکرد ناقص" : "اتمام و ثبت عملکرد"} · {item.subject_name || item.title || kindLabel[item.kind]}</h3><button type="button" className="planning-subtle" onClick={onClose}>بازگشت</button></div>
    {!row && !error && <p>در حال آماده‌سازی…</p>}
    {row && <form onSubmit={save}><p className="planning-hint">برنامه: {item.planned_duration_minutes ?? "—"} دقیقه{item.test_count !== null && ` · ${item.test_count} تست`}</p>
      {item.kind !== "EVENT" && <label>چقدر زمان گذاشتی؟ (دقیقه)<input required type="number" min="0" inputMode="numeric" value={duration} onChange={(event) => setDuration(event.target.value)}/></label>}
      {item.kind === "TEST" && <div className="planning-form-row"><label>چند تست زدی؟<input required type="number" min="0" inputMode="numeric" value={tests} onChange={(event) => setTests(event.target.value)}/></label><label>چند غلط داشتی؟<input required type="number" min="0" inputMode="numeric" value={wrong} onChange={(event) => setWrong(event.target.value)}/></label></div>}
      <button disabled={busy}>{busy ? "در حال ذخیره…" : status === "PARTIAL" ? "ثبت عملکرد ناقص" : "ثبت و اتمام"}</button>
    </form>}
    <p className="planning-error" role="alert">{error}</p>
  </section>;
}
