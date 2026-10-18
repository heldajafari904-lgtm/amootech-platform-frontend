"use client";

import { useEffect, useRef, useState } from "react";
import { ResultDetails, ExamSkeleton, ExamPageHeader, ExamSectionNav, ExamStatusBadge, ExamEmptyState, ExamErrorState, examDate, type ExamResult } from "@/components/exams/ExamUI";
import { allPages, api, errorMessage, type User } from "@/lib/api";
import { useDialogFocus } from "@/components/counselor/PanelUI";
import { emptyFilters, matchesExamFilters, inExamSection, primaryExamAction, needsExamAction, type CounselorExam as Exam } from "./workspace";
import "./workspace.css";
import { useCounselor } from "@/lib/counselorContext";

import { field as taxonomyField, options as taxonomyOptions, courseDetail, hierarchySelection, coursesForGrade, type Option as TaxonomyOption } from "@/components/exams/taxonomy";
import { creationRequest, creationComplete } from "@/components/exams/creation";

type Student = { id: number; user: User };
type Grade = { id: number; name: string };
function studentName(student: Student) {
  return `${student.user.first_name} ${student.user.last_name}`.trim() || student.user.username;
}

function providerGrades(response: unknown): Grade[] {
  if (!response || typeof response !== "object") throw new Error("پاسخ پایه‌های آزمون‌ساز معتبر نیست.");
  const envelope = taxonomyField(response, "result", "data") ?? response;
  const rows = Array.isArray(envelope) ? envelope : taxonomyField(envelope, "grades");
  if (!Array.isArray(rows)) throw new Error("فهرست پایه‌های آزمون‌ساز معتبر نیست.");
  return rows.map(value => {
    if (!value || typeof value !== "object") throw new Error("اطلاعات پایه آزمون‌ساز معتبر نیست.");
    const id = Number(taxonomyField(value, "id", "gradeid"));
    const name = taxonomyField(value, "name", "title", "gradename");
    if (!Number.isInteger(id) || id <= 0 || typeof name !== "string") throw new Error("اطلاعات پایه آزمون‌ساز معتبر نیست.");
    return { id, name };
  });
}

type Difficulty = "easy" | "medium" | "hard" | "very_hard";
type Inventory = Record<Difficulty, number>;
const difficulties: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "آسان" }, { key: "medium", label: "متوسط" },
  { key: "hard", label: "سخت" }, { key: "very_hard", label: "خیلی سخت" },
];

