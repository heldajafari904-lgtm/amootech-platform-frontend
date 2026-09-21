"use client";

import { useEffect, useState } from "react";
import { allPages, api } from "@/lib/api";
import { AcademicOption, Kind, kindLabel, PlanItem, planningError, timeText } from "@/lib/planning";

type Form = { subject: string; chapter: string; topic: string; title: string; planned_duration_minutes: string; test_count: string; start_time: string; end_time: string; note: string };
const empty: Form = { subject: "", chapter: "", topic: "", title: "", planned_duration_minutes: "60", test_count: "", start_time: "", end_time: "", note: "" };

export default function BlockEditor({ token, dayId, ordering, subjects, initial, onSaved, onCancel }: {
  token: string; dayId: number; ordering: number; subjects: AcademicOption[]; initial?: PlanItem;
  onSaved: () => void; onCancel: () => void;
}) {
  const [kind, setKind] = useState<Kind | null>(initial?.kind || null);
  const [form, setForm] = useState<Form>(initial ? {
    subject: String(initial.subject || ""), chapter: String(initial.chapter || ""), topic: String(initial.topic || ""),
    title: initial.title, planned_duration_minutes: String(initial.planned_duration_minutes ?? ""), test_count: String(initial.test_count || ""),
    start_time: timeText(initial.start_time), end_time: timeText(initial.end_time), note: initial.note,
  } : empty);
  const [chapters, setChapters] = useState<AcademicOption[]>([]);
  const [topics, setTopics] = useState<AcademicOption[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!form.subject) return;
    let live = true;
    allPages<AcademicOption>(`/academics/chapters/?subject=${form.subject}`, token).then((data) => { if (live) setChapters(data); }).catch((reason) => { if (live) setError(planningError(reason)); });
    return () => { live = false; };
  }, [form.subject, token]);
  useEffect(() => {
    if (!form.chapter) return;
    let live = true;
    allPages<AcademicOption>(`/academics/topics/?chapter=${form.chapter}`, token).then((data) => { if (live) setTopics(data); }).catch((reason) => { if (live) setError(planningError(reason)); });
    return () => { live = false; };
  }, [form.chapter, token]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!kind) return;
    setBusy(true); setError("");
    const academic = kind !== "EVENT";
    const payload = {
      plan_day: dayId, kind, ordering: initial?.ordering ?? ordering, title: form.title.trim(),
      planned_duration_minutes: form.planned_duration_minutes ? Number(form.planned_duration_minutes) : null,
      start_time: form.start_time || null, end_time: form.end_time || null, note: form.note,
      subject: academic && form.subject ? Number(form.subject) : null,
      chapter: academic && form.chapter ? Number(form.chapter) : null,
      topic: academic && form.topic ? Number(form.topic) : null,
      test_count: kind === "TEST" ? Number(form.test_count) : null,
    };
    try {
      await api(`/planning/items/${initial ? `${initial.id}/` : ""}`, token, initial ? "PATCH" : "POST", payload);
      onSaved();
    } catch (reason) { setError(planningError(reason)); }
    finally { setBusy(false); }
  }

  if (!kind) return <div className="planning-editor"><strong>نوع باکس را انتخاب کنید</strong><div className="planning-type-picker">{(Object.keys(kindLabel) as Kind[]).map((type) => <button type="button" key={type} onClick={() => { setKind(type); setForm({ ...empty, planned_duration_minutes: type === "EVENT" ? "" : "60" }); }}>{kindLabel[type]}</button>)}</div><button type="button" className="planning-subtle" onClick={onCancel}>انصراف</button></div>;

  const academic = kind !== "EVENT";
  return <form className="planning-editor" onSubmit={save}><div className="planning-editor-heading"><strong>{initial ? "ویرایش" : "افزودن"} {kindLabel[kind]}</strong><button type="button" className="planning-subtle" onClick={onCancel}>بستن</button></div>
    {(kind === "EXAM" || kind === "EVENT") && <label>عنوان<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={kind === "EVENT" ? "مثلاً باشگاه" : "مثلاً آزمون آزمایشی"}/></label>}
    {academic && <div className="planning-form-row"><label>درس {kind === "EXAM" ? "(اختیاری)" : ""}<select required={kind !== "EXAM"} value={form.subject} onChange={(event) => { setChapters([]); setTopics([]); setForm({ ...form, subject: event.target.value, chapter: "", topic: "" }); }}><option value="">انتخاب درس</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label>فصل (اختیاری)<select value={form.chapter} disabled={!form.subject} onChange={(event) => { setTopics([]); setForm({ ...form, chapter: event.target.value, topic: "" }); }}><option value="">بدون فصل</option>{chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}</select></label><label>مبحث (اختیاری)<select value={form.topic} disabled={!form.chapter} onChange={(event) => setForm({ ...form, topic: event.target.value })}><option value="">بدون مبحث</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label></div>}
    <div className="planning-form-row">{kind === "TEST" && <label>تعداد تست<input required type="number" min="1" value={form.test_count} onChange={(event) => setForm({ ...form, test_count: event.target.value })}/></label>}<label>مدت (دقیقه) {kind === "EVENT" ? "(اختیاری)" : ""}<input type="number" min="1" required={kind !== "EVENT"} value={form.planned_duration_minutes} onChange={(event) => setForm({ ...form, planned_duration_minutes: event.target.value })}/></label><label>شروع (اختیاری)<input type="time" required={Boolean(form.end_time)} value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })}/></label><label>پایان (اختیاری)<input type="time" required={Boolean(form.start_time)} value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })}/></label></div>
    <label>یادداشت (اختیاری)<textarea rows={2} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })}/></label>
    <p className="planning-error" role="alert">{error}</p><button disabled={busy}>{busy ? "در حال ذخیره…" : "ذخیره باکس"}</button>
  </form>;
}
