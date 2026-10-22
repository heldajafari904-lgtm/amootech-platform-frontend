"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { ExamErrorState } from "@/components/exams/ExamUI";
import { difficulties, runExclusive, validCounts, practicePayload, type Inventory, type Difficulty, type StudentExam } from "./studentExam";

import { courseDetail, topicNodes, envelope, field, options, coursesForGrade, type Option } from "@/components/exams/taxonomy";
import { creationRequest, creationComplete } from "@/components/exams/creation";

import AutomaticTopicPicker from "./AutomaticTopicPicker";
import { emptyTopics, scopeBreadcrumbs, validTopicSelection } from "./questionBank";

const steps = ["پایه و درس", "مبحث و نوع سوال", "ترکیب سوال‌ها", "زمان و عنوان", "مرور نهایی"];
export default function PracticeBuilder({ token, onCreated, onBusyChange }: { token: string; onCreated: (exam: StudentExam) => void; onBusyChange: (busy: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [grades, setGrades] = useState<Option[]>([]);
  const [courses, setCourses] = useState<Option[]>([]);
  const [grade, setGrade] = useState("");
  const [course, setCourse] = useState("");
  const [detail, setDetail] = useState<{ key: string; data: unknown } | null>(null);
  const [topics, setTopics] = useState(emptyTopics);
  const [negativeScore, setNegativeScore] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [questionType, setQuestionType] = useState("1");
  const [counts, setCounts] = useState<Record<Difficulty, string>>({ easy: "0", medium: "0", hard: "0", very_hard: "0" });
  const [inventory, setInventory] = useState<{ key: string; counts: Inventory } | null>(null);
  const [duration, setDuration] = useState("30");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dataError, setDataError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [inventoryError, setInventoryError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const detailKey = `${grade}:${course}`;
  const taxonomy = detail?.key === detailKey ? detail.data : null;
  const courseOptions = coursesForGrade(courses, grade);
  const courseName = courseOptions.find(row => String(row.id) === course)?.name;
  const nodes = topicNodes(taxonomy);
  const hierarchyValid = validTopicSelection(topics, nodes);
  const scopeLabels = scopeBreadcrumbs(topics, nodes);
  const filters = { grade_id: Number(grade), course_id: Number(course), question_type: Number(questionType), ...topics, consider_used_question: false };
  const inventoryKey = JSON.stringify(filters);
  const available = inventory?.key === inventoryKey ? inventory.counts : null;
  const total = difficulties.reduce((sum, { key }) => sum + (Number(counts[key]) || 0), 0);
  const countsValid = validCounts(counts, available);
  const durationValid = Number.isInteger(Number(duration)) && Number(duration) > 0 && Number(duration) <= 2147483647;
  const finalTitle = title.trim() || `تمرین ${courseName || "شخصی"}`;
  const selectionValid = dataLoaded && !detailError && grades.some(row => String(row.id) === grade) && !dataError && !!courseName && taxonomy !== null && hierarchyValid;

  useEffect(() => {
    let live = true;
    Promise.all([api<unknown>("/exams/provider/grades/", token), api<unknown>("/exams/provider/courses/", token)]).then(([gradeData, courseData]) => {
      const g = envelope(gradeData), c = envelope(courseData);
      const gradeRows = options(Array.isArray(g) ? g : field(g, "grades"), "grade");
      const courseRows = options(Array.isArray(c) ? c : field(c, "courses"), "course");
      if (!Array.isArray(g) || !Array.isArray(c) || gradeRows.length !== g.length || courseRows.length !== c.length || new Set(gradeRows.map(row=>row.id)).size !== gradeRows.length || new Set(courseRows.map(row=>`${field(row.raw,"gradeid")}:${row.id}`)).size !== courseRows.length) throw new Error("ساختار فهرست پایه‌ها و درس‌ها معتبر نیست.");
      if (live) { setGrades(gradeRows); setCourses(courseRows); setDataError(""); setDataLoaded(true); }
    }).catch(reason => { if (live) setDataError(errorMessage(reason)); });
    return () => { live = false; };
  }, [token, revision]);

  useEffect(() => {
    if (!grade || !course) return;
    let live = true;
    api<unknown>("/exams/provider/course-detail/", token, "POST", { grade_id: Number(grade), course_id: Number(course), consider_used_question: false }).then(response => {
      const data = courseDetail(response, Number(course));
      if (live) { setDetail({ key: detailKey, data }); setDetailError(""); }
    }).catch(reason => { if (live) setDetailError(errorMessage(reason)); });
    return () => { live = false; };
  }, [token, grade, course, detailKey, revision]);

  const needsInventory = step >= 2;
  useEffect(() => {
    document.getElementById("practice-step-heading")?.focus();
  }, [step]);
  useEffect(() => {
    if (!selectionValid || !needsInventory) return;
    let live = true;
    const timer = setTimeout(() => {
      setInventoryError("");
      api<Inventory>("/exams/provider/question-count/", token, "POST", JSON.parse(inventoryKey)).then(response => {
        if (!difficulties.every(({ key }) => Number.isInteger(response[key]) && response[key] >= 0)) throw new Error("تعداد سوال‌های موجود در دسترس نیست.");
        if (live) {
          setInventory({ key: inventoryKey, counts: response }); setInventoryError("");
        }
      }).catch(reason => { if (live) setInventoryError(errorMessage(reason)); });
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [token, selectionValid, inventoryKey, revision, needsInventory]);

  function retry() { setDataLoaded(false); setInventory(null); setConfirmed(false); setDetail(null); setDataError(""); setDetailError(""); setInventoryError(""); setRevision(value => value + 1); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 4 || !confirmed || !selectionValid || !countsValid || !durationValid) return;
    await runExclusive(lock, async () => {
      setBusy(true); onBusyChange(true); setError("");
      try {
        const exam = await api<StudentExam>("/exams/automatic/", token, "POST", creationRequest(practicePayload(filters, counts, finalTitle, Number(duration), negativeScore), sessionStorage, "student"));
        creationComplete(sessionStorage, "student");
        onCreated(exam);
      } catch (reason) { setError(errorMessage(reason)); }
      finally { setBusy(false); onBusyChange(false); }
    });
  }
  const canContinue = step === 0 ? !!grade && !!courseName && !dataError : step === 1 ? selectionValid && !detailError : step === 2 ? countsValid : durationValid;
  return <form className="exam-form student-practice-form" onSubmit={submit}>
    <ol className="student-exam-steps" aria-label="مراحل ساخت آزمون">{steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined}><span>{(index + 1).toLocaleString("fa-IR")}</span>{label}</li>)}</ol>
    {courseName && <p className="question-bank-summary exam-wide" aria-label="محدوده انتخاب‌شده">{grades.find(row => String(row.id) === grade)?.name} {" > "} {courseName} {" > "} {scopeLabels.join(" / ") || "کل درس؛ مبحث خاصی انتخاب نشده است"}</p>}
    <h3 className="exam-wide" tabIndex={-1} id="practice-step-heading">{step === 0 ? (grade ? "درس" : "پایه") : steps[step]}</h3>
    {error && <p className="exam-feedback" role="alert">{error}</p>}
    {(dataError || detailError || inventoryError) && <div className="exam-wide"><ExamErrorState message={dataError || detailError || inventoryError} onRetry={retry}/></div>}
    <fieldset disabled={busy}>
      {step === 0 && <>
        {!dataLoaded && !dataError && <p className="exam-muted" role="status">در حال دریافت پایه‌ها و درس‌ها…</p>}
        {dataLoaded && !grades.length && <p className="exam-muted">پایه‌ای برای انتخاب موجود نیست.</p>}
        {grade && dataLoaded && !courseOptions.length && <p className="exam-muted">برای این پایه درسی موجود نیست.</p>}
        {!grade ? <div className="automatic-catalog-tiles exam-wide" role="group" aria-label="پایه">{grades.map(row => <button type="button" className="exam-secondary" key={row.id} onClick={() => { setGrade(String(row.id)); setCourse(""); setTopics(emptyTopics()); setInventory(null); setCounts({easy:"0",medium:"0",hard:"0",very_hard:"0"}); setConfirmed(false); setDetail(null); setDetailError(""); }}>{row.name}</button>)}</div> : <>
          <div className="exam-section-heading exam-wide"><strong>درس</strong><button type="button" className="exam-secondary" onClick={() => { setGrade(""); setCourse(""); setTopics(emptyTopics()); setInventory(null); setCounts({easy:"0",medium:"0",hard:"0",very_hard:"0"}); setConfirmed(false); setDetail(null); setDetailError(""); }}>بازگشت به پایه</button></div>
          <div className="automatic-catalog-tiles exam-wide" role="group" aria-label="درس">{courseOptions.map(row => <button type="button" className="exam-secondary" aria-pressed={String(row.id) === course} key={row.id} onClick={() => { setCourse(String(row.id)); setTopics(emptyTopics()); setInventory(null); setCounts({easy:"0",medium:"0",hard:"0",very_hard:"0"}); setConfirmed(false); setDetail(null); setDetailError(""); setStep(1); }}>{row.name}</button>)}</div>
        </>}
      </>}
      {step === 1 && <>
        {!taxonomy && !detailError && <p className="exam-muted" role="status">در حال دریافت مبحث‌ها…</p>}
        {taxonomy !== null && !nodes.length && <p className="exam-muted">برای این درس فصل یا مبحثی موجود نیست؛ انتخاب همه سؤال‌ها امکان‌پذیر است.</p>}
        {taxonomy !== null && !hierarchyValid && <p role="alert">انتخاب مبحث معتبر نیست؛ دوباره انتخاب کنید.</p>}
        {taxonomy !== null && <AutomaticTopicPicker key={detailKey} taxonomy={taxonomy} selection={topics} onConfirm={() => { if (selectionValid && !detailError) setStep(2); }} onChange={next => { setTopics(next); setInventory(null); setInventoryError(""); setConfirmed(false); }}/>}
        <label>نوع سوال<select value={questionType} onChange={event => { setQuestionType(event.target.value); setInventory(null); setInventoryError(""); setConfirmed(false); }}><option value="1">تستی</option><option value="2">تشریحی</option></select></label>
      </>}
      {step === 2 && <>
        {!available && !inventoryError && <p className="exam-muted" role="status">در حال دریافت تعداد سوال‌های موجود…</p>}
        <div className="exam-difficulties">{difficulties.map(({ key, label }) => <label key={key}>{label}<input type="number" inputMode="numeric" min={0} max={available?.[key] ?? 0} step={1} disabled={!available} value={counts[key]} onChange={event => setCounts(current => ({ ...current, [key]: event.target.value }))}/><small>{Number(counts[key] || 0).toLocaleString("fa-IR")} از {available?.[key].toLocaleString("fa-IR") ?? "—"} سوال</small></label>)}</div>
        {available && difficulties.every(({key}) => available[key] === 0) && <p className="exam-feedback" role="status">برای این محدوده و نوع سؤال، سؤال قابل استفاده‌ای موجود نیست. انتخاب‌ها را تغییر دهید؛ محدوده آزمون خودکار گسترده نمی‌شود.</p>}
        {available && !countsValid && <p className="exam-muted">حداقل یک سوال انتخاب کنید؛ تعداد هر سطح نباید بیشتر از موجودی باشد.</p>}
      </>}
      {step === 3 && <>
        <label>مدت آزمون (دقیقه)<input type="number" inputMode="numeric" min={1} max={2147483647} step={1} required value={duration} onChange={event => setDuration(event.target.value)}/></label>
        <label className="question-bank-check"><input type="checkbox" checked={negativeScore} onChange={e => setNegativeScore(e.target.checked)}/>نمره منفی</label>
        <label>عنوان آزمون<input maxLength={200} value={title} placeholder={`تمرین ${courseName || "شخصی"}`} onChange={event => setTitle(event.target.value)}/></label>
      </>}
      {step === 4 && <p className="exam-wide exam-muted">این آزمون فقط از درس انتخاب‌شده و محدوده نمایش‌داده‌شده ساخته می‌شود؛ موجودی پیش از ساخت دوباره بررسی می‌شود.</p>}
      {step === 4 && <dl className="student-practice-review exam-wide">{[
        ["عنوان", finalTitle], ["پایه", grades.find(row => String(row.id) === grade)?.name || "—"], ["درس", courseName || "—"],
        ["فصل / مبحث", scopeLabels.join(" / ") || "کل درس؛ مبحث خاصی انتخاب نشده است"],
        ["نوع سوال", questionType === "1" ? "تستی" : "تشریحی"], ["نمره منفی", negativeScore ? "دارد" : "ندارد"], ["تعداد کل سوال", total.toLocaleString("fa-IR")],
        ["ترکیب سختی", difficulties.map(({ key, label }) => `${label}: ${Number(counts[key]).toLocaleString("fa-IR")}`).join(" · ")], ["مدت آزمون", `${Number(duration).toLocaleString("fa-IR")} دقیقه`],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      {step === 4 && <label className="question-bank-check exam-wide"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>محدوده، تعداد سؤال‌ها و زمان را تأیید می‌کنم.</label>}
      {step >= 2 && <div className="exam-total"><strong>{total.toLocaleString("fa-IR")} سوال انتخاب‌شده</strong><span>مدت انتخاب‌شده: {Number(duration || 0).toLocaleString("fa-IR")} دقیقه</span></div>}
      <div className="exam-actions exam-wide">
        {step > 0 && <button className="exam-secondary" type="button" onClick={() => { setError(""); setConfirmed(false); setStep(value => value - 1); }}>{step === 4 ? "بازگشت و ویرایش" : "بازگشت"}</button>}
        {step < 4 ? step === 1 ? null : <button className="exam-primary" type="button" disabled={!canContinue} onClick={() => { setInventoryError(""); setStep(value => value + 1); }}>ادامه</button> : <button className="exam-primary" type="submit" disabled={busy || !confirmed || !countsValid || !selectionValid || !durationValid}>{busy ? "در حال ساخت آزمون…" : "ساخت آزمون"}</button>}
      </div>
    </fieldset>
  </form>;
}
