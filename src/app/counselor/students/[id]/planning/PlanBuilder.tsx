"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, allPages } from "@/lib/api";
import { AcademicOption, Commitment, currentWeekStart, persianDate, Plan, PlanDay, PlanItem, planningError, Student, weekDates } from "@/lib/planning";
import { useCounselor } from "../../../layout";
import StudentSummary from "../../StudentSummary";
import BlockEditor from "./BlockEditor";
import PlanBlock from "@/app/student/plans/PlanBlock";

export default function PlanBuilder({ studentId }: { studentId: string }) {
  const { token } = useCounselor();
  const [student, setStudent] = useState<Student | null>(null);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [subjects, setSubjects] = useState<AcademicOption[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [title, setTitle] = useState("");
  const [editorDayId, setEditorDayId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<PlanItem | undefined>();
  const [copyDayId, setCopyDayId] = useState<number | null>(null);
  const [copyTargetPlan, setCopyTargetPlan] = useState("");
  const [copyDate, setCopyDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([
      api<Student>(`/students/${studentId}/`, token),
      allPages<Commitment>("/planning/commitments/", token),
      allPages<Plan>("/planning/plans/", token),
    ]).then(async ([studentData, allCommitments, allPlans]) => {
      setStudent(studentData);
      setCommitments(allCommitments.filter((item) => item.student === studentData.id));
      const ownPlans = allPlans.filter((item) => item.student === studentData.id);
      setPlans(ownPlans);
      if (ownPlans.length) setPlanId(ownPlans[0].id);
      if (studentData.field) setSubjects(await allPages<AcademicOption>(`/academics/subjects/?field=${studentData.field}`, token));
    }).catch((reason) => setError(planningError(reason))).finally(() => setLoading(false));
  }, [studentId, token]);

  useEffect(() => {
    if (!planId) return;
    let live = true;
    api<Plan>(`/planning/plans/${planId}/`, token).then((data) => { if (live) setPlan(data); }).catch((reason) => { if (live) setError(planningError(reason)); });
    return () => { live = false; };
  }, [planId, token]);

  async function refresh(id = planId) {
    if (!id) return;
    const updated = await api<Plan>(`/planning/plans/${id}/`, token);
    setPlan(updated);
    setPlans((current) => current.map((item) => item.id === id ? updated : item));
  }

  async function createPlan(event: React.FormEvent) {
    event.preventDefault(); if (!student) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const end = new Date(`${weekStart}T12:00:00`);
      end.setDate(end.getDate() + 6);
      const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
      const created = await api<Plan>("/planning/plans/", token, "POST", { student: student.id, start_date: weekStart, end_date: endDate, title });
      setPlans((current) => [created, ...current]); setPlanId(created.id); setPlan(created); setTitle(""); setNotice("برنامه هفتگی ساخته شد. برای هر روز باکس اضافه کنید.");
    } catch (reason) { setError(planningError(reason)); }
    finally { setBusy(false); }
  }

  async function openEditor(date: string, item?: PlanItem) {
    if (!plan) return;
    setError(""); setEditingItem(item);
    const day = plan.days?.find((entry) => entry.date === date);
    if (day) { setEditorDayId(day.id); return; }
    try {
      const created = await api<PlanDay>("/planning/days/", token, "POST", { plan: plan.id, date });
      await refresh(); setEditorDayId(created.id);
    } catch (reason) { setError(planningError(reason)); }
  }

  async function afterSave() {
    try { await refresh(); setEditorDayId(null); setEditingItem(undefined); setNotice("باکس ذخیره شد."); }
    catch (reason) { setError(planningError(reason)); }
  }

  async function removeItem(item: PlanItem) {
    if (!window.confirm("این باکس حذف شود؟")) return;
    try { await api(`/planning/items/${item.id}/`, token, "DELETE"); await refresh(); setNotice("باکس حذف شد."); }
    catch (reason) { setError(planningError(reason)); }
  }

  async function copyItem(item: PlanItem, day: PlanDay) {
    try {
      await api("/planning/items/", token, "POST", {
        plan_day: day.id, kind: item.kind, ordering: Math.max(-1, ...day.items.map((row) => row.ordering)) + 1,
        title: item.title, planned_duration_minutes: item.planned_duration_minutes,
        start_time: item.start_time, end_time: item.end_time, note: item.note,
        subject: item.subject, chapter: item.chapter, topic: item.topic, test_count: item.test_count,
      });
      await refresh(); setNotice("کپی باکس ساخته شد.");
    } catch (reason) { setError(planningError(reason)); }
  }

  async function moveItem(day: PlanDay, index: number, direction: -1 | 1) {
    const rows = [...day.items];
    const next = index + direction;
    if (next < 0 || next >= rows.length) return;
    [rows[index], rows[next]] = [rows[next], rows[index]];
    try {
      for (const [ordering, item] of rows.entries()) await api(`/planning/items/${item.id}/`, token, "PATCH", { ordering });
      await refresh();
    } catch (reason) { setError(planningError(reason)); await refresh(); }
  }

  async function duplicatePlan() {
    if (!plan) return;
    try {
      const copied = await api<Plan>(`/planning/plans/${plan.id}/duplicate/`, token, "POST", {});
      setPlans((current) => [copied, ...current]); setPlanId(copied.id); setPlan(copied); setNotice("کپی برنامه به‌صورت پیش‌نویس ساخته شد.");
    } catch (reason) { setError(planningError(reason)); }
  }

  async function duplicateDay(event: React.FormEvent) {
    event.preventDefault();
    if (!copyDayId) return;
    try {
      const target = Number(copyTargetPlan) || planId;
      await api(`/planning/days/${copyDayId}/duplicate/`, token, "POST", { date: copyDate, target_plan: target });
      if (target === planId) await refresh();
      setCopyDayId(null); setNotice("روز همراه با باکس‌هایش کپی شد.");
    } catch (reason) { setError(planningError(reason)); }
  }

  async function publish() {
    if (!plan || !window.confirm("برنامه منتشر شود؟ دانش‌آموز آن را خواهد دید.")) return;
    try { await api(`/planning/plans/${plan.id}/publish/`, token, "POST", {}); await refresh(); setNotice("برنامه منتشر شد."); }
    catch (reason) { setError(planningError(reason)); }
  }

  async function removeEmptyDay(day: PlanDay) {
    if (day.items.length) return;
    try { await api(`/planning/days/${day.id}/`, token, "DELETE"); await refresh(); setEditorDayId(null); }
    catch (reason) { setError(planningError(reason)); }
  }

  if (loading) return <main className="planning-content"><p>در حال بارگذاری اطلاعات دانش‌آموز…</p></main>;
  return <main className="planning-content"><Link href={`/counselor/students/${studentId}`}>← اطلاعات دانش‌آموز</Link><h1>برنامه هفتگی</h1><p className="planning-error" role="alert">{error}</p><p className="planning-notice" role="status">{notice}</p>
    {student && <StudentSummary student={student} commitments={commitments}/>}
    {student && !student.field && <p className="planning-hint">رشته دانش‌آموز هنوز ثبت نشده است. برای باکس‌های درسی ابتدا رشته را تکمیل کنید.</p>}
    {student && student.field && subjects.length === 0 && <p className="planning-hint">درسی برای رشته این دانش‌آموز ثبت نشده است. باکس‌های رویداد و آزمونِ بدون درس همچنان قابل افزودن‌اند.</p>}
    <section className="planning-toolbar"><form onSubmit={createPlan}><h2>برنامه جدید</h2><label>شروع هفته (میلادی)<input type="date" required value={weekStart} onChange={(event) => setWeekStart(event.target.value)}/></label><label>عنوان (اختیاری)<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="برنامه این هفته"/></label><button disabled={busy}>{busy ? "در حال ساخت…" : "ساخت برنامه ۷ روزه"}</button></form>{plans.length > 0 && <label>برنامه‌های این دانش‌آموز<select value={planId || ""} onChange={(event) => { setPlan(null); setEditorDayId(null); setPlanId(Number(event.target.value)); }}><option value="" disabled>انتخاب برنامه</option>{plans.map((entry) => <option key={entry.id} value={entry.id}>{entry.title || persianDate(entry.start_date)} · {entry.status === "DRAFT" ? "پیش‌نویس" : "منتشرشده"}</option>)}</select></label>}</section>
    {!plan && !error && <p>هنوز برنامه‌ای برای این دانش‌آموز انتخاب نشده است.</p>}
    {plan && <section><div className="planning-plan-heading"><div><h2>{plan.title || `هفته ${persianDate(plan.start_date)}`}</h2><span className={`planning-status ${plan.status === "PUBLISHED" ? "is-published" : ""}`}>{plan.status === "DRAFT" ? "پیش‌نویس" : "منتشرشده"}</span></div><div className="planning-actions"><button type="button" onClick={duplicatePlan}>کپی برنامه</button>{plan.status === "DRAFT" && <button type="button" className="planning-primary" onClick={publish}>انتشار برنامه</button>}</div></div><p className="planning-hint">برای هر روز «افزودن باکس» را بزنید. زمان ساعت برای باکس‌ها اختیاری است.</p><div className="planning-week">{weekDates(plan.start_date, plan.end_date).map((date) => {
      const day = plan.days?.find((entry) => entry.date === date);
      const items = day?.items || [];
      return <section className="planning-day" key={date}><header><h3>{persianDate(date)}</h3><small dir="ltr">{date}</small></header><div className="planning-day-items">{items.length === 0 && <p className="planning-empty">هنوز باکسی ندارد.</p>}{items.map((item, index) => <PlanBlock key={item.id} item={item} actions={<><button type="button" onClick={() => openEditor(date, item)}>ویرایش</button><button type="button" onClick={() => copyItem(item, day!)}>کپی</button><button type="button" onClick={() => removeItem(item)}>حذف</button><button type="button" aria-label="انتقال به بالا" disabled={index === 0} onClick={() => moveItem(day!, index, -1)}>↑</button><button type="button" aria-label="انتقال به پایین" disabled={index === items.length - 1} onClick={() => moveItem(day!, index, 1)}>↓</button></>}/> )}</div><div className="planning-day-actions"><button type="button" className="planning-add" onClick={() => openEditor(date)}>+ افزودن باکس</button>{day && <button type="button" onClick={() => { setCopyDayId(day.id); setCopyTargetPlan(String(plan.id)); setCopyDate(weekDates(plan.start_date, plan.end_date).find((candidate) => !plan.days?.some((entry) => entry.date === candidate)) || ""); }}>کپی روز</button>}{day && items.length === 0 && <button type="button" onClick={() => removeEmptyDay(day)}>حذف روز خالی</button>}</div>{editorDayId === day?.id && <BlockEditor key={`${editorDayId}-${editingItem?.id || "new"}`} token={token} dayId={day.id} ordering={Math.max(-1, ...items.map((item) => item.ordering)) + 1} subjects={subjects} initial={editingItem} onSaved={afterSave} onCancel={() => { setEditorDayId(null); setEditingItem(undefined); }}/>}</section>;
    })}</div>{copyDayId && <form className="planning-copy-form" onSubmit={duplicateDay}><h3>کپی روز</h3><label>برنامه مقصد<select value={copyTargetPlan} onChange={(event) => { setCopyTargetPlan(event.target.value); const target = plans.find((entry) => entry.id === Number(event.target.value)); setCopyDate(target?.start_date || ""); }}>{plans.map((entry) => <option key={entry.id} value={entry.id}>{entry.title || persianDate(entry.start_date)} · {entry.status === "DRAFT" ? "پیش‌نویس" : "منتشرشده"}</option>)}</select></label><label>تاریخ مقصد<input type="date" required value={copyDate} onChange={(event) => setCopyDate(event.target.value)}/></label><button>ساخت کپی</button><button type="button" className="planning-subtle" onClick={() => setCopyDayId(null)}>انصراف</button></form>}</section>}
  </main>;
}
