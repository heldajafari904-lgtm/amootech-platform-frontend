"use client";

import { useEffect, useState } from "react";
import { allPages, api } from "@/lib/api";
import { AcademicOption, Kind, kindLabel, PlanItem, planningError, Student, timeText } from "@/lib/planning";

type GradeOption = { id: number; name: string };
type FieldOption = { id: number; grade: number; name: string };
type Form = { subject: string; chapter: string; topic: string; title: string; planned_duration_minutes: string; test_count: string; start_time: string; end_time: string; note: string };
const empty: Form = { subject: "", chapter: "", topic: "", title: "", planned_duration_minutes: "60", test_count: "", start_time: "", end_time: "", note: "" };

export default function BlockEditor({ token, dayId, ordering, student, grades, initial, onSaved, onCancel }: {
  token: string; dayId: number; ordering: number; student: Student; grades: GradeOption[]; initial?: PlanItem;
  onSaved: () => void; onCancel: () => void;
}) {
  const [kind, setKind] = useState<Kind | null>(initial?.kind || null);
  const [grade, setGrade] = useState(String(student.grade || ""));
  const [form, setForm] = useState<Form>(initial ? {
    subject: String(initial.subject || ""), chapter: String(initial.chapter || ""), topic: String(initial.topic || ""),
    title: initial.title, planned_duration_minutes: String(initial.planned_duration_minutes ?? ""), test_count: String(initial.test_count || ""),
    start_time: timeText(initial.start_time), end_time: timeText(initial.end_time), note: initial.note,
  } : empty);
  const [subjects, setSubjects] = useState<AcademicOption[]>([]);
  const [chapters, setChapters] = useState<AcademicOption[]>([]);
  const [topics, setTopics] = useState<AcademicOption[]>([]);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [topicSearch, setTopicSearch] = useState("");
  const [loadingGrade, setLoadingGrade] = useState(Boolean(initial?.subject));
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [fieldMissing, setFieldMissing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // PlanItem stores a Subject rather than a Grade. Resolve its hierarchy once for editing.
  useEffect(() => {
    if (!initial?.subject) return;
    let live = true;
    Promise.resolve().then(() => setLoadingGrade(true));
    api<AcademicOption>(`/academics/subjects/${initial.subject}/`, token)
      .then((subject) => api<FieldOption>(`/academics/fields/${subject.field}/`, token))
      .then((field) => { if (live) setGrade(String(field.grade)); })
      .catch((reason) => { if (live) setError(planningError(reason)); })
      .finally(() => { if (live) setLoadingGrade(false); });
    return () => { live = false; };
  }, [initial?.subject, token]);

  useEffect(() => {
    if (!grade || !student.field_name) return;
    let live = true;
    Promise.resolve().then(() => { setLoadingSubjects(true); setFieldMissing(false); });
    allPages<FieldOption>(`/academics/fields/?grade=${grade}`, token).then(async (fields) => {
      const field = fields.find((entry) => entry.name.trim() === student.field_name?.trim());
      if (!live) return;
      if (!field) { setFieldMissing(true); setSubjects([]); return; }
      const options = await allPages<AcademicOption>(`/academics/subjects/?field=${field.id}`, token);
      if (live) setSubjects(options);
    }).catch((reason) => { if (live) setError(planningError(reason)); }).finally(() => { if (live) setLoadingSubjects(false); });
    return () => { live = false; };
  }, [grade, student.field_name, token]);

  useEffect(() => {
    if (!form.subject) return;
    let live = true;
    Promise.resolve().then(() => setLoadingChapters(true));
    allPages<AcademicOption>(`/academics/chapters/?subject=${form.subject}`, token)
      .then((data) => { if (live) setChapters(data); })
      .catch((reason) => { if (live) setError(planningError(reason)); })
      .finally(() => { if (live) setLoadingChapters(false); });
    return () => { live = false; };
  }, [form.subject, token]);

  useEffect(() => {
    if (!form.chapter) return;
    let live = true;
    Promise.resolve().then(() => setLoadingTopics(true));
    allPages<AcademicOption>(`/academics/topics/?chapter=${form.chapter}`, token)
      .then((data) => { if (live) setTopics(data); })
      .catch((reason) => { if (live) setError(planningError(reason)); })
      .finally(() => { if (live) setLoadingTopics(false); });
    return () => { live = false; };
  }, [form.chapter, token]);

  function changeGrade(value: string) {
    setGrade(value); setSubjects([]); setChapters([]); setTopics([]); setSubjectSearch(""); setTopicSearch("");
    setForm((current) => ({ ...current, subject: "", chapter: "", topic: "" }));
  }
  function changeSubject(value: string) {
    setChapters([]); setTopics([]); setTopicSearch("");
    setForm((current) => ({ ...current, subject: value, chapter: "", topic: "" }));
  }
  function changeChapter(value: string) {
    setTopics([]); setTopicSearch(""); setForm((current) => ({ ...current, chapter: value, topic: "" }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!kind || busy || loadingGrade || loadingSubjects || loadingChapters || loadingTopics) return;
    setError("");
    if (kind !== "EVENT" && kind !== "EXAM" && (!grade || !form.subject)) { setError("پایه و درس را انتخاب کنید."); return; }
    if (kind !== "EVENT" && form.subject && !subjects.some((entry) => String(entry.id) === form.subject)) { setError("درس انتخاب‌شده با پایه و رشته سازگار نیست."); return; }
    if (form.chapter && !chapters.some((entry) => String(entry.id) === form.chapter)) { setError("فصل انتخاب‌شده با درس سازگار نیست."); return; }
    if (form.topic && !topics.some((entry) => String(entry.id) === form.topic)) { setError("مبحث انتخاب‌شده با فصل سازگار نیست."); return; }
    setBusy(true);
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
    try { await api(`/planning/items/${initial ? `${initial.id}/` : ""}`, token, initial ? "PATCH" : "POST", payload); onSaved(); }
    catch (reason) { setError(planningError(reason)); }
    finally { setBusy(false); }
  }

  if (!kind) return <div className="planning-editor"><strong>نوع فعالیت را انتخاب کنید</strong><div className="planning-type-picker">{(Object.keys(kindLabel) as Kind[]).map((type) => <button type="button" key={type} onClick={() => { setKind(type); setForm({ ...empty, planned_duration_minutes: type === "EVENT" ? "" : "60" }); }}>{kindLabel[type]}</button>)}</div><button type="button" className="planning-subtle" onClick={onCancel}>انصراف</button></div>;
  if (loadingGrade) return <div className="planning-editor"><p>در حال بارگذاری درس این باکس…</p><button type="button" className="planning-subtle" onClick={onCancel}>انصراف</button></div>;

  const academic = kind !== "EVENT";
  const visibleSubjects = subjects.filter((item) => item.name.includes(subjectSearch.trim()) || String(item.id) === form.subject);
  const visibleTopics = topics.filter((item) => item.name.includes(topicSearch.trim()) || String(item.id) === form.topic);
  return <form className="planning-editor" onSubmit={save} dir="rtl"><div className="planning-editor-heading"><strong>{initial ? "ویرایش" : "افزودن"} {kindLabel[kind]}</strong><button type="button" className="planning-subtle" onClick={onCancel}>بستن</button></div>
    {(kind === "EXAM" || kind === "EVENT") && <label>عنوان فعالیت<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={kind === "EVENT" ? "مثلاً باشگاه" : "مثلاً آزمون آزمایشی"}/></label>}
    {academic && <div className="planning-academic-flow"><p className="planning-hint">رشته دانش‌آموز: {student.field_name || "ثبت نشده"}</p><div className="planning-form-row"><label>پایه {kind === "EXAM" ? "(اختیاری)" : "*"}<select required={kind !== "EXAM"} value={grade} onChange={(event) => changeGrade(event.target.value)}><option value="">انتخاب پایه</option>{grades.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label>درس {kind === "EXAM" ? "(اختیاری)" : "*"}<input type="search" placeholder="جست‌وجوی درس" value={subjectSearch} onChange={(event) => setSubjectSearch(event.target.value)} disabled={!grade || loadingSubjects}/><select required={kind !== "EXAM"} value={form.subject} disabled={!grade || loadingSubjects || fieldMissing} onChange={(event) => changeSubject(event.target.value)}><option value="">{loadingSubjects ? "در حال بارگذاری…" : "انتخاب درس"}</option>{visibleSubjects.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label></div>{fieldMissing && <p className="planning-hint">برای این پایه، رشتهٔ دانش‌آموز ثبت نشده است.</p>}{grade && !loadingSubjects && !fieldMissing && subjects.length === 0 && <p className="planning-hint">برای این پایه و رشته هنوز درسی ثبت نشده است.</p>}
    {form.subject && <div className="planning-form-row"><label>فصل (اختیاری)<select value={form.chapter} disabled={loadingChapters || chapters.length === 0} onChange={(event) => changeChapter(event.target.value)}><option value="">{loadingChapters ? "در حال بارگذاری…" : "بدون فصل"}</option>{chapters.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>{form.chapter && <label>مبحث (اختیاری)<input type="search" placeholder="جست‌وجوی مبحث" value={topicSearch} onChange={(event) => setTopicSearch(event.target.value)} disabled={loadingTopics}/><select value={form.topic} disabled={loadingTopics || topics.length === 0} onChange={(event) => setForm({ ...form, topic: event.target.value })}><option value="">{loadingTopics ? "در حال بارگذاری…" : "بدون مبحث"}</option>{visibleTopics.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>}</div>}{form.subject && !loadingChapters && chapters.length === 0 && <p className="planning-hint">برای این درس هنوز فصلی ثبت نشده است.</p>}{form.chapter && !loadingTopics && topics.length === 0 && <p className="planning-hint">برای این فصل هنوز مبحثی ثبت نشده است.</p>}</div>}
    <div className="planning-form-row">{kind === "TEST" && <label>تعداد تست *<input required type="number" min="1" value={form.test_count} onChange={(event) => setForm({ ...form, test_count: event.target.value })}/></label>}<label>مدت (دقیقه) {kind === "EVENT" ? "(اختیاری)" : "*"}<input type="number" min="1" required={kind !== "EVENT"} value={form.planned_duration_minutes} onChange={(event) => setForm({ ...form, planned_duration_minutes: event.target.value })}/></label><label>ساعت شروع (اختیاری)<input type="time" required={Boolean(form.end_time)} value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })}/></label><label>ساعت پایان (اختیاری)<input type="time" required={Boolean(form.start_time)} min={form.start_time || undefined} value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })}/></label></div>
    <label>توضیحات (اختیاری)<textarea rows={2} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })}/></label>
    <p className="planning-error" role="alert">{error}</p><button disabled={busy || loadingGrade || loadingSubjects || loadingChapters || loadingTopics}>{busy ? "در حال ذخیره…" : "ذخیره باکس"}</button>
  </form>;
}
