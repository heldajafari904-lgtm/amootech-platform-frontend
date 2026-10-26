"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ResultDetails, ExamSkeleton, ExamPageHeader, ExamSectionNav, ExamStatusBadge, ExamEmptyState, ExamErrorState, examDate, type ExamResult } from "@/components/exams/ExamUI";
import { allPages, api, errorMessage, type User } from "@/lib/api";
import { useDialogFocus } from "@/components/counselor/PanelUI";
import { emptyFilters, matchesExamFilters, inExamSection, primaryExamAction, needsExamAction, type CounselorExam as Exam } from "./workspace";
import "./workspace.css";
import ParticipantPanel from "./ParticipantPanel";
import SchedulePanel from "./SchedulePanel";
import MonitoringPanel from "./MonitoringPanel";
import AnalyticsPanel from "./AnalyticsPanel";
import ManagementPanel from "./ManagementPanel";
import { useCounselor } from "@/lib/counselorContext";

import { field as taxonomyField } from "@/components/exams/taxonomy";
import { returnedManualExam, clearManualExam, safePDFUrl } from "@/components/exams/manualFlow";
import { creationRequest, creationComplete } from "@/components/exams/creation";

import ExamBasketBuilder from "@/components/exams/ExamBasketBuilder";

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

export default function CounselorExams() {
  const { token, user } = useCounselor();
  const returnAttempts = useRef(new Set<number>());
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [callbackWarning, setCallbackWarning] = useState("");
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
  const [studentIds, setStudentIds] = useState<number[]>([]);
  useEffect(()=>{
    let live=true;
    queueMicrotask(()=>{try{const ids=JSON.parse(sessionStorage.getItem(`counselor-exam-recipients:${user.id}`)||'[]');if(live&&Array.isArray(ids)&&ids.every(id=>Number.isSafeInteger(id)&&id>0)){setStudentIds(ids);setStudent(ids.length===1?String(ids[0]):'')}}catch{/* Ignore malformed recipient drafts. */}});
    return()=>{live=false};
  },[user.id]);
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [questionType, setQuestionType] = useState("1");
  const [duration, setDuration] = useState("60");
  const [negativeScore, setNegativeScore] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [resultErrors, setResultErrors] = useState<Record<number, string>>({});
  const [filters, setFilters] = useState(emptyFilters);
  const [studentStepComplete, setStudentStepComplete] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentError, setStudentError] = useState("");
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsBusy, setParticipantsBusy] = useState(false);
  const participantsBusyRef = useRef(false);
  const participantBusyChange = useCallback((busy: boolean) => { participantsBusyRef.current = busy; setParticipantsBusy(busy); }, []);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  useDialogFocus(selectedExamId !== null, () => { if (!participantsBusyRef.current) setSelectedExamId(null); });
  const [managementId, setManagementId] = useState<number | null>(null);
  const [selection, setSelection] = useState<Record<number, Exam>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulkLock = useRef(false);
  const [section, setSection] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [automaticBusy, setAutomaticBusy] = useState(false);
  const [recentExam, setRecentExam] = useState<Exam | null>(null);
  const [providerReady, setProviderReady] = useState<boolean | null>(null);
  const [reload, setReload] = useState(0);
  const [creationMode, setCreationMode] = useState<"manual" | "automatic" | null>("automatic");

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
    api<{configured: boolean; counselor_callback_origin?: string; counselor_callback_path?: string}>("/exams/provider/status/", token)
      .then(value => { if (live) {
        setProviderReady(value.configured);
        setCallbackWarning(value.counselor_callback_origin && (value.counselor_callback_origin !== window.location.origin || value.counselor_callback_path !== "/counselor/exams")
          ? "آدرس بازگشت Quiz24 با نشانی فعلی پنل متفاوت است؛ برای ادامه پس از ویرایش، به همین صفحه برگردید و «بررسی و تکمیل آزمون» را بزنید. تنظیم آدرس باید توسط مدیر بررسی شود." : "");
      } })
      .catch(() => { if (live) setProviderReady(null); });
    return () => { live = false; };
  }, [token, reload]);

  async function createExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createLock.current) return;
    createLock.current = true; setCreating(true); setError(""); setNotice("");
    try {
      const exam = await api<Exam>("/exams/", token, "POST", creationRequest({
        student: student ? Number(student) : null,
        title: title.trim(), grade_external_id: Number(grade), question_type: Number(questionType),
        duration_minutes: Number(duration), has_negative_score: negativeScore,
      }, sessionStorage, "manual"));
      creationComplete(sessionStorage, "manual");
      setExams(current => [exam, ...current.filter(row => row.id !== exam.id)]);
      setTitle(""); setRecentExam(exam); setShowCreate(false);
      setNotice("آزمون ساخته شد");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { createLock.current = false; setCreating(false); }
  }

  async function syncExam(id: number) {
    if (syncLocks.current.has(id) || publishLocks.current.has(id)) return;
    syncLocks.current.add(id); setSyncing(new Set(syncLocks.current)); setError(""); setNotice("");
    try {
      const updated = await api<Exam>(`/exams/${id}/sync/`, token, "POST", { edit_session: new URLSearchParams(window.location.search).get("edit_session") || sessionStorage.getItem(`amootech-edit-${user.id}-${id}`) });
      sessionStorage.removeItem(`amootech-edit-${user.id}-${id}`);
      setExams(current => current.map(exam => exam.id === id ? updated : exam));
      setRecentExam(current => current?.id === id ? updated : current);
      if (updated.status === "READY") clearManualExam(sessionStorage, user.id, id);
      setNotice(updated.status === "DRAFT" ? "هنوز سؤالی در Quiz24 ثبت نشده است؛ انتخاب سؤال‌ها را ذخیره و دوباره بررسی کنید." : "آزمون بررسی شد و آماده انتشار است.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { syncLocks.current.delete(id); setSyncing(new Set(syncLocks.current)); }
  }

  useEffect(() => {
    if (loading) return;
    const id = returnedManualExam(window.location.search, sessionStorage, user.id);
    if (!id || returnAttempts.current.has(id)) return;
    returnAttempts.current.add(id);
    setResumeId(id);
    // Fetch ownership-scoped local data first. A callback alone never makes READY.
    void api<Exam>(`/exams/${id}/`, token).then(exam => {
      setExams(current => [exam, ...current.filter(row => row.id !== id)]);
      setFilters(emptyFilters); setSection("all");
      if (exam.status === "DRAFT" || exam.status === "READY") void syncExam(id);
      else clearManualExam(sessionStorage, user.id, id);
    }).catch(reason => setError(errorMessage(reason)));
    // Token refresh must not trigger another automatic synchronization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user.id, loading]);

  async function publishExam(id: number) {
    if (publishLocks.current.has(id) || syncLocks.current.has(id)) return;
    publishLocks.current.add(id); setPublishing(new Set(publishLocks.current)); setError(""); setNotice("");
    try {
      const updated = await api<Exam>(`/exams/${id}/publish/`, token, "POST", { expected_updated_at: exams.find(exam => exam.id === id)?.updated_at });
      setExams(current => current.map(exam => exam.id === id ? updated : exam));
      setNotice("آزمون برای دانش‌آموز منتشر شد");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { publishLocks.current.delete(id); setPublishing(new Set(publishLocks.current)); }
  }

  async function fetchResult(id: number, sync = false) {
    if (resultLocks.current.has(id)) return;
    setParticipantsOpen(false); setSelectedExamId(id); setResultErrors(current => ({ ...current, [id]: "" }));
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

  async function bulkManage(action: string) {
    if (bulkLock.current || !Object.keys(selection).length) return;
    if (!window.confirm(`${action === "trash" ? "انتقال به سطل زباله" : action === "archive" ? "بایگانی" : "خروج از بایگانی"} برای ${Object.keys(selection).length} آزمون انجام شود؟`)) return;
    bulkLock.current = true; setBulkBusy(true); setError("");
    try {
      const response = await api<{ results: Exam[] }>("/exams/management/bulk/", token, "POST", { action, exams: Object.values(selection).map(exam => ({ id: exam.id, expected_updated_at: exam.updated_at })) });
      setExams(current => current.map(exam => response.results.find(updated => updated.id === exam.id) || exam));
      setSelection({}); setNotice("عملیات گروهی ثبت شد؛ سوابق حفظ شدند.");
    } catch (reason) { setError(errorMessage(reason)); setSelection({}); setReload(value => value + 1); }
    finally { bulkLock.current = false; setBulkBusy(false); }
  }

  const filteredExams = exams.filter(exam => matchesExamFilters(exam, filters));
  const visibleExams = filteredExams.filter(exam => inExamSection(exam, section, !!results[exam.id]));
  const actionExams = filteredExams.filter(exam => needsExamAction(exam, !!results[exam.id]));
  const selectedExam = exams.find(exam => exam.id === selectedExamId);
  const hasFilters = Object.values(filters).some(Boolean);

  function openCreate() {
    if(filters.student){setStudent(filters.student);setStudentIds([Number(filters.student)])} setStudentStepComplete(true); setCreationMode("automatic"); setShowCreate(true);
  }

  function primaryAction(exam: Exam) {
    const action = primaryExamAction(exam);
    if (action === "manage") return <button className="exam-primary" type="button" onClick={() => { setSelectedExamId(null); setManagementId(exam.id); }}>ادامه ساخت آزمون ↗</button>;
    if (action === "publish") return <button className="exam-primary" type="button" disabled={publishing.has(exam.id) || syncing.has(exam.id)} onClick={() => void publishExam(exam.id)}>{publishing.has(exam.id) ? "در حال انتشار…" : "انتشار برای دانش‌آموز"}</button>;
    if (action === "result") return <button className="exam-primary" type="button" disabled={resultBusy.has(exam.id)} onClick={() => { if (results[exam.id]) { setParticipantsOpen(false); setSelectedExamId(exam.id); } else void fetchResult(exam.id); }}>{resultBusy.has(exam.id) ? "در حال دریافت نتیجه…" : exam.status === "CLOSED" || results[exam.id] || exam.result_available ? "مشاهده نتیجه" : "مشاهده / دریافت نتیجه"}</button>;
    return null;
  }

  const stats = [["کل آزمون‌ها", exams.length], ["پیش‌نویس", exams.filter(exam => exam.status === "DRAFT").length], ["آماده انتشار", exams.filter(exam => exam.status === "READY").length], ["منتشرشده", exams.filter(exam => exam.status === "PUBLISHED").length], ["دارای نتیجه", exams.filter(exam => exam.result_available || results[exam.id]).length]] as const;
  return <main className="planning-content exam-page counselor-exam-workspace" dir="rtl">
    <ExamPageHeader title="آزمون‌ها" subtitle="ساخت، مدیریت و بررسی آزمون‌های دانش‌آموزان"><button className="exam-primary" type="button" aria-expanded={showCreate} aria-controls="exam-creation" disabled={creating || automaticBusy} onClick={openCreate}>ساخت آزمون</button></ExamPageHeader>
    {callbackWarning && <p className="exam-feedback" role="status">{callbackWarning}</p>}
    {resumeId && <div className="exam-feedback" role="status">ادامه آزمون شماره {resumeId.toLocaleString("fa-IR")} · {syncing.has(resumeId) ? "در حال بررسی اطلاعات Quiz24…" : "اطلاعات واقعی آزمون را بررسی کنید؛ بازگشت به‌تنهایی به‌معنای تکمیل نیست."}<button type="button" className="exam-secondary" disabled={syncing.has(resumeId)} onClick={() => void syncExam(resumeId)}>بررسی و تکمیل آزمون</button></div>}
    <section className="exam-stats" aria-label="خلاصه آزمون‌ها">{stats.map(([label, value]) => <div className="exam-stat" key={label}><span>{label}</span><strong>{loading ? "—" : value.toLocaleString("fa-IR")}</strong></div>)}</section>
    {error && <ExamErrorState message={error} onRetry={() => setReload(value => value + 1)}/>}
    {notice && <div className="exam-feedback success" role="status">{notice}{recentExam?.manage_url && <button className="exam-secondary" type="button" onClick={() => setManagementId(recentExam.id)}>انتخاب سوال‌ها در آزمون‌ساز ↗</button>}</div>}
    <section className="exam-create" id="exam-creation" hidden={!showCreate} aria-label="ساخت آزمون">
      <div className="exam-section-heading"><h2>آزمون جدید</h2><button className="exam-secondary" type="button" disabled={creating || automaticBusy} onClick={() => setShowCreate(false)}>بستن</button></div>
      <div className="exam-form exam-creation-student">
        <strong>دانش‌آموزان آزمون</strong><div className="basket-tiles" role="group" aria-label="دانش‌آموزان آزمون">{students.map(row=><button type="button" key={row.id} disabled={creating||automaticBusy} aria-pressed={studentIds.includes(row.id)} onClick={()=>{const ids=studentIds.includes(row.id)?studentIds.filter(id=>id!==row.id):[...studentIds,row.id];setStudentIds(ids);sessionStorage.setItem(`counselor-exam-recipients:${user.id}`,JSON.stringify(ids));setStudent(ids.length===1?String(ids[0]):'');setStudentStepComplete(true)}}>{studentName(row)}</button>)}</div>
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
        </form> : <ExamBasketBuilder<Exam> mode="counselor" onBusyChange={setAutomaticBusy} token={token} studentIds={studentIds} onCreated={exam => { setExams(current => [exam, ...current]); setNotice("آزمون ساخته شد"); setShowCreate(false); setRecentExam(null); }}/>}
    </section>
    <ExamSectionNav sections={[{ value: "all", label: "نمای کلی" }, { value: "active", label: "آزمون‌های فعال" }, { value: "results", label: "نتایج" }, { value: "archive", label: "آرشیو" }, { value: "trash", label: "سطل زباله" }]} value={section} onChange={setSection}/>
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
    {!loading && actionExams.length > 0 && <section className="exam-card exam-action-center" aria-labelledby="exam-action-title"><div className="exam-section-heading"><h2 id="exam-action-title">نیازمند اقدام</h2><span>{actionExams.length.toLocaleString("fa-IR")} آزمون</span></div><ul>{actionExams.map(exam => <li key={exam.id}><div><strong>{exam.title}</strong><p className="exam-card-person">{(exam.assignment_count ?? 0) > 1 ? `${exam.assignment_count?.toLocaleString("fa-IR")} دانش‌آموز` : exam.student_name || ((exam.assignment_count ?? 0) > 0 ? "۱ دانش‌آموز" : "بدون تخصیص به دانش‌آموز")} · {exam.status === "DRAFT" ? "نیازمند انتخاب سوال" : exam.status === "READY" ? "در انتظار انتشار" : "نتیجه آماده مشاهده است"}</p></div><div className="exam-actions">{primaryAction(exam)}</div></li>)}</ul></section>}
    {!!Object.keys(selection).length && <div className="exam-actions exam-bulk-toolbar" role="group" aria-label="مدیریت گروهی" aria-busy={bulkBusy}><strong>{Object.keys(selection).length.toLocaleString("fa-IR")} انتخاب</strong>{([["archive", "بایگانی"], ["unarchive", "خروج از بایگانی"], ["trash", "انتقال به سطل زباله"]] as const).map(([action, label]) => <button key={action} className="exam-secondary" disabled={bulkBusy} onClick={() => void bulkManage(action)}>{label}</button>)}<button className="exam-secondary" disabled={bulkBusy} onClick={() => setSelection({})}>لغو انتخاب</button></div>}
    <div className="exam-section-heading"><h2>فهرست آزمون‌ها</h2><span>{visibleExams.length.toLocaleString("fa-IR")} آزمون</span></div>
    {loading ? <ExamSkeleton/> : !visibleExams.length && !error ? <ExamEmptyState title={exams.length ? hasFilters ? "آزمونی با این فیلترها پیدا نشد." : "آزمونی در این بخش وجود ندارد" : "هنوز آزمونی برای دانش‌آموزان ساخته نشده است."} description={exams.length ? "فیلترها یا بخش انتخاب‌شده را تغییر دهید." : undefined}>{!exams.length && <button className="exam-primary" type="button" onClick={openCreate}>ساخت اولین آزمون</button>}</ExamEmptyState> : <section className="exam-grid" aria-label="فهرست آزمون‌ها">
      {visibleExams.map(exam => <article className="exam-card" key={exam.id} aria-busy={syncing.has(exam.id) || publishing.has(exam.id) || resultBusy.has(exam.id)}>
        <label className="exam-management-select"><input type="checkbox" checked={!!selection[exam.id]} disabled={bulkBusy} onChange={event => setSelection(current => { const next = { ...current }; if (event.target.checked) next[exam.id] = exam; else delete next[exam.id]; return next; })}/>انتخاب {exam.title}</label>
        <div className="exam-card-head"><div><h2>{exam.title}</h2><p className="exam-card-person">{(exam.assignment_count ?? 0) > 1 ? `${exam.assignment_count?.toLocaleString("fa-IR")} دانش‌آموز` : exam.student_name || ((exam.assignment_count ?? 0) > 0 ? "۱ دانش‌آموز" : "بدون تخصیص به دانش‌آموز")}</p></div><ExamStatusBadge status={exam.status}/></div>
        <div className="exam-card-meta"><span>{exam.question_type === "1" ? "تستی" : exam.question_type === "2" ? "تشریحی" : "نوع نامشخص"}</span><span>{exam.question_count == null ? "—" : exam.question_count.toLocaleString("fa-IR")} سوال</span><span>{exam.duration_minutes == null ? "—" : exam.duration_minutes.toLocaleString("fa-IR")} دقیقه</span></div>
        <div className="exam-actions">
          {primaryAction(exam)}
          <button className="exam-secondary" type="button" disabled={syncing.has(exam.id) || publishing.has(exam.id) || resultBusy.has(exam.id)} onClick={() => { setParticipantsOpen(true); setSelectedExamId(exam.id); }}>مدیریت شرکت‌کنندگان</button>
            {(exam.status === "DRAFT" || exam.status === "READY") && <button className="exam-secondary" type="button" disabled={syncing.has(exam.id) || publishing.has(exam.id)} onClick={() => void syncExam(exam.id)}>{syncing.has(exam.id) ? "در حال همگام‌سازی…" : "بررسی و تکمیل آزمون"}</button>}
          <details className="exam-more"><summary>بیشتر</summary><div className="exam-actions">
            <button className="exam-secondary" type="button" onClick={() => { setParticipantsOpen(false); setSelectedExamId(exam.id); }}>جزئیات آزمون</button>

            <button className="exam-secondary" type="button" onClick={() => { setSelectedExamId(null); setManagementId(exam.id); }}>مدیریت، ویرایش و تاریخچه</button>
            {results[exam.id] && <button className="exam-secondary" type="button" disabled={resultBusy.has(exam.id)} onClick={() => void fetchResult(exam.id, true)}>به‌روزرسانی نتیجه</button>}
          </div></details>
        </div>
        <div className="exam-actions">{([["سؤال‌ها", exam.question_file_url], ["پاسخ تشریحی", exam.answer_file_url], ["کلید پاسخ", exam.key_file_url]] as const).map(([label, file]) => safePDFUrl(file) ? <a key={label} className="exam-secondary" href={safePDFUrl(file)!} target="_blank" rel="noopener noreferrer">{label} PDF</a> : file ? <span key={label}>{label}: {file}</span> : null)}</div>
        {exam.created_at && <time className="exam-card-date" dateTime={exam.created_at}>ساخته‌شده در {examDate(exam.created_at)}</time>}

      </article>)}
    </section>}
    {managementId !== null && <ManagementPanel key={managementId} examId={managementId} token={token} userId={user.id} onClose={() => setManagementId(null)} onChanged={updated => { setExams(current => current.map(exam => exam.id === updated.id ? updated : exam)); setSelection({}); }}/>}
    {selectedExam && <div className="exam-dialog-backdrop"><section className="exam-dialog exam-details-dialog" role="dialog" aria-modal="true" aria-labelledby="exam-details-title">
      <div className="exam-section-heading"><h2 id="exam-details-title">{selectedExam.title}</h2><button className="exam-secondary" type="button" disabled={participantsBusy} onClick={() => setSelectedExamId(null)}>بستن</button></div>
      <div className="exam-actions"><button type="button" className="exam-secondary" aria-pressed={!participantsOpen} disabled={participantsBusy} onClick={() => setParticipantsOpen(false)}>جزئیات آزمون</button><button type="button" className="exam-secondary" aria-pressed={participantsOpen} disabled={participantsBusy || syncing.has(selectedExam.id) || publishing.has(selectedExam.id) || resultBusy.has(selectedExam.id)} onClick={() => setParticipantsOpen(true)}>مدیریت شرکت‌کنندگان</button></div>
      {participantsOpen ? <ParticipantPanel key={`${selectedExam.id}:${token}`} exam={selectedExam} token={token} students={students} studentsLoading={studentsLoading} studentError={studentError}
        onBusyChange={participantBusyChange}
        onCount={count => {
          setExams(current => current.map(exam => exam.id === selectedExam.id ? { ...exam, assignment_count: count } : exam));
          setResults(current => { const next = { ...current }; delete next[selectedExam.id]; return next; });
          setResultErrors(current => ({ ...current, [selectedExam.id]: "" }));
        }}
        onExam={updated => {
          setExams(current => current.map(exam => exam.id === updated.id ? updated : exam));
          setRecentExam(current => current?.id === updated.id ? updated : current);
        }}/>: <>
      <ExamStatusBadge status={selectedExam.status}/>

      <dl className="exam-details-fields">{[
        ["دانش‌آموز اصلی", selectedExam.student_name || "تعیین نشده"],
        ["تعداد شرکت‌کنندگان", (selectedExam.assignment_count ?? 0).toLocaleString("fa-IR")],
        ["نوع سوال", selectedExam.question_type === "1" ? "تستی" : selectedExam.question_type === "2" ? "تشریحی" : "نامشخص"],
        ["تعداد سوال", selectedExam.question_count?.toLocaleString("fa-IR") ?? "—"],
        ["مدت آزمون", selectedExam.duration_minutes == null ? "—" : `${selectedExam.duration_minutes.toLocaleString("fa-IR")} دقیقه`],
        ["نمره منفی", selectedExam.has_negative_score == null ? "نامشخص" : selectedExam.has_negative_score ? "دارد" : "ندارد"],
        ["تاریخ ساخت", examDate(selectedExam.created_at) || "—"],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <SchedulePanel key={`${selectedExam.id}:${token}`} exam={selectedExam} token={token} onBusyChange={participantBusyChange} onExam={updated => {
        setExams(current => current.map(exam => exam.id === updated.id ? updated : exam));
        setRecentExam(current => current?.id === updated.id ? updated : current);
      }}/>
      <MonitoringPanel key={`monitoring:${selectedExam.id}:${token}`} examId={selectedExam.id} token={token}/>
      <AnalyticsPanel key={`analytics:${selectedExam.id}:${token}`} examId={selectedExam.id} token={token}/>
      {resultErrors[selectedExam.id] && <ExamErrorState message={resultErrors[selectedExam.id]} onRetry={() => void fetchResult(selectedExam.id)}/>}

      {results[selectedExam.id] ? <><ResultDetails result={results[selectedExam.id]}/><div className="exam-actions"><button type="button" className="exam-secondary" disabled={resultBusy.has(selectedExam.id)} onClick={() => void fetchResult(selectedExam.id, true)}>{resultBusy.has(selectedExam.id) ? "در حال دریافت نتیجه…" : "به‌روزرسانی نتیجه"}</button></div></> : <div className="exam-actions">{primaryAction(selectedExam)}</div>}
    </>}
    </section></div>}
  </main>;
}
