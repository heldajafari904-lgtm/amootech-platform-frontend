"use client";

import { useEffect, useState } from "react";
import { allPages, api } from "@/lib/api";
import { DailyReportItem, ReportStudent } from "@/lib/dailyReports";
import { AcademicOption, Kind, kindLabel, planningError } from "@/lib/planning";

type Grade = { id: number; name: string };
type Field = { id: number; grade: number; name: string };
type Form = { kind: Kind | ""; title: string; subject: string; chapter: string; topic: string; duration: string; tests: string; wrong: string; resource: string; note: string; start: string; end: string };

export default function UnplannedEditor({ token, student, initial, onSave, onCancel }: {
  token: string; student: ReportStudent; initial?: DailyReportItem;
  onSave: (values: Record<string, string | number | null>) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [grade, setGrade] = useState(String(student.grade || ""));
  const [category, setCategory] = useState<"" | "academic" | "event">(initial ? initial.kind === "EVENT" ? "event" : "academic" : "");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<AcademicOption[]>([]);
  const [chapters, setChapters] = useState<AcademicOption[]>([]);
  const [topics, setTopics] = useState<AcademicOption[]>([]);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [topicSearch, setTopicSearch] = useState("");
  const [form, setForm] = useState<Form>({
    kind: initial?.kind || "", title: initial?.title || "", subject: String(initial?.subject || ""),
    chapter: String(initial?.chapter || ""), topic: String(initial?.topic || ""),
    duration: initial?.start_time && initial?.end_time ? "" : initial?.actual_duration_minutes === null || initial?.actual_duration_minutes === undefined ? "" : String(initial.actual_duration_minutes),
    tests: initial?.actual_test_count === null || initial?.actual_test_count === undefined ? "" : String(initial.actual_test_count),
    wrong: initial?.wrong_count === null || initial?.wrong_count === undefined ? "" : String(initial.wrong_count),
    resource: initial?.resource || "", note: initial?.note || "", start: initial?.start_time || "", end: initial?.end_time || "",
  });
  const [loading, setLoading] = useState(false);
  const [fieldMissing, setFieldMissing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { let live = true; allPages<Grade>("/academics/grades/", token).then((data) => { if (live) setGrades(data); }).catch((reason) => { if (live) setError(planningError(reason)); }); return () => { live = false; }; }, [token]);
  useEffect(() => {
    if (!initial?.subject) return;
    let live = true;
    api<AcademicOption>(`/academics/subjects/${initial.subject}/`, token)
      .then((subject) => api<Field>(`/academics/fields/${subject.field}/`, token))
      .then((field) => { if (live) setGrade(String(field.grade)); })
      .catch((reason) => { if (live) setError(planningError(reason)); });
    return () => { live = false; };
  }, [initial?.subject, token]);
  useEffect(() => {
    if (!grade || !student.field_name) return;
    let live = true;
    Promise.resolve().then(() => setLoading(true));
    allPages<Field>(`/academics/fields/?grade=${grade}`, token).then(async (fields) => {
      const field = fields.find((entry) => entry.name.trim() === student.field_name?.trim());
      if (!live) return;
      if (!field) { setFieldMissing(true); setSubjects([]); return; }
      setFieldMissing(false);
      const data = await allPages<AcademicOption>(`/academics/subjects/?field=${field.id}`, token);
      if (live) setSubjects(data);
    }).catch((reason) => { if (live) setError(planningError(reason)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [grade, student.field_name, token]);
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

  function changeGrade(value: string) { setGrade(value); setSubjects([]); setChapters([]); setTopics([]); setSubjectSearch(""); setTopicSearch(""); setForm((current) => ({ ...current, subject: "", chapter: "", topic: "" })); }
  function changeSubject(value: string) { setChapters([]); setTopics([]); setTopicSearch(""); setForm((current) => ({ ...current, subject: value, chapter: "", topic: "" })); }
  function changeChapter(value: string) { setTopics([]); setTopicSearch(""); setForm((current) => ({ ...current, chapter: value, topic: "" })); }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy || loading || !form.kind) return;
    if (form.kind !== "EVENT" && form.kind !== "EXAM" && !subjects.some((entry) => String(entry.id) === form.subject)) { setError("درس را از پایه و رشته انتخاب کنید."); return; }
    if (!form.duration && !(form.start && form.end)) { setError("مدت یا ساعت شروع و پایان را وارد کنید."); return; }
    if (Boolean(form.start) !== Boolean(form.end) || (form.start && form.end && form.end <= form.start)) { setError("ساعت پایان باید پس از ساعت شروع باشد."); return; }
    if (form.chapter && !chapters.some((entry) => String(entry.id) === form.chapter)) { setError("فصل انتخاب‌شده با درس سازگار نیست."); return; }
    if (form.topic && !topics.some((entry) => String(entry.id) === form.topic)) { setError("مبحث انتخاب‌شده با فصل سازگار نیست."); return; }
    if (form.kind === "TEST" && (form.tests === "" || form.wrong === "")) { setError("تعداد تست و تعداد غلط را وارد کنید."); return; }
    if (form.kind === "TEST" && Number(form.wrong) > Number(form.tests)) { setError("تعداد غلط نمی‌تواند بیشتر از تعداد تست‌ها باشد."); return; }
    setBusy(true); setError("");
    const academic = form.kind !== "EVENT";
    const values: Record<string, string | number | null> = {
      kind: form.kind, title: form.title.trim(), resource: academic ? form.resource.trim() : "", note: form.note.trim(),
      start_time: form.start || null,
      end_time: form.end || null,
      subject: academic && form.subject ? Number(form.subject) : null,
      chapter: academic && form.chapter ? Number(form.chapter) : null,
      topic: academic && form.topic ? Number(form.topic) : null,
      actual_duration_minutes: form.duration === "" ? null : Number(form.duration),
      duration_source: form.duration === "" ? "" : "MANUAL",
      actual_test_count: form.kind === "TEST" && form.tests !== "" ? Number(form.tests) : null,
      wrong_count: form.kind === "TEST" && form.wrong !== "" ? Number(form.wrong) : null,
    };
    try { if (await onSave(values)) onCancel(); }
    finally { setBusy(false); }
  }

  const academic = form.kind !== "" && form.kind !== "EVENT";
  return <form className="report-unplanned-form" onSubmit={submit} dir="rtl">
    <div className="planning-editor-heading"><h3>{initial ? "ویرایش فعالیت" : "فعالیت خارج از برنامه"}</h3><button type="button" className="planning-subtle" onClick={onCancel}>بستن</button></div>
    <div className="planning-type-picker" role="group" aria-label="دسته فعالیت">
      <button type="button" className={category === "academic" ? "is-selected" : ""} aria-pressed={category === "academic"} onClick={() => { setCategory("academic"); setForm({ kind: "", title: "", subject: "", chapter: "", topic: "", duration: "", tests: "", wrong: "", resource: "", note: "", start: "", end: "" }); }}>فعالیت درسی</button>
      <button type="button" className={category === "event" ? "is-selected" : ""} aria-pressed={category === "event"} onClick={() => { setCategory("event"); setForm({ kind: "EVENT", title: "", subject: "", chapter: "", topic: "", duration: "", tests: "", wrong: "", resource: "", note: "", start: "", end: "" }); }}>رویداد / غیر درسی</button>
    </div>
    {category === "academic" && <div className="planning-type-picker" role="group" aria-label="نوع فعالیت درسی">{(["STUDY", "TEST", "REVIEW"] as Kind[]).map((kind) => <button type="button" className={form.kind === kind ? "is-selected" : ""} key={kind} onClick={() => setForm({ ...form, kind, tests: "", wrong: "" })} aria-pressed={form.kind === kind}>{kindLabel[kind]}</button>)}</div>}
    {form.kind && <>
      {(form.kind === "EXAM" || form.kind === "EVENT") && <label>عنوان *<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}/></label>}
      {academic && <div className="planning-academic-flow"><p className="planning-hint">رشته: {student.field_name || "ثبت نشده"}</p>
        <div className="planning-form-row"><label>پایه *<select required value={grade} onChange={(event) => changeGrade(event.target.value)}><option value="">انتخاب پایه</option>{grades.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label>
          <label>درس {form.kind === "EXAM" ? "(اختیاری)" : "*"}<input type="search" value={subjectSearch} placeholder="جست‌وجوی درس" onChange={(event) => setSubjectSearch(event.target.value)}/><select required={form.kind !== "EXAM"} value={form.subject} disabled={loading || fieldMissing} onChange={(event) => changeSubject(event.target.value)}><option value="">انتخاب درس</option>{subjects.filter((entry) => entry.name.includes(subjectSearch.trim()) || String(entry.id) === form.subject).map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label></div>
        {fieldMissing && <p className="planning-hint">برای این پایه، رشتهٔ دانش‌آموز ثبت نشده است.</p>}
        {form.subject && <div className="planning-form-row"><label>فصل<select value={form.chapter} onChange={(event) => changeChapter(event.target.value)}><option value="">بدون فصل</option>{chapters.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label>{form.chapter && <label>مبحث<input type="search" value={topicSearch} placeholder="جست‌وجوی مبحث" onChange={(event) => setTopicSearch(event.target.value)}/><select value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })}><option value="">بدون مبحث</option>{topics.filter((entry) => entry.name.includes(topicSearch.trim()) || String(entry.id) === form.topic).map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label>}</div>}
      </div>}
      {academic && <label>منبع / توضیح منبع<input maxLength={200} value={form.resource} placeholder="کتاب تست، ویدیو، جزوه…" onChange={(event) => setForm({ ...form, resource: event.target.value })}/></label>}
      <div className="planning-form-row"><label>شروع (اختیاری)<input type="time" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })}/></label><label>پایان (اختیاری)<input type="time" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })}/></label></div>
      <div className="planning-form-row"><label>زمان واقعی (دقیقه) یا ساعت شروع و پایان<input type="number" min="0" inputMode="numeric" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })}/></label>
        {form.kind === "TEST" && <><label>تعداد تست واقعی<input type="number" min="0" inputMode="numeric" value={form.tests} onChange={(event) => setForm({ ...form, tests: event.target.value })}/></label><label>غلط<input type="number" min="0" inputMode="numeric" value={form.wrong} onChange={(event) => setForm({ ...form, wrong: event.target.value })}/></label></>}</div>
      <label>یادداشت کوتاه<input maxLength={500} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })}/></label>
      <p className="planning-error" role="alert">{error}</p><button disabled={busy || loading}>{busy ? "در حال ذخیره…" : "ذخیره فعالیت"}</button>
    </>}
  </form>;
}