function AutomaticExamForm({ token, student, grades, onCreated, onBusyChange }: { token: string; student: string; grades: Grade[]; onCreated: (exam: Exam) => void; onBusyChange: (busy: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [courses, setCourses] = useState<TaxonomyOption[]>([]);
  const [course, setCourse] = useState("");
  const [detail, setDetail] = useState<{ grade: string; course: string; considerUsed: boolean; data: unknown } | null>(null);
  const [chapter, setChapter] = useState("");
  const [subject, setSubject] = useState("");
  const [object, setObject] = useState("");
  const [questionType, setQuestionType] = useState("1");
  const [duration, setDuration] = useState("60");
  const [negativeScore, setNegativeScore] = useState(false);
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [considerUsed, setConsiderUsed] = useState(false);
  const [counts, setCounts] = useState<Record<Difficulty, string>>({ easy: "0", medium: "0", hard: "0", very_hard: "0" });
  const [inventory, setInventory] = useState<{ key: string; counts: Inventory } | null>(null);
  const [error, setError] = useState("");
  const [providerRevision, setProviderRevision] = useState(0);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [courseError, setCourseError] = useState("");
  const [taxonomyError, setTaxonomyError] = useState("");
  const [inventoryError, setInventoryError] = useState("");
  const [inventoryRevision, setInventoryRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const courseOptions = coursesForGrade(courses, grade);
  const taxonomy = detail?.course === course && detail.grade === grade && detail.considerUsed === considerUsed ? detail.data : null;
  const { chapters, subjects, objects, valid: hierarchyValid } = hierarchySelection(taxonomy, chapter, subject, object);
  const filters = {
    grade_id: Number(grade), course_id: Number(course), question_type: Number(questionType),
    chapter_ids: chapter ? [Number(chapter)] : [], subject_ids: subject ? [Number(subject)] : [], object_ids: object ? [Number(object)] : [],
    ...(fromYear ? { from_year: Number(fromYear) } : {}), ...(toYear ? { to_year: Number(toYear) } : {}),
    consider_used_question: considerUsed,
  };
  const inventoryKey = JSON.stringify(filters);
  const available = inventory?.key === inventoryKey ? inventory.counts : null;
  const selectionValid = !!grade && !!course && courseOptions.some(row => String(row.id) === course) && taxonomy !== null && hierarchyValid;
  const countsValid = difficulties.every(({ key }) => counts[key] !== "" && Number.isInteger(Number(counts[key])) && Number(counts[key]) >= 0 && available !== null && Number(counts[key]) <= available[key]);
  const total = difficulties.reduce((sum, { key }) => sum + Number(counts[key]), 0);

  useEffect(() => {
    let live = true;
    api<unknown>("/exams/provider/courses/", token).then(response => {
      const result = taxonomyField(response, "result", "data") ?? response;
      const rows = Array.isArray(result) ? result : taxonomyField(result, "courses");
      const options = taxonomyOptions(rows, "course");
      if (!Array.isArray(rows)) throw new Error("ساختار فهرست درس‌های آزمون‌ساز معتبر نیست.");
      if (live) { setCourses(options); setCoursesLoaded(true); setCourseError(""); }
    }).catch(reason => { if (live) setCourseError(errorMessage(reason)); });
    return () => { live = false; };
  }, [token, providerRevision]);

  useEffect(() => {
    if (!grade || !course) return;
    let live = true;
    setTaxonomyError("");
    setDetail(null);
    api<unknown>("/exams/provider/course-detail/", token, "POST", { grade_id: Number(grade), course_id: Number(course), consider_used_question: considerUsed }).then(response => {
      const data = courseDetail(response, Number(course));
      if (live) setDetail({ grade, course, considerUsed, data });
    }).catch(reason => { if (live) setTaxonomyError(errorMessage(reason)); });
    return () => { live = false; };
  }, [token, grade, course, considerUsed, providerRevision]);

  useEffect(() => {
    if (!selectionValid) return;
    let live = true;
    setInventoryError("");
    const timer = setTimeout(() => {
      api<Inventory>("/exams/provider/question-count/", token, "POST", JSON.parse(inventoryKey)).then(response => {
        if (!difficulties.every(({ key }) => Number.isInteger(response[key]) && response[key] >= 0)) throw new Error("موجودی سوال‌ها معتبر نیست.");
        if (!live) return;
        setInventory({ key: inventoryKey, counts: response });
        setCounts(current => ({
          easy: String(Math.min(Number(current.easy) || 0, response.easy)), medium: String(Math.min(Number(current.medium) || 0, response.medium)),
          hard: String(Math.min(Number(current.hard) || 0, response.hard)), very_hard: String(Math.min(Number(current.very_hard) || 0, response.very_hard)),
        }));
      }).catch(reason => { if (live) setInventoryError(errorMessage(reason)); });
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [token, inventoryKey, selectionValid, inventoryRevision]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !selectionValid || !countsValid || total <= 0) return;
    lock.current = true; setBusy(true); onBusyChange(true); setError("");
    try {
      const { grade_id, ...filterData } = filters;
      const exam = await api<Exam>("/exams/automatic/", token, "POST", creationRequest({
        ...filterData, grade_external_id: grade_id, student: student ? Number(student) : null,
        title: title.trim(), duration_minutes: Number(duration), has_negative_score: negativeScore,
        easy_count: Number(counts.easy), medium_count: Number(counts.medium), hard_count: Number(counts.hard), very_hard_count: Number(counts.very_hard),
      }, sessionStorage, "counselor"));
      creationComplete(sessionStorage, "counselor");
      onCreated(exam); setTitle(""); setInventory(null); setInventoryRevision(value => value + 1);
    } catch (reason) { setError(errorMessage(reason)); setInventory(null); setInventoryRevision(value => value + 1); }
    finally { lock.current = false; setBusy(false); onBusyChange(false); }
  }

  return <form onSubmit={submit} className="exam-form">
    {(error || courseError || taxonomyError || inventoryError) && <p className="exam-feedback" role="alert">{error || courseError || taxonomyError || inventoryError}</p>}
    {(courseError || taxonomyError) && <button className="exam-secondary" type="button" onClick={() => { setCoursesLoaded(false); setCourseError(""); setTaxonomyError(""); setProviderRevision(value => value + 1); }}>دریافت دوباره درس‌ها و مبحث‌ها</button>}
    <fieldset disabled={busy}>
      <legend>تنظیمات آزمون خودکار</legend>
      <label>عنوان آزمون<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)}/></label>
      <label>پایه<select required value={grade} onChange={event => { setGrade(event.target.value); setCourse(""); setDetail(null); setTaxonomyError(""); setInventoryError(""); setChapter(""); setSubject(""); setObject(""); }}><option value="">انتخاب پایه</option>{grades.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      {!coursesLoaded && !courseError && <p role="status" className="exam-muted">در حال دریافت درس‌ها…</p>}
      {grade && coursesLoaded && !courseOptions.length && <p className="exam-muted">برای این پایه درسی موجود نیست.</p>}
      <label>درس<select required disabled={!grade} value={course} onChange={event => { setCourse(event.target.value); setDetail(null); setTaxonomyError(""); setInventoryError(""); setChapter(""); setSubject(""); setObject(""); }}><option value="">انتخاب درس</option>{courseOptions.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      {course && !taxonomy && !taxonomyError && <p role="status" className="exam-muted">در حال دریافت مبحث‌ها…</p>}
      {taxonomy !== null && !chapters.length && <p className="exam-muted">برای این درس فصل یا مبحثی موجود نیست؛ انتخاب همه سؤال‌ها امکان‌پذیر است.</p>}
      {chapter && !subjects.length && <p className="exam-muted">این فصل مبحثی ندارد.</p>}
      {subject && !objects.length && <p className="exam-muted">این مبحث زیرمبحثی ندارد.</p>}
      {taxonomy !== null && !hierarchyValid && <p role="alert">انتخاب مبحث معتبر نیست؛ دوباره انتخاب کنید.</p>}
      <label>فصل<select disabled={!taxonomy} value={chapter} onChange={event => { setChapter(event.target.value); setSubject(""); setObject(""); }}><option value="">همه فصل‌ها</option>{chapters.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label>مبحث<select disabled={!chapter || !subjects.length} value={subject} onChange={event => { setSubject(event.target.value); setObject(""); }}><option value="">همه مبحث‌ها</option>{subjects.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label>زیرمبحث<select disabled={!subject || !objects.length} value={object} onChange={event => setObject(event.target.value)}><option value="">همه زیرمبحث‌ها</option>{objects.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label>نوع سوال<select value={questionType} onChange={event => setQuestionType(event.target.value)}><option value="1">تستی</option><option value="2">تشریحی</option></select></label>
      <label>از سال<input type="number" min={1} max={9999} step={1} value={fromYear} onChange={event => setFromYear(event.target.value)}/></label>
      <label>تا سال<input type="number" min={fromYear || 1} max={9999} step={1} value={toYear} onChange={event => setToYear(event.target.value)}/></label>
      <label><input type="checkbox" checked={considerUsed} onChange={event => { setConsiderUsed(event.target.checked); setChapter(""); setSubject(""); setObject(""); }}/> درنظرگرفتن سوال‌های استفاده‌شده</label>
      <div className="exam-wide exam-muted" role="status">{available ? difficulties.map(({ key, label }) => <span key={key} style={{ marginInlineEnd: 16 }}>{label}: {available[key].toLocaleString("fa-IR")}</span>) : selectionValid && !inventoryError ? "در حال دریافت موجودی…" : "برای دریافت موجودی، پایه و درس را انتخاب کنید."}</div>
      {selectionValid && inventoryError && <button type="button" onClick={() => setInventoryRevision(value => value + 1)}>دریافت دوباره موجودی</button>}
      <div className="exam-difficulties">{difficulties.map(({ key, label }) => <label key={key}>{label}<input aria-label={`تعداد سوال ${label}`} type="number" required min={0} max={available?.[key] ?? 0} step={1} disabled={!available} value={counts[key]} onChange={event => setCounts(current => ({ ...current, [key]: event.target.value }))}/><small>{counts[key] || "۰"} از {available?.[key].toLocaleString("fa-IR") ?? "—"} سوال</small></label>)}</div>
      <div className="exam-total"><strong>{total.toLocaleString("fa-IR")} سوال انتخاب‌شده</strong><span>مدت آزمون: {duration || "—"} دقیقه</span></div>
      <label>زمان آزمون (دقیقه)<input required type="number" min={1} step={1} value={duration} onChange={event => setDuration(event.target.value)}/></label>
      <label><input type="checkbox" checked={negativeScore} onChange={event => setNegativeScore(event.target.checked)}/> نمره منفی</label>
      <div className="exam-wide"><button className="exam-primary" type="submit" disabled={busy || !selectionValid || !countsValid || total <= 0 || !title.trim()}>{busy ? "در حال ساخت…" : "ساخت آزمون خودکار"}</button></div>
    </fieldset>
  </form>;
}

export default function CounselorExams() {
  const { token } = useCounselor();
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gradeError, setGradeError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const createLock = useRef(false);
  const syncLocks = useRef(new Set<number>());
  const [syncing, setSyncing] = useState(new Set<number>());
  const publishLocks = useRef(new Set<number>());
  const [publishing, setPublishing] = useState(new Set<number>());
  const resultLocks = useRef(new Set<number>());
  const [resultBusy, setResultBusy] = useState(new Set<number>());
  const [results, setResults] = useState<Record<number, ExamResult>>({});
  const [student, setStudent] = useState("");
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [questionType, setQuestionType] = useState("1");
  const [duration, setDuration] = useState("60");
  const [negativeScore, setNegativeScore] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [resultErrors, setResultErrors] = useState<Record<number, string>>({});
  const [filters, setFilters] = useState(emptyFilters);
  const [studentStepComplete, setStudentStepComplete] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentError, setStudentError] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  useDialogFocus(selectedExamId !== null, () => setSelectedExamId(null));
  const [section, setSection] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [automaticBusy, setAutomaticBusy] = useState(false);
  const [recentExam, setRecentExam] = useState<Exam | null>(null);
  const [providerReady, setProviderReady] = useState<boolean | null>(null);
  const [reload, setReload] = useState(0);
  const [creationMode, setCreationMode] = useState<"manual" | "automatic" | null>(null);

  useEffect(() => {
    if (!showCreate) return;
    const form = document.getElementById("exam-creation");
    form?.scrollIntoView({ block: "start" });
    form?.querySelector<HTMLSelectElement>("select")?.focus({ preventScroll: true });
  }, [showCreate]);

  useEffect(() => {
    let live = true;
    setLoading(true); setStudentsLoading(true); setError(""); setGradeError(""); setStudentError("");
    allPages<Exam>("/exams/", token).then(rows => { if (live) setExams(rows); })
      .catch(reason => { if (live) setError(errorMessage(reason)); })
      .finally(() => { if (live) setLoading(false); });
    allPages<Student>("/students/", token).then(rows => { if (live) setStudents(rows); })
      .catch(reason => { if (live) setStudentError(errorMessage(reason)); })
      .finally(() => { if (live) setStudentsLoading(false); });
    api<unknown>("/exams/provider/grades/", token).then(providerGrades)
      .then(rows => { if (live) setGrades(rows); })
      .catch(reason => { if (live) setGradeError(errorMessage(reason)); });
    api<{configured: boolean}>("/exams/provider/status/", token)
      .then(value => { if (live) setProviderReady(value.configured); })
      .catch(() => { if (live) setProviderReady(null); });
    return () => { live = false; };
  }, [token, reload]);

  async function createExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createLock.current) return;
    createLock.current = true; setCreating(true); setError(""); setNotice("");
    try {
      const exam = await api<Exam>("/exams/", token, "POST", {
        student: student ? Number(student) : null,
        title: title.trim(), grade_external_id: Number(grade), question_type: Number(questionType),
        duration_minutes: Number(duration), has_negative_score: negativeScore,
      });
      setExams(current => [exam, ...current]);
      setTitle(""); setRecentExam(exam); setShowCreate(false);
      setNotice("آزمون ساخته شد");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { createLock.current = false; setCreating(false); }
  }

  async function syncExam(id: number) {
    if (syncLocks.current.has(id) || publishLocks.current.has(id)) return;
    syncLocks.current.add(id); setSyncing(new Set(syncLocks.current)); setError(""); setNotice("");
    try {
      const updated = await api<Exam>(`/exams/${id}/sync/`, token, "POST", {});
      setExams(current => current.map(exam => exam.id === id ? updated : exam));
      setNotice("آزمون همگام‌سازی شد");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { syncLocks.current.delete(id); setSyncing(new Set(syncLocks.current)); }
  }

  async function publishExam(id: number) {
    if (publishLocks.current.has(id) || syncLocks.current.has(id)) return;
    publishLocks.current.add(id); setPublishing(new Set(publishLocks.current)); setError(""); setNotice("");
    try {
      const updated = await api<Exam>(`/exams/${id}/publish/`, token, "POST", {});
      setExams(current => current.map(exam => exam.id === id ? updated : exam));
      setNotice("آزمون برای دانش‌آموز منتشر شد");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { publishLocks.current.delete(id); setPublishing(new Set(publishLocks.current)); }
  }

  async function fetchResult(id: number, sync = false) {
    if (resultLocks.current.has(id)) return;
    setSelectedExamId(id); setResultErrors(current => ({ ...current, [id]: "" }));
    resultLocks.current.add(id); setResultBusy(new Set(resultLocks.current)); setError(""); setNotice("");
    try {
      const result = !sync && exams.find(exam => exam.id === id)?.result_available
        ? await api<ExamResult>(`/exams/${id}/result/`, token)
        : await api<ExamResult>(`/exams/${id}/result/`, token, "POST", {});
      setResults(current => ({ ...current, [id]: result }));
      setNotice("نتیجه دریافت شد");
    } catch (reason) { setResultErrors(current => ({ ...current, [id]: errorMessage(reason) })); }
    finally { resultLocks.current.delete(id); setResultBusy(new Set(resultLocks.current)); }
  }

  const filteredExams = exams.filter(exam => matchesExamFilters(exam, filters));
  const visibleExams = filteredExams.filter(exam => inExamSection(exam, section, !!results[exam.id]));
  const actionExams = filteredExams.filter(exam => needsExamAction(exam, !!results[exam.id]));
  const selectedExam = exams.find(exam => exam.id === selectedExamId);
  const hasFilters = Object.values(filters).some(Boolean);

  function openCreate() {
    setStudent(filters.student); setStudentStepComplete(false); setCreationMode(null); setShowCreate(true);
  }

  function primaryAction(exam: Exam) {
    const action = primaryExamAction(exam);
    if (action === "manage") return <a className="exam-primary" href={exam.manage_url!} target="_blank" rel="noopener noreferrer">ادامه ساخت آزمون ↗</a>;
    if (action === "publish") return <button className="exam-primary" type="button" disabled={publishing.has(exam.id) || syncing.has(exam.id)} onClick={() => void publishExam(exam.id)}>{publishing.has(exam.id) ? "در حال انتشار…" : "انتشار برای دانش‌آموز"}</button>;
    if (action === "result") return <button className="exam-primary" type="button" disabled={resultBusy.has(exam.id)} onClick={() => { if (results[exam.id]) setSelectedExamId(exam.id); else void fetchResult(exam.id); }}>{resultBusy.has(exam.id) ? "در حال دریافت نتیجه…" : exam.status === "CLOSED" || results[exam.id] || exam.result_available ? "مشاهده نتیجه" : "مشاهده / دریافت نتیجه"}</button>;
    return null;
  }

  const stats = [["کل آزمون‌ها", exams.length], ["پیش‌نویس", exams.filter(exam => exam.status === "DRAFT").length], ["آماده انتشار", exams.filter(exam => exam.status === "READY").length], ["منتشرشده", exams.filter(exam => exam.status === "PUBLISHED").length], ["دارای نتیجه", exams.filter(exam => exam.result_available || results[exam.id]).length]] as const;
  return <main className="planning-content exam-page counselor-exam-workspace" dir="rtl">
    <ExamPageHeader title="آزمون‌ها" subtitle="ساخت، مدیریت و بررسی آزمون‌های دانش‌آموزان"><button className="exam-primary" type="button" aria-expanded={showCreate} aria-controls="exam-creation" disabled={creating || automaticBusy} onClick={openCreate}>ساخت آزمون</button></ExamPageHeader>
    <section className="exam-stats" aria-label="خلاصه آزمون‌ها">{stats.map(([label, value]) => <div className="exam-stat" key={label}><span>{label}</span><strong>{loading ? "—" : value.toLocaleString("fa-IR")}</strong></div>)}</section>
    {error && <ExamErrorState message={error} onRetry={() => setReload(value => value + 1)}/>}
    {notice && <div className="exam-feedback success" role="status">{notice}{recentExam?.manage_url && <a className="exam-secondary" href={recentExam.manage_url} target="_blank" rel="noopener noreferrer">انتخاب سوال‌ها در آزمون‌ساز ↗</a>}</div>}
    <section className="exam-create" id="exam-creation" hidden={!showCreate} aria-label="ساخت آزمون">
      <div className="exam-section-heading"><h2>آزمون جدید</h2><button className="exam-secondary" type="button" disabled={creating || automaticBusy} onClick={() => setShowCreate(false)}>بستن</button></div>
      <div className="exam-form exam-creation-student">
        <label>۱. برای چه دانش‌آموزی؟<select value={student} disabled={creating || automaticBusy || studentsLoading || !!studentError} onChange={event => { setStudent(event.target.value); setStudentStepComplete(false); setCreationMode(null); }}><option value="">بدون تخصیص به دانش‌آموز</option>{students.map(row => <option key={row.id} value={row.id}>{studentName(row)}</option>)}</select></label>
        {!studentStepComplete && <button className="exam-secondary" type="button" disabled={studentsLoading || !!studentError} onClick={() => setStudentStepComplete(true)}>{studentsLoading ? "در حال دریافت دانش‌آموزان…" : "ادامه و انتخاب روش ساخت"}</button>}
      </div>
      {studentError && <ExamErrorState message={studentError} onRetry={() => setReload(value => value + 1)}/>}
      {studentStepComplete && <><h3 className="exam-creation-step-title">۲. روش ساخت آزمون</h3><div className="exam-mode"><button type="button" aria-pressed={creationMode === "manual"} disabled={creating || automaticBusy} onClick={() => setCreationMode("manual")}>انتخاب دستی سوال<small>سوال‌های آزمون را در آزمون‌ساز انتخاب کنید.</small></button><button type="button" aria-pressed={creationMode === "automatic"} disabled={creating || automaticBusy} onClick={() => setCreationMode("automatic")}>ساخت خودکار<small>آزمون را بر اساس درس، مبحث و سطح دشواری بسازید.</small></button></div></>}

      {providerReady === false && <p className="exam-feedback" role="alert">سرویس آزمون در حال حاضر آماده نیست. لطفاً با پشتیبانی تماس بگیرید.</p>}
      {gradeError && <div className="exam-feedback" role="alert">{gradeError}<button type="button" className="exam-secondary" onClick={() => setReload(value => value + 1)}>دریافت دوباره اطلاعات</button></div>}
        {!studentStepComplete || creationMode === null ? null : creationMode === "manual" ? <form onSubmit={createExam} className="exam-form">
          <label>عنوان آزمون<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} disabled={creating}/></label>
          <label>پایه<select required value={grade} onChange={event => setGrade(event.target.value)} disabled={creating || !grades.length}><option value="">انتخاب پایه</option>{grades.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label>نوع سوال<select value={questionType} onChange={event => setQuestionType(event.target.value)} disabled={creating}><option value="1">تستی</option><option value="2">تشریحی</option></select></label>
          <label>زمان آزمون (دقیقه)<input required type="number" min={1} step={1} value={duration} onChange={event => setDuration(event.target.value)} disabled={creating}/></label>
          <label><input type="checkbox" checked={negativeScore} onChange={event => setNegativeScore(event.target.checked)} disabled={creating}/> نمره منفی</label>
          <div className="exam-wide"><button className="exam-primary" type="submit" disabled={creating || !grades.length || !title.trim()}>{creating ? "در حال ساخت…" : "ساخت آزمون"}</button></div>
        </form> : <AutomaticExamForm onBusyChange={setAutomaticBusy} token={token} student={student} grades={grades} onCreated={exam => { setExams(current => [exam, ...current]); setNotice("آزمون ساخته شد"); setShowCreate(false); setRecentExam(null); }}/>}
    </section>
    <ExamSectionNav sections={[{ value: "all", label: "نمای کلی" }, { value: "active", label: "آزمون‌های فعال" }, { value: "results", label: "نتایج" }, { value: "archive", label: "آرشیو" }]} value={section} onChange={setSection}/>
    <details className="exam-workspace-filters" open={filtersOpen} onToggle={event => setFiltersOpen(event.currentTarget.open)}>
      <summary>فیلتر آزمون‌ها{hasFilters ? " · فیلتر فعال" : ""}</summary>
      <div className="exam-filter-controls">
        <label>دانش‌آموز<select value={filters.student} disabled={studentsLoading || !!studentError} onChange={event => setFilters(current => ({ ...current, student: event.target.value }))}><option value="">همه دانش‌آموزان</option>{students.map(row => <option key={row.id} value={row.id}>{studentName(row)}</option>)}</select></label>
        <label>عنوان آزمون<input type="search" value={filters.title} placeholder="جستجو در عنوان آزمون" onChange={event => setFilters(current => ({ ...current, title: event.target.value }))}/></label>
        <label>وضعیت<select value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}><option value="">همه وضعیت‌ها</option><option value="DRAFT">پیش‌نویس</option><option value="READY">آماده انتشار</option><option value="PUBLISHED">منتشرشده</option><option value="CLOSED">پایان‌یافته</option></select></label>
        <label>نوع سوال<select value={filters.questionType} onChange={event => setFilters(current => ({ ...current, questionType: event.target.value }))}><option value="">همه انواع</option><option value="1">تستی</option><option value="2">تشریحی</option></select></label>
        {hasFilters && <button className="exam-secondary" type="button" onClick={() => setFilters(emptyFilters)}>پاک‌کردن فیلترها</button>}
      </div>
    </details>
    {studentError && !showCreate && <ExamErrorState message={studentError} onRetry={() => setReload(value => value + 1)}/>}
    {!loading && actionExams.length > 0 && <section className="exam-card exam-action-center" aria-labelledby="exam-action-title"><div className="exam-section-heading"><h2 id="exam-action-title">نیازمند اقدام</h2><span>{actionExams.length.toLocaleString("fa-IR")} آزمون</span></div><ul>{actionExams.map(exam => <li key={exam.id}><div><strong>{exam.title}</strong><p className="exam-card-person">{exam.student_name || "بدون تخصیص به دانش‌آموز"} · {exam.status === "DRAFT" ? "نیازمند انتخاب سوال" : exam.status === "READY" ? "در انتظار انتشار" : "نتیجه آماده مشاهده است"}</p></div><div className="exam-actions">{primaryAction(exam)}</div></li>)}</ul></section>}
    <div className="exam-section-heading"><h2>فهرست آزمون‌ها</h2><span>{visibleExams.length.toLocaleString("fa-IR")} آزمون</span></div>
    {loading ? <ExamSkeleton/> : !visibleExams.length && !error ? <ExamEmptyState title={exams.length ? hasFilters ? "آزمونی با این فیلترها پیدا نشد." : "آزمونی در این بخش وجود ندارد" : "هنوز آزمونی برای دانش‌آموزان ساخته نشده است."} description={exams.length ? "فیلترها یا بخش انتخاب‌شده را تغییر دهید." : undefined}>{!exams.length && <button className="exam-primary" type="button" onClick={openCreate}>ساخت اولین آزمون</button>}</ExamEmptyState> : <section className="exam-grid" aria-label="فهرست آزمون‌ها">
      {visibleExams.map(exam => <article className="exam-card" key={exam.id} aria-busy={syncing.has(exam.id) || publishing.has(exam.id) || resultBusy.has(exam.id)}>
        <div className="exam-card-head"><div><h2>{exam.title}</h2><p className="exam-card-person">{exam.student_name || "بدون تخصیص به دانش‌آموز"}</p></div><ExamStatusBadge status={exam.status}/></div>
        <div className="exam-card-meta"><span>{exam.question_type === "1" ? "تستی" : exam.question_type === "2" ? "تشریحی" : "نوع نامشخص"}</span><span>{exam.question_count == null ? "—" : exam.question_count.toLocaleString("fa-IR")} سوال</span><span>{exam.duration_minutes == null ? "—" : exam.duration_minutes.toLocaleString("fa-IR")} دقیقه</span></div>
        <div className="exam-actions">
          {primaryAction(exam)}
          <details className="exam-more"><summary>بیشتر</summary><div className="exam-actions">
            <button className="exam-secondary" type="button" onClick={() => setSelectedExamId(exam.id)}>جزئیات آزمون</button>
            {(exam.status === "DRAFT" || exam.status === "READY") && <button className="exam-secondary" type="button" disabled={syncing.has(exam.id) || publishing.has(exam.id)} onClick={() => void syncExam(exam.id)}>{syncing.has(exam.id) ? "در حال همگام‌سازی…" : "همگام‌سازی"}</button>}
            {exam.status === "READY" && exam.manage_url && <a className="exam-secondary" href={exam.manage_url} target="_blank" rel="noopener noreferrer">ویرایش سوال‌ها ↗</a>}
            {results[exam.id] && <button className="exam-secondary" type="button" disabled={resultBusy.has(exam.id)} onClick={() => void fetchResult(exam.id, true)}>به‌روزرسانی نتیجه</button>}
          </div></details>
        </div>
        {exam.created_at && <time className="exam-card-date" dateTime={exam.created_at}>ساخته‌شده در {examDate(exam.created_at)}</time>}

      </article>)}
    </section>}
    {selectedExam && <div className="exam-dialog-backdrop"><section className="exam-dialog exam-details-dialog" role="dialog" aria-modal="true" aria-labelledby="exam-details-title">
      <div className="exam-section-heading"><h2 id="exam-details-title">{selectedExam.title}</h2><button className="exam-secondary" type="button" onClick={() => setSelectedExamId(null)}>بستن</button></div>
      <ExamStatusBadge status={selectedExam.status}/>
      <dl className="exam-details-fields">{[
        ["دانش‌آموز", selectedExam.student_name || "بدون تخصیص به دانش‌آموز"],
        ["نوع سوال", selectedExam.question_type === "1" ? "تستی" : selectedExam.question_type === "2" ? "تشریحی" : "نامشخص"],
        ["تعداد سوال", selectedExam.question_count?.toLocaleString("fa-IR") ?? "—"],
        ["مدت آزمون", selectedExam.duration_minutes == null ? "—" : `${selectedExam.duration_minutes.toLocaleString("fa-IR")} دقیقه`],
        ["نمره منفی", selectedExam.has_negative_score == null ? "نامشخص" : selectedExam.has_negative_score ? "دارد" : "ندارد"],
        ["تاریخ ساخت", examDate(selectedExam.created_at) || "—"],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {resultErrors[selectedExam.id] && <ExamErrorState message={resultErrors[selectedExam.id]} onRetry={() => void fetchResult(selectedExam.id)}/>}

      {results[selectedExam.id] ? <><ResultDetails result={results[selectedExam.id]}/><div className="exam-actions"><button type="button" className="exam-secondary" disabled={resultBusy.has(selectedExam.id)} onClick={() => void fetchResult(selectedExam.id, true)}>{resultBusy.has(selectedExam.id) ? "در حال دریافت نتیجه…" : "به‌روزرسانی نتیجه"}</button></div></> : <div className="exam-actions">{primaryAction(selectedExam)}</div>}
    </section></div>}
  </main>;
}
