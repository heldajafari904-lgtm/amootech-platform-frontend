"use client";
import JalaliDateInput from "@/components/JalaliDateInput";

import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { examDateTime, scheduleDraft, schedulePayload, type ScheduleField } from "@/components/exams/schedule";
import type { CounselorExam } from "./workspace";

const fields: { key: ScheduleField; label: string }[] = [
  { key: "scheduled_start_at", label: "شروع آزمون" },
  { key: "participation_deadline_at", label: "مهلت شروع شرکت" },
  { key: "result_release_at", label: "انتشار نتیجه" },
];
export default function SchedulePanel({ exam, token, onExam, onBusyChange }: {
  exam: CounselorExam; token: string; onExam: (exam: CounselorExam) => void; onBusyChange: (busy: boolean) => void;
}) {
  const [current, setCurrent] = useState(exam);
  const [draft, setDraft] = useState(() => scheduleDraft(exam));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const callbacks = useRef({ onExam, onBusyChange });
  useEffect(() => { callbacks.current = { onExam, onBusyChange }; }, [onExam, onBusyChange]);
  useEffect(() => {
    let live = true;
    api<CounselorExam>(`/exams/${exam.id}/schedule/`, token).then(value => {
      if (!live) return;
      setCurrent(value); setDraft(scheduleDraft(value)); setLoaded(true); setError("");
      callbacks.current.onExam(value);
    }).catch(reason => { if (live) setError(errorMessage(reason)); });
    return () => { live = false; };
  }, [exam.id, token, revision]);

  function change(key: ScheduleField, part: "date" | "time", value: string) {
    setDraft(current => ({ ...current, [key]: { ...current[key], [part]: value } }));
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !loaded || current.schedule_locked) return;
    lock.current = true; setBusy(true); callbacks.current.onBusyChange(true); setError(""); setNotice("");
    try {
      const updated = await api<CounselorExam>(`/exams/${exam.id}/schedule/`, token, "PATCH", schedulePayload(draft));
      setCurrent(updated); setDraft(scheduleDraft(updated)); callbacks.current.onExam(updated);
      setNotice("زمان‌بندی آزمون ذخیره شد.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { lock.current = false; setBusy(false); callbacks.current.onBusyChange(false); }
  }
  const disabled = busy || !loaded || !!current.schedule_locked;
  return <section className="exam-schedule" aria-labelledby="exam-schedule-title" aria-busy={busy || (!loaded && !error)}>
    <h3 id="exam-schedule-title">زمان‌بندی و برگزاری</h3>
    <p className="exam-muted">همه ساعت‌ها به وقت تهران است. تاریخ‌ها شمسی هستند.</p>
    <p><strong>{current.availability?.label ?? "در حال بررسی وضعیت…"}</strong> · مدت ثبت‌شده: {current.duration_minutes?.toLocaleString("fa-IR") ?? "—"} دقیقه</p>
    <p className="exam-muted">مدت آزمون هنگام ساخت تعیین شده و در این بخش قابل تغییر نیست.</p>
    <dl className="exam-details-fields">{fields.map(({ key, label }) => <div key={key}><dt>{label}</dt><dd>{key === "result_release_at" && !current[key] ? "بدون تأخیر در آموزتک" : examDateTime(current[key])}</dd></div>)}</dl>
    {!loaded && !error && <p role="status">در حال دریافت زمان‌بندی…</p>}
    {error && <div className="exam-feedback" role="alert"><p>{error}</p><button className="exam-secondary" type="button" disabled={busy} onClick={() => { setLoaded(false); setRevision(value => value + 1); }}>بازخوانی زمان‌بندی</button></div>}
    {notice && <p role="status" className="participant-success">{notice}</p>}
    {current.schedule_locked && <p role="status" className="exam-muted">مشارکت در آزمون آغاز شده است؛ زمان‌بندی قابل تغییر نیست.</p>}
    <form onSubmit={save}>
      <fieldset disabled={disabled} className="exam-schedule-fields"><legend>تنظیم زمان‌بندی</legend>
        {fields.map(({ key, label }) => <div key={key} className="exam-schedule-pair"><label>تاریخ {label} (شمسی)<JalaliDateInput value={draft[key].date} onChange={event => change(key, "date", event.target.value)}/></label><label>ساعت {label}<input type="time" step="1" value={draft[key].time} onChange={event => change(key, "time", event.target.value)}/></label></div>)}
        <p className="exam-muted">هر دو ورودی خالی یعنی بدون محدودیت زمانی در آن بخش. مهلت، آخرین زمان ورود است؛ انتشار نتیجه باید پس از آن به‌اندازه مدت آزمون فاصله داشته باشد.</p>
        <div className="exam-actions"><button className="exam-primary" type="submit">{busy ? "در حال ذخیره…" : "ذخیره زمان‌بندی"}</button><button className="exam-secondary" type="button" onClick={() => { setDraft(scheduleDraft(current)); setError(""); setNotice(""); }}>انصراف</button><button className="exam-secondary" type="button" onClick={() => setDraft(scheduleDraft({}))}>پاک‌کردن زمان‌بندی</button></div>
      </fieldset>
    </form>
    <p className="exam-muted">این محدودیت‌ها در آموزتک اعمال می‌شوند؛ لینک‌های مستقیم Quiz24 تابع تنظیمات همان سرویس هستند.</p>
  </section>;
}
