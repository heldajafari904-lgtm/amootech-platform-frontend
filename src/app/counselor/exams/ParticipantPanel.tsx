"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { ExamStatusBadge } from "@/components/exams/ExamUI";
import { ParticipantSession, MAX_ASSIGNMENTS, ROWS_PER_PAGE, participantName, searchStudents, selectStudents, type ParticipantStudent } from "./participants";
import type { CounselorExam } from "./workspace";

export default function ParticipantPanel({ exam, token, students, studentsLoading, studentError, onExam, onCount, onBusyChange }: {
  exam: CounselorExam; token: string; students: ParticipantStudent[]; studentsLoading: boolean; studentError: string;
  onExam: (exam: CounselorExam) => void; onCount: (count: number) => void; onBusyChange: (busy: boolean) => void;
}) {
  // The parent keys this panel by exam and token; callbacks use functional state updates.
  const [session] = useState(() => new ParticipantSession(exam.id, <T,>(path: string, method?: string, body?: object) => api<T>(path, token, method, body), onExam, onCount));
  const [state, setState] = useState(session.state);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [assignedPage, setAssignedPage] = useState(0);
  useEffect(() => {
    session.connect(next => { setState(next); onBusyChange(next.busy); }); void session.load();
    return () => { session.dispose(); onBusyChange(false); };
  }, [session, onBusyChange]);
  const filtered = useMemo(() => searchStudents(students, query), [students, query]);
  const assigned = new Set(state.assignments.map(row => row.student));
  const disabled = state.busy || state.loading || !state.ready;
  const rosterDisabled = disabled || studentsLoading || !!studentError;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / ROWS_PER_PAGE) - 1));
  const currentAssignedPage = Math.min(assignedPage, Math.max(0, Math.ceil(state.assignments.length / ROWS_PER_PAGE) - 1));
  const selectable = filtered.filter(row => !assigned.has(row.id));
  const selectedNames = students.filter(row => state.selected.includes(row.id)).slice(0, 3).map(participantName);

  return <section className="exam-participants" aria-labelledby="exam-participants-heading" aria-busy={state.loading || state.busy}>
    <div className="exam-section-heading"><h3 id="exam-participants-heading">مدیریت شرکت‌کنندگان</h3><ExamStatusBadge status={exam.status}/></div>
    <p className="exam-muted">{exam.title} · <strong>{state.count.toLocaleString("fa-IR")} دانش‌آموز</strong></p>
    <p className="exam-muted">همه دانش‌آموزان به همین آزمون مشترک در آموزتک تخصیص داده می‌شوند.</p>
    {state.notice && <p className="participant-success" role="status">{state.notice}</p>}
    {state.error && <div className="exam-feedback" role="alert"><p>{state.error}</p><button type="button" className="exam-secondary" disabled={state.busy || state.loading} onClick={() => void session.load()}>بازخوانی فهرست</button></div>}
    {state.loading ? <div className="participant-loading" role="status"><span/>در حال دریافت شرکت‌کنندگان…</div> : <>
      <h4>دانش‌آموزان تخصیص‌یافته</h4>
      {!state.ready && <p className="exam-muted">برای ادامه، فهرست شرکت‌کنندگان را بازخوانی کنید.</p>}
      {state.ready && !state.assignments.length && <p className="participant-empty">هنوز دانش‌آموزی به این آزمون تخصیص داده نشده است.</p>}
      <ul className="participant-list" aria-label="دانش‌آموزان تخصیص‌یافته">{state.assignments.slice(currentAssignedPage * ROWS_PER_PAGE, (currentAssignedPage + 1) * ROWS_PER_PAGE).map(row => <li key={row.student}>
        <span>{row.student_name}</span><button type="button" className="exam-secondary" disabled={disabled} aria-label={`حذف تخصیص ${row.student_name}`} onClick={() => session.confirmRemoval(row)}>حذف تخصیص</button>
      </li>)}</ul>
      {state.assignments.length > ROWS_PER_PAGE && <div className="participant-pagination" aria-label="صفحه‌بندی تخصیص‌ها"><button type="button" disabled={!currentAssignedPage || disabled} onClick={() => setAssignedPage(currentAssignedPage - 1)}>قبلی</button><span>صفحه {(currentAssignedPage + 1).toLocaleString("fa-IR")}</span><button type="button" disabled={(currentAssignedPage + 1) * ROWS_PER_PAGE >= state.assignments.length || disabled} onClick={() => setAssignedPage(currentAssignedPage + 1)}>بعدی</button></div>}
    </>}
    {state.pendingRemoval && <div className="participant-confirm" role="group" aria-label="تأیید حذف تخصیص">
      <p>تخصیص «{state.pendingRemoval.student_name}» حذف شود؟ پس از شروع آزمون، حذف تخصیص مجاز نیست.</p>
      <div className="exam-actions"><button autoFocus className="exam-secondary" type="button" disabled={state.busy} onClick={() => session.confirmRemoval(null)}>انصراف</button><button className="exam-secondary participant-danger" type="button" disabled={disabled} onClick={() => void session.save("DELETE")}>تأیید حذف تخصیص</button></div>
    </div>}
    <div className="participant-add">
      <h4>افزودن دانش‌آموزان</h4>
      <label className="participant-search">جستجوی نام دانش‌آموز<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="نام یا نام خانوادگی"/></label>
      {studentsLoading ? <p role="status">در حال دریافت دانش‌آموزان…</p> : studentError ? <p className="exam-feedback" role="alert">{studentError}</p> : <>
        <div className="participant-selection"><button className="exam-secondary" type="button" disabled={rosterDisabled || !selectable.length || state.selected.length >= MAX_ASSIGNMENTS} onClick={() => session.select(selectStudents(state.selected, selectable.map(row => row.id), state.assignments))}>انتخاب همه نتایج جستجو</button><span>{filtered.length.toLocaleString("fa-IR")} نتیجه</span></div>
        <p className="exam-muted">در هر مرحله حداکثر ۲۰۰ دانش‌آموز انتخاب کنید.</p>
        {!filtered.length && <p className="participant-empty">{students.length ? "دانش‌آموزی با این نام پیدا نشد." : "دانش‌آموزی تحت مسئولیت شما ثبت نشده است."}</p>}
        <ul className="participant-list participant-options" aria-label="انتخاب دانش‌آموزان">{filtered.slice(currentPage * ROWS_PER_PAGE, (currentPage + 1) * ROWS_PER_PAGE).map(row => <li key={row.id}><label>
          <input type="checkbox" checked={assigned.has(row.id) || state.selected.includes(row.id)} disabled={rosterDisabled || assigned.has(row.id) || (!state.selected.includes(row.id) && state.selected.length >= MAX_ASSIGNMENTS)} onChange={event => session.select(event.target.checked ? [...state.selected, row.id] : state.selected.filter(id => id !== row.id))}/>
          <span>{participantName(row)}</span>{assigned.has(row.id) && <small>قبلاً تخصیص یافته</small>}
        </label></li>)}</ul>
        {filtered.length > ROWS_PER_PAGE && <div className="participant-pagination" aria-label="صفحه‌بندی دانش‌آموزان"><button type="button" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>قبلی</button><span>صفحه {(currentPage + 1).toLocaleString("fa-IR")} از {Math.ceil(filtered.length / ROWS_PER_PAGE).toLocaleString("fa-IR")}</span><button type="button" disabled={(currentPage + 1) * ROWS_PER_PAGE >= filtered.length} onClick={() => setPage(currentPage + 1)}>بعدی</button></div>}
      </>}
      <div className="participant-footer"><div aria-live="polite"><strong>{state.selected.length.toLocaleString("fa-IR")} دانش‌آموز انتخاب‌شده</strong>{!!selectedNames.length && <p>{selectedNames.join("، ")}{state.selected.length > 3 ? " و دیگران" : ""}</p>}</div><div className="exam-actions"><button type="button" className="exam-secondary" disabled={rosterDisabled || !state.selected.length} onClick={() => session.select([])}>پاک‌کردن انتخاب</button><button type="button" className="exam-primary" disabled={rosterDisabled || !state.selected.length} onClick={() => void session.save("POST")}>{state.busy ? "در حال ثبت…" : "افزودن دانش‌آموزان"}</button></div></div>
    </div>
  </section>;
}
