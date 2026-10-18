"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ResultDetails, ExamSkeleton, ExamPageHeader, ExamSectionNav, ExamStatusBadge, ExamEmptyState, ExamErrorState, type ExamResult } from "@/components/exams/ExamUI";
import { allPages, api, errorMessage } from "@/lib/api";
import { useDialogFocus } from "@/components/counselor/PanelUI";
import PracticeBuilder from "./PracticeBuilder";
import { canStartExam, studentEmptyStates, studentExamInSection, runExclusive, type StudentExam as Exam } from "./studentExam";
import "./student-exams.css";
import { useStudentPlanAuth } from "../plans/layout";

export default function StudentExams() {
  const { token } = useStudentPlanAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creationMode, setCreationMode] = useState<"free" | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [startError, setStartError] = useState("");
  const [section, setSection] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState<number | null>(null);
  const startLock = useRef(false);
  const [confirmExam, setConfirmExam] = useState<Exam | null>(null);
  const [reload, setReload] = useState(0);
  useDialogFocus(!!confirmExam, () => { if (!startLock.current) setConfirmExam(null); });
  const resultLocks = useRef(new Set<number>());
  const [resultBusy, setResultBusy] = useState(new Set<number>());
  const [results, setResults] = useState<Record<number, ExamResult>>({});

  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    allPages<Exam>("/exams/", token)
      .then(rows => { if (live) setExams(rows); })
      .catch(reason => { if (live) setError(errorMessage(reason)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token, reload]);

  async function startExam(id: number) {
    if (startLock.current || resultLocks.current.has(id)) return;
    try {
      await runExclusive(startLock, async () => {
        setStarting(id); setStartError("");
        const response = await api<{ participation_url: string }>(`/exams/${id}/start/`, token, "POST", {});
        const url = new URL(response.participation_url);
        if (!["https:", "http:"].includes(url.protocol)) throw new Error("لینک شرکت در آزمون معتبر نیست.");
        window.location.assign(url.href);
      }, true);
    } catch (reason) {
      setStartError(errorMessage(reason)); setStarting(null);
    }
  }

  async function fetchResult(id: number, sync = false) {
    if (resultLocks.current.has(id) || startLock.current) return;
    resultLocks.current.add(id); setResultBusy(new Set(resultLocks.current)); setError("");
    try {
      const result = !sync && exams.find(exam => exam.id === id)?.result_available
        ? await api<ExamResult>(`/exams/${id}/result/`, token)
        : await api<ExamResult>(`/exams/${id}/result/`, token, "POST", {});
      setResults(current => ({ ...current, [id]: result }));
      setSection("results");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { resultLocks.current.delete(id); setResultBusy(new Set(resultLocks.current)); }
  }

  const visibleExams = exams.filter(exam => studentExamInSection(exam, section, !!results[exam.id]));
  function openCreate() { setCreationMode(null); setShowCreate(true); setNotice(""); }
  useEffect(() => {
    if (showCreate) {
      const panel = document.getElementById("student-exam-create");
      panel?.scrollIntoView({ block: "start" }); panel?.querySelector<HTMLButtonElement>(".exam-mode button")?.focus({ preventScroll: true });
    }
  }, [showCreate]);

  return <main className="planning-content exam-page student-exam-center" dir="rtl">
    <ExamPageHeader title="آزمون‌های من" subtitle="آزمون‌های فعال، تمرین‌ها و نتایج شما"><button className="exam-primary" type="button" disabled={creating || starting !== null} aria-expanded={showCreate} aria-controls="student-exam-create" onClick={openCreate}>ساخت آزمون تمرینی</button></ExamPageHeader>
    {notice && <p className="exam-feedback success" role="status">{notice}</p>}
    {showCreate && <section className="exam-create" id="student-exam-create" aria-label="ساخت آزمون تمرینی">
      <div className="exam-section-heading"><h2>ساخت آزمون تمرینی</h2><button className="exam-secondary" type="button" disabled={creating} onClick={() => setShowCreate(false)}>بستن</button></div>
      <div className="exam-mode"><button type="button" disabled={creating} aria-pressed={creationMode === "free"} onClick={() => setCreationMode("free")}>انتخاب آزاد<small>درس و مبحث دلخواه را انتخاب کنید.</small></button><button type="button" disabled>از مطالب مطالعه‌شده<small>بر اساس گزارش‌های مطالعه خود آزمون بسازید.</small><span className="exam-badge">به‌زودی</span></button></div>
      {creationMode === "free" && <PracticeBuilder token={token} onBusyChange={setCreating} onCreated={exam => { setExams(current => [exam, ...current.filter(row => row.id !== exam.id)]); setShowCreate(false); setSection("practice"); setNotice("آزمون تمرینی ساخته شد. می‌توانید آزمون را شروع کنید."); }}/>}
    </section>}
    <ExamSectionNav sections={[{ value: "active", label: "فعال" }, { value: "practice", label: "تمرین‌های من" }, { value: "results", label: "نتایج" }, { value: "past", label: "گذشته" }]} value={section} onChange={setSection}/>
    {error && <ExamErrorState message={error} onRetry={() => setReload(value => value + 1)}/>}

    {loading ? <ExamSkeleton/> : !visibleExams.length && !error ? <ExamEmptyState title={studentEmptyStates[section]} description={section === "active" || section === "practice" ? "برای تمرین بیشتر، آزمون دلخواه خود را بسازید." : "آزمون‌ها و نتایج شما پس از ثبت در این بخش نمایش داده می‌شوند."}>{(section === "active" || section === "practice") && <button className="exam-primary" type="button" disabled={creating || starting !== null} onClick={openCreate}>ساخت آزمون تمرینی</button>}</ExamEmptyState> : <div className="exam-grid">
      {visibleExams.map(exam => <article className="exam-card" key={exam.id} aria-busy={starting === exam.id || resultBusy.has(exam.id)}>
        <div className="exam-card-head"><div><h2>{exam.title}</h2><p className="exam-card-person">{exam.is_personal_practice ? "تمرین شخصی" : exam.counselor_name ? `از طرف مشاور: ${exam.counselor_name}` : "از طرف مشاور"}</p></div><ExamStatusBadge status={exam.status}/></div>
        <div className="exam-card-meta"><span>{exam.question_type === "1" ? "تستی" : exam.question_type === "2" ? "تشریحی" : "نوع نامشخص"}</span><span>{exam.question_count === null ? "—" : exam.question_count.toLocaleString("fa-IR")} سوال</span><span>{exam.duration_minutes === null ? "—" : exam.duration_minutes.toLocaleString("fa-IR")} دقیقه</span></div>
        <div className="exam-actions">
          {canStartExam(exam, !!results[exam.id]) && <button className="exam-primary" type="button" disabled={starting !== null || resultBusy.has(exam.id)} onClick={() => { setStartError(""); setConfirmExam(exam); }}>شروع آزمون ↗</button>}
          {exam.result_available || results[exam.id] ? <button className="exam-primary" type="button" disabled={resultBusy.has(exam.id) || starting !== null} onClick={() => void fetchResult(exam.id)}>{resultBusy.has(exam.id) ? "در حال دریافت نتیجه…" : "مشاهده نتیجه"}</button> : null}
          <details className="exam-more"><summary>بیشتر</summary><div className="exam-actions"><button className="exam-secondary" type="button" disabled={resultBusy.has(exam.id) || starting !== null} onClick={() => void fetchResult(exam.id, !!results[exam.id])}>{resultBusy.has(exam.id) ? "در حال دریافت نتیجه…" : results[exam.id] ? "به‌روزرسانی نتیجه" : "دریافت نتیجه"}</button></div></details>
        </div>
        {results[exam.id] && <ResultDetails result={results[exam.id]} student collapseAnswers/>}
      </article>)}
    </div>}
    {confirmExam && <div className="exam-dialog-backdrop"><section className="exam-dialog" role="dialog" aria-modal="true" aria-labelledby="exam-start-title" aria-describedby="exam-start-description">
      <h2 id="exam-start-title">شروع آزمون</h2><p id="exam-start-description">با شروع آزمون وارد محیط آزمون می‌شوید.</p><strong>{confirmExam.title}</strong><p>{confirmExam.question_count?.toLocaleString("fa-IR") ?? "—"} سوال · {confirmExam.duration_minutes?.toLocaleString("fa-IR") ?? "—"} دقیقه</p>
      {startError && <p className="exam-feedback" role="alert">{startError} <Link href="/student/profile">بررسی موبایل و اتصال حساب در پروفایل</Link></p>}
      <div className="exam-actions"><button className="exam-primary" type="button" disabled={starting !== null} onClick={() => void startExam(confirmExam.id)}>{starting === confirmExam.id ? "در حال آماده‌سازی آزمون..." : "شروع آزمون"}</button><button className="exam-secondary" type="button" disabled={starting !== null} onClick={() => setConfirmExam(null)}>انصراف</button></div>
    </section></div>}
  </main>;
}
