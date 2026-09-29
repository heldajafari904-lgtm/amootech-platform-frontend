"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, allPages } from "@/lib/api";
import {
  currentWeekStart,
  downloadPlanExport,
  persianDate,
  Plan,
  PlanDay,
  PlanItem,
  planningError,
  Student,
  weekDates,
} from "@/lib/planning";
import { useCounselor } from "@/lib/counselorContext";
import { fetchAcademicTree, type AcademicTree } from "@/lib/academicTree";
import { tehranTodayIso } from "@/lib/reports";

// ---- util ----
function notify(setNotice: (s: string) => void, msg: string) {
  setNotice(msg);
  window.setTimeout(() => setNotice(""), 2500);
}
function apiErrorMessage(reason: unknown): string {
  const msg = planningError(reason);
  if (msg.includes("permission") || msg.includes("اجازه")) return "اجازه ویرایش این برنامه را ندارید.";
  if (msg.includes("past") || msg.includes("گذشته")) return "این فعالیت خارج از بازه برنامه است.";
  if (msg.includes("Date must be within")) return "این فعالیت خارج از بازه برنامه است.";
  return msg;
}

// ---- Student Header ----
function StudentPlanningHeader({
  student,
  plan,
  counselorName,
}: {
  student: Student;
  plan: Plan | null;
  counselorName: string;
}) {
  return (
    <section className="ws-header" aria-label="اطلاعات دانش‌آموز و برنامه">
      <div className="ws-header-main">
        <div>
          <p className="ws-eyebrow">فضای برنامه‌ریزی</p>
          <h1>
            {student.user.first_name} {student.user.last_name}
          </h1>
          <p className="ws-sub">
            {student.grade_name || "پایه نامشخص"} · {student.field_name || "رشته نامشخص"}
            {student.school_name ? ` · ${student.school_name}` : ""} · مشاور: {counselorName}
          </p>
        </div>
        {plan && (
          <div className="ws-plan-meta">
            <strong>{plan.title || `هفته ${persianDate(plan.start_date)}`}</strong>
            <span>
              {persianDate(plan.start_date)} تا {persianDate(plan.end_date)}
            </span>
            <span className={`ws-status ${plan.status === "PUBLISHED" ? "is-published" : ""}`}>
              {plan.status === "DRAFT" ? "پیش‌نویس" : "منتشرشده"}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

// ---- Metrics Bar ----
function MetricsBar({ plan, token }: { plan: Plan | null; token: string }) {
  const [data, setData] = useState<null | {
    plannedMinutes: number;
    actualMinutes: number;
    plannedTests: number;
    actualTests: number;
    completion: number | null;
    activeDays: number;
  }>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!plan?.id) {
      queueMicrotask(() => setData(null));
      return;
    }
    // compute from plan items + try counselor progress if available
    const plannedMinutes = (plan.days || []).flatMap((d) => d.items).reduce((s, i) => s + (i.planned_duration_minutes || 0), 0);
    const plannedTests = (plan.days || []).flatMap((d) => d.items).reduce((s, i) => s + (i.test_count || 0), 0);
    const activeDays = (plan.days || []).filter((d) => d.items.length > 0).length;
    // try fetch progress for actual/published metrics
    let live = true;
    queueMicrotask(() => setLoading(true));
    // metrics for progress are only for published scope; we attempt fetch but fallback to local
    api<unknown>(`/counselor/students/${plan.student}/progress/?start_date=${plan.start_date}&end_date=${plan.end_date}`, token)
      .then((res: unknown) => {
        if (!live) return;
        const r = res as { today?: unknown; recent_days?: { actual_minutes: number; actual_tests: number }[]; planned_items?: { actual_minutes: number | null; actual_tests: number | null; status: string }[] };
        if (r && Array.isArray(r.planned_items)) {
          const actualMinutes = r.planned_items.reduce((s: number, it: { actual_minutes: number | null }) => s + (it.actual_minutes || 0), 0);
          const actualTests = r.planned_items.reduce((s: number, it: { actual_tests: number | null }) => s + (it.actual_tests || 0), 0);
          const completed = r.planned_items.filter((it: { status: string }) => it.status === "COMPLETED").length;
          const total = r.planned_items.length;
          setData({
            plannedMinutes,
            plannedTests,
            actualMinutes,
            actualTests,
            completion: total ? Math.round((completed * 100) / total) : null,
            activeDays,
          });
        } else {
          setData({ plannedMinutes, plannedTests, actualMinutes: 0, actualTests: 0, completion: null, activeDays });
        }
      })
      .catch(() => {
        if (live) setData({ plannedMinutes, plannedTests, actualMinutes: 0, actualTests: 0, completion: null, activeDays });
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [plan, token]);

  if (!plan) return null;
  if (loading && !data) return <div className="ws-metrics ws-skeleton"><span/><span/><span/><span/><span/></div>;
  if (!data) return null;
  return (
    <section className="ws-metrics" aria-label="شاخص‌های برنامه">
      <div><small>دقایق برنامه</small><strong>{data.plannedMinutes}′</strong></div>
      <div><small>دقایق انجام‌شده</small><strong>{data.actualMinutes}′</strong></div>
      <div><small>درصد تکمیل</small><strong>{data.completion === null ? "—" : `${data.completion}%`}</strong></div>
      <div><small>تست برنامه</small><strong>{data.plannedTests}</strong></div>
      <div><small>روزهای فعال</small><strong>{data.activeDays}</strong></div>
    </section>
  );
}

// ---- QuickAdd ----
type QuickAddProps = {
  token: string;
  student: Student;
  dayId: number;
  ordering: number;
  tree: AcademicTree;
  onCreated: () => void;
  onError: (m: string) => void;
  initialItem?: PlanItem;
  onCancel?: () => void;
  mode?: "create" | "edit";
};

function QuickAdd({ token, dayId, ordering, tree, onCreated, onError, initialItem, onCancel, mode = "create" }: QuickAddProps) {
  const [kind, setKind] = useState<PlanItem["kind"]>((initialItem?.kind as PlanItem["kind"]) || "STUDY");
  const [subject, setSubject] = useState<string>(initialItem?.subject ? String(initialItem.subject) : "");
  const [chapter, setChapter] = useState<string>(initialItem?.chapter ? String(initialItem.chapter) : "");
  const [topic, setTopic] = useState<string>(initialItem?.topic ? String(initialItem.topic) : "");
  const [duration, setDuration] = useState<string>(initialItem?.planned_duration_minutes ? String(initialItem.planned_duration_minutes) : "60");
  const [testCount, setTestCount] = useState<string>(initialItem?.test_count ? String(initialItem.test_count) : "");
  const [title, setTitle] = useState(initialItem?.title || "");
  const [startTime, setStartTime] = useState(initialItem?.start_time?.slice(0, 5) || "");
  const [endTime, setEndTime] = useState(initialItem?.end_time?.slice(0, 5) || "");
  const [note, setNote] = useState(initialItem?.note || "");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const chapters = useMemo(() => (subject ? tree.chapters.filter((c) => String(c.subject) === subject) : []), [subject, tree]);
  const topics = useMemo(() => (chapter ? tree.topics.filter((t) => String(t.chapter) === chapter) : []), [chapter, tree]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const payload: Record<string, unknown> = {
      plan_day: dayId,
      kind,
      ordering: initialItem?.ordering ?? ordering,
      title: title.trim(),
      planned_duration_minutes: duration ? Number(duration) : null,
      start_time: startTime || null,
      end_time: endTime || null,
      note,
      subject: subject ? Number(subject) : null,
      chapter: chapter ? Number(chapter) : null,
      topic: topic ? Number(topic) : null,
      test_count: kind === "TEST" ? (testCount ? Number(testCount) : null) : null,
    };
    try {
      if (mode === "edit" && initialItem) {
        await api(`/planning/items/${initialItem.id}/`, token, "PATCH", payload);
      } else {
        await api("/planning/items/", token, "POST", payload);
      }
      onCreated();
    } catch (reason) {
      onError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="ws-quickadd" onSubmit={submit} aria-label={mode === "edit" ? "ویرایش فعالیت" : "افزودن سریع"}>
      <div className="ws-quickadd-row">
        <label>
          نوع
          <select value={kind} onChange={(e) => setKind(e.target.value as PlanItem["kind"])}>
            <option value="STUDY">مطالعه</option>
            <option value="TEST">تست</option>
            <option value="REVIEW">مرور</option>
            <option value="EXAM">آزمون</option>
            <option value="EVENT">رویداد</option>
          </select>
        </label>
        <label>
          درس
          <select value={subject} onChange={(e) => { setSubject(e.target.value); setChapter(""); setTopic(""); }}>
            <option value="">انتخاب درس</option>
            {tree.subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          مبحث/فصل
          <select value={chapter} onChange={(e) => { setChapter(e.target.value); setTopic(""); }} disabled={!subject}>
            <option value="">{chapters.length ? "انتخاب فصل" : "بدون فصل"}</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        {topics.length > 0 && (
          <label>
            مبحث
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">بدون مبحث</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="ws-quickadd-row">
        {(kind === "EXAM" || kind === "EVENT") && (
          <label>
            عنوان
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "EVENT" ? "مثلاً باشگاه" : "آزمون آزمایشی"} required />
          </label>
        )}
        <label>
          مدت (دقیقه)
          <input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} required={kind !== "EVENT"} />
        </label>
        {kind === "TEST" && (
          <label>
            تعداد تست
            <input type="number" min={1} value={testCount} onChange={(e) => setTestCount(e.target.value)} required />
          </label>
        )}
      </div>
      <button type="button" className="ws-link" onClick={() => setMore((v) => !v)} aria-expanded={more}>
        {more ? "بستن گزینه‌های بیشتر" : "گزینه‌های بیشتر"}
      </button>
      {more && (
        <div className="ws-quickadd-row">
          <label>ساعت شروع<input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
          <label>ساعت پایان<input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
          <label>توضیحات<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          {kind !== "EXAM" && kind !== "EVENT" ? (
            <label>عنوان (اختیاری)<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          ) : null}
        </div>
      )}
      <div className="ws-quickadd-actions">
        <button type="submit" disabled={busy}>{busy ? "در حال ذخیره…" : mode === "edit" ? "ذخیره تغییرات" : "افزودن"}</button>
        {onCancel && <button type="button" className="ws-subtle" onClick={onCancel}>انصراف</button>}
      </div>
    </form>
  );
}

// ---- Card ----
function PlanActivityCard({
  item,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
  draggableProps,
}: {
  item: PlanItem;
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onDelete: () => void;
  draggableProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const kindClass = `ws-card ws-card-${item.kind.toLowerCase()}`;
  return (
    <article className={kindClass} draggable {...draggableProps} data-item-id={item.id}>
      <div className="ws-card-head">
        <span className="ws-badge">{item.kind === "STUDY" ? "مطالعه" : item.kind === "TEST" ? "تست" : item.kind === "REVIEW" ? "مرور" : item.kind === "EXAM" ? "آزمون" : "رویداد"}</span>
        {item.start_time && item.end_time && <span className="ws-time" dir="ltr">{item.start_time.slice(0,5)}–{item.end_time.slice(0,5)}</span>}
      </div>
      <strong className="ws-card-title">{item.title || item.subject_name || "—"}</strong>
      {(item.chapter_name || item.topic_name) && <span className="ws-card-detail">{[item.chapter_name, item.topic_name].filter(Boolean).join(" ← ")}</span>}
      {item.subject_name && item.title && <span className="ws-card-detail">{item.subject_name}</span>}
      <div className="ws-card-meta">
        {item.planned_duration_minutes != null && <span>{item.planned_duration_minutes} دقیقه</span>}
        {item.test_count != null && <span>{item.test_count} تست</span>}
      </div>
      {item.note && <p className="ws-card-note">{item.note}</p>}
      <div className="ws-card-actions">
        <button type="button" onClick={onEdit}>ویرایش</button>
        <button type="button" onClick={onDuplicate}>تکثیر</button>
        <button type="button" onClick={onMove}>جابه‌جایی</button>
        <details className="ws-more">
          <summary aria-label="گزینه‌های بیشتر">⋯</summary>
          <button type="button" onClick={onDelete}>حذف</button>
        </details>
      </div>
      {!item.counselor_editable && item.edit_lock_reason && <small className="ws-lock">{item.edit_lock_reason}</small>}
    </article>
  );
}

// ---- Main Workspace ----
export default function PlanningWorkspace({ studentId }: { studentId: string }) {
  const { token, user } = useCounselor();
  const [student, setStudent] = useState<Student | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [title, setTitle] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [quickAddDay, setQuickAddDay] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<PlanItem | null>(null);
  const [moveItem, setMoveItem] = useState<PlanItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [tree, setTree] = useState<AcademicTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const today = tehranTodayIso();

  // URL state
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const pid = q.get("plan");
    const day = q.get("day");
    queueMicrotask(() => {
      if (day) setSelectedDay(day);
      if (pid && pid !== "null") setPlanId(Number(pid));
    });
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (planId) url.searchParams.set("plan", String(planId));
    else url.searchParams.delete("plan");
    if (selectedDay) url.searchParams.set("day", selectedDay);
    else url.searchParams.delete("day");
    window.history.replaceState({}, "", url.toString());
  }, [planId, selectedDay]);

  // initial load
  useEffect(() => {
    let live = true;
    Promise.all([
      api<Student>(`/students/${studentId}/`, token),
      allPages<Plan>(`/planning/plans/?student=${studentId}`, token),
    ])
      .then(([s, allPlans]) => {
        if (!live) return;
        setStudent(s);
        const own = allPlans.filter((p) => p.student === s.id);
        setPlans(own);
        const q = new URLSearchParams(window.location.search);
        const requested = Number(q.get("plan"));
        if (requested && own.some((p) => p.id === requested)) setPlanId(requested);
        else if (!q.has("new") && own.length) setPlanId(own[0].id);
        // fetch academic tree once
        fetchAcademicTree(token, { student: String(s.id) }).then((t) => { if (live) setTree(t); }).catch(()=>{});
      })
      .catch((r) => { if (live) setError(apiErrorMessage(r)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [studentId, token]);

  // load plan detail
  const refresh = useCallback(async (id = planId) => {
    if (!id) return;
    const p = await api<Plan>(`/planning/plans/${id}/`, token);
    setPlan(p);
    setPlans((cur) => cur.map((x) => (x.id === id ? p : x)));
  }, [planId, token]);

  useEffect(() => {
    if (!planId) return;
    let live = true;
    api<Plan>(`/planning/plans/${planId}/`, token)
      .then((p) => { if (live) setPlan(p); })
      .catch((r) => { if (live) setError(apiErrorMessage(r)); });
    return () => { live = false; };
  }, [planId, token]);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!student) return;
    setBusy(true); setError("");
    try {
      const end = new Date(`${weekStart}T12:00:00`);
      end.setDate(end.getDate() + 6);
      const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2,"0")}-${String(end.getDate()).padStart(2,"0")}`;
      const created = await api<Plan>("/planning/plans/", token, "POST", { student: student.id, start_date: weekStart, end_date: endDate, title });
      setPlans((c) => [created, ...c]); setPlanId(created.id); setPlan(created); setTitle(""); notify(setNotice, "برنامه هفتگی ساخته شد.");
    } catch (r) { setError(apiErrorMessage(r)); } finally { setBusy(false); }
  }

  async function ensureDay(date: string): Promise<PlanDay | null> {
    if (!plan) return null;
    const existing = plan.days?.find((d) => d.date === date);
    if (existing) return existing;
    const created = await api<PlanDay>("/planning/days/", token, "POST", { plan: plan.id, date });
    await refresh();
    // return created (with empty items)
    return { ...created, items: [] } as PlanDay;
  }

  async function handleDuplicate(item: PlanItem) {
    // optimistic: copy via dedicate endpoint
    const snapshot = plan;
    try {
      await api(`/planning/items/${item.id}/duplicate/`, token, "POST", {});
      await refresh();
      notify(setNotice, "تکثیر انجام شد.");
    } catch (reason: unknown) {
      setError(apiErrorMessage(reason));
      if (snapshot) setPlan(snapshot);
    }
  }

  async function handleDelete(item: PlanItem) {
    if (!window.confirm("این فعالیت حذف شود؟")) return;
    const snapshot = plan ? JSON.parse(JSON.stringify(plan)) : null;
    // optimistic remove
    if (plan) {
      setPlan({ ...plan, days: plan.days?.map((d) => ({ ...d, items: d.items.filter((i) => i.id !== item.id) })) } as Plan);
    }
    try {
      await api(`/planning/items/${item.id}/`, token, "DELETE");
      await refresh();
      notify(setNotice, "فعالیت حذف شد.");
    } catch (reason: unknown) {
      setError(apiErrorMessage(reason));
      if (snapshot) setPlan(snapshot);
      await refresh().catch(()=>{});
    }
  }

  async function handleMove() {
    if (!moveItem || !moveTarget || !plan) return;
    const snapshot = JSON.parse(JSON.stringify(plan)) as Plan;
    // find target day
    let targetDay = plan.days?.find((d) => d.date === moveTarget);
    if (!targetDay) {
      try {
        const created = await api<PlanDay>("/planning/days/", token, "POST", { plan: plan.id, date: moveTarget });
        await refresh();
        targetDay = { ...created, items: [] } as unknown as PlanDay;
      } catch (r) { setError(apiErrorMessage(r)); return; }
    }
    // optimistic: move in UI
    setPlan((prev) => {
      if (!prev) return prev;
      const next = { ...prev, days: prev.days?.map((d) => ({ ...d, items: [...d.items] })) } as Plan;
      // remove from source
      for (const d of next.days || []) {
        d.items = d.items.filter((i) => i.id !== moveItem.id);
      }
      const td = next.days?.find((d) => d.date === moveTarget);
      if (td) {
        const moved = { ...moveItem, plan_day: td.id };
        td.items = [...td.items, moved];
      }
      return next;
    });
    try {
      await api(`/planning/items/${moveItem.id}/move/`, token, "POST", { target_day: targetDay!.id });
      await refresh();
      setMoveItem(null); setMoveTarget("");
      notify(setNotice, "جابه‌جایی انجام شد.");
    } catch {
      setError("جابه‌جایی انجام نشد؛ تغییرات برگردانده شد.");
      setPlan(snapshot);
      await refresh().catch(()=>{});
    }
  }

  async function handleReorder(day: PlanDay, fromId: number, toIndex: number) {
    const snapshot = plan ? JSON.parse(JSON.stringify(plan)) : null;
    // optimistic reorder
    if (plan) {
      setPlan((prev) => {
        if (!prev) return prev;
        const next = { ...prev, days: prev.days?.map((d) => ({ ...d, items: [...d.items] })) } as Plan;
        const d = next.days?.find((x) => x.id === day.id);
        if (!d) return prev;
        const idx = d.items.findIndex((i) => i.id === fromId);
        if (idx === -1) return prev;
        const [moved] = d.items.splice(idx, 1);
        const clamped = Math.max(0, Math.min(toIndex, d.items.length));
        d.items.splice(clamped, 0, moved);
        d.items.forEach((it, i) => (it.ordering = i));
        return next;
      });
    }
    try {
      // compute new ordering ids
      const currentDay = plan?.days?.find((d) => d.id === day.id);
      if (!currentDay) throw new Error("day missing");
      const ids = currentDay.items.map((i) => i.id);
      const fromIdx = ids.indexOf(fromId);
      if (fromIdx === -1) throw new Error("item missing");
      ids.splice(fromIdx, 1);
      const clamped = Math.max(0, Math.min(toIndex, ids.length));
      ids.splice(clamped, 0, fromId);
      await api(`/planning/days/${day.id}/reorder/`, token, "POST", { ordering: ids });
      await refresh();
    } catch {
      setError("جابه‌جایی انجام نشد؛ تغییرات برگردانده شد.");
      if (snapshot) setPlan(snapshot);
      await refresh().catch(()=>{});
    }
  }

  // DnD handlers
  function onDragStart(e: React.DragEvent, itemId: number) {
    e.dataTransfer.setData("text/plain", String(itemId));
    e.dataTransfer.effectAllowed = "move";
  }
  function onDrop(e: React.DragEvent, targetDay: PlanDay, targetIndex?: number) {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("text/plain"));
    if (!id) return;
    // if dropped on same day, reorder; else move
    const sourceDay = plan?.days?.find((d) => d.items.some((i) => i.id === id));
    if (!sourceDay) return;
    if (sourceDay.id === targetDay.id) {
      const to = targetIndex ?? targetDay.items.length;
      handleReorder(targetDay, id, to);
    } else {
      // move to targetDay at position
      const item = sourceDay.items.find((i) => i.id === id);
      if (!item) return;
      // optimistic move then API
      const snapshot = plan ? JSON.parse(JSON.stringify(plan)) : null;
      setPlan((prev) => {
        if (!prev) return prev;
        const next = { ...prev, days: prev.days?.map((d) => ({ ...d, items: [...d.items] })) } as Plan;
        for (const d of next.days || []) d.items = d.items.filter((i) => i.id !== id);
        const td = next.days?.find((d) => d.id === targetDay.id);
        if (td) {
          const moved = { ...item, plan_day: td.id };
          const idx = targetIndex ?? td.items.length;
          td.items.splice(idx, 0, moved);
          td.items.forEach((it, i) => (it.ordering = i));
        }
        return next;
      });
      api(`/planning/items/${id}/move/`, token, "POST", { target_day: targetDay.id, ordering: targetIndex ?? undefined })
        .then(() => refresh())
        .catch(() => {
          setError("جابه‌جایی انجام نشد؛ تغییرات برگردانده شد.");
          if (snapshot) setPlan(snapshot);
          refresh().catch(()=>{});
        });
    }
  }

  if (loading) {
    return (
      <main className="ws-shell">
        <div className="ws-skeleton-card" />
        <div className="ws-skeleton-grid"><span/><span/><span/><span/><span/><span/><span/></div>
      </main>
    );
  }

  const days = plan ? weekDates(plan.start_date, plan.end_date) : [];
  return (
    <main className="ws-shell">
      <Link href={`/counselor/students/${studentId}`} className="ws-back">← بازگشت به فضای دانش‌آموز</Link>
      {error && <p className="ws-error" role="alert">{error}</p>}
      {notice && <p className="ws-notice" role="status">{notice}</p>}
      {student && <StudentPlanningHeader student={student} plan={plan} counselorName={user.first_name || user.username} />}
      {plan && <MetricsBar plan={plan} token={token} />}

      <section className="ws-toolbar">
        <form onSubmit={createPlan} className="ws-toolbar-form">
          <h2>برنامه جدید</h2>
          <label>شروع هفته<input type="date" required value={weekStart} onChange={(e) => setWeekStart(e.target.value)} /></label>
          <label>عنوان<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="برنامه این هفته" /></label>
          <button disabled={busy}>{busy ? "در حال ساخت…" : "ساخت برنامه ۷ روزه"}</button>
        </form>
        {plans.length > 0 && (
          <label className="ws-plan-select">برنامه
            <select value={planId || ""} onChange={(e) => { setPlan(null); setPlanId(Number(e.target.value)); }}>
              <option value="" disabled>انتخاب برنامه</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.title || persianDate(p.start_date)} · {p.status === "DRAFT" ? "پیش‌نویس" : "منتشرشده"}</option>)}
            </select>
          </label>
        )}
        {plan && (
          <div className="ws-actions">
            <button type="button" onClick={async () => { try { await downloadPlanExport(plan.id, "pdf", token);} catch(r){ setError(apiErrorMessage(r)); }}}>دریافت PDF</button>
            <button type="button" onClick={async () => { try { await downloadPlanExport(plan.id, "excel", token);} catch(r){ setError(apiErrorMessage(r)); }}}>دریافت اکسل</button>
          </div>
        )}
      </section>

      {!plan && !loading && <div className="ws-empty"><p>هنوز فعالیتی برای این هفته ثبت نشده.</p><button className="ws-primary" onClick={() => document.getElementById("ws-create-trigger")?.scrollIntoView({behavior:"smooth"})}>اولین فعالیت را اضافه کن</button></div>}

      {plan && (
        <>
          {/* Mobile day tabs */}
          <nav className="ws-day-tabs" aria-label="روزهای هفته">
            {days.map((d) => (
              <button key={d} className={selectedDay === d ? "is-active" : ""} onClick={() => setSelectedDay(d)}>{persianDate(d).split("،")[0]}</button>
            ))}
            <button className={!selectedDay ? "is-active" : ""} onClick={() => setSelectedDay(null)}>همه روزها</button>
          </nav>

          <div className="ws-week">
            {days.filter((d) => !selectedDay || d === selectedDay).map((date) => {
              const day = plan.days?.find((x) => x.date === date);
              const items = day?.items ? [...day.items].sort((a,b)=> a.ordering - b.ordering) : [];
              return (
                <section
                  key={date}
                  className={`ws-day ${date === today ? "is-today" : ""} ${date < today ? "is-past" : ""}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    // if no items, treat as append
                    if (!day) {
                      // create day then move? skip: need day id - handle via ensureDay
                    } else onDrop(e, day);
                  }}
                >
                  <header className="ws-day-head">
                    <div>
                      {date < today && <span className="ws-badge-past">گذشته — فقط مشاهده</span>}
                      {date === today && <span className="ws-badge-today">امروز</span>}
                      <h3>{persianDate(date)}</h3>
                      <small dir="ltr">{date}</small>
                    </div>
                    <button
                      className="ws-add"
                      onClick={async () => {
                        if (!day) {
                          const nd = await ensureDay(date);
                          if (nd) setQuickAddDay(date);
                        } else setQuickAddDay(quickAddDay === date ? null : date);
                      }}
                      aria-label={`افزودن فعالیت برای ${date}`}
                      disabled={date < today}
                    >
                      + افزودن
                    </button>
                  </header>

                  <div className="ws-day-items" onDragOver={(e)=>e.preventDefault()}>
                    {items.length === 0 ? <p className="ws-empty-text">فعالیتی ثبت نشده.</p> : items.map((item, idx) => (
                      <div key={item.id} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=> onDrop(e, day!, idx)}>
                        <PlanActivityCard
                          item={item}
                          draggableProps={{
                            draggable: !!item.counselor_editable,
                            onDragStart: (e) => onDragStart(e as unknown as React.DragEvent, item.id),
                          }}
                          onEdit={() => setEditingItem(item)}
                          onDuplicate={() => handleDuplicate(item)}
                          onMove={() => { setMoveItem(item); setMoveTarget(date); }}
                          onDelete={() => handleDelete(item)}
                        />
                        {/* reorder handle fallback */}
                        {item.counselor_editable && items.length > 1 && (
                          <div className="ws-reorder">
                            <button aria-label="بالا" disabled={idx===0} onClick={()=> handleReorder(day!, item.id, idx-1)}>↑</button>
                            <button aria-label="پایین" disabled={idx===items.length-1} onClick={()=> handleReorder(day!, item.id, idx+1)}>↓</button>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* drop at end */}
                    {day && items.length>0 && <div className="ws-drop-end" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=> onDrop(e, day, items.length)}>رها کنید تا به انتها اضافه شود</div>}
                  </div>

                  {quickAddDay === date && tree && day && (
                    <QuickAdd
                      token={token}
                      student={student!}
                      dayId={day.id}
                      ordering={items.length}
                      tree={tree}
                      onCreated={async () => { setQuickAddDay(null); await refresh(); notify(setNotice, "فعالیت اضافه شد."); }}
                      onError={setError}
                      onCancel={() => setQuickAddDay(null)}
                    />
                  )}
                  {quickAddDay === date && !day && <p className="ws-hint">در حال ساخت روز…</p>}
                </section>
              );
            })}
          </div>
        </>
      )}

      {editingItem && tree && (
        <div className="ws-modal" role="dialog" aria-modal="true" aria-label="ویرایش فعالیت">
          <div className="ws-modal-card">
            <QuickAdd
              token={token}
              student={student!}
              dayId={editingItem.plan_day}
              ordering={editingItem.ordering}
              tree={tree}
              initialItem={editingItem}
              mode="edit"
              onCreated={async () => { setEditingItem(null); await refresh(); notify(setNotice, "تغییرات ذخیره شد."); }}
              onError={setError}
              onCancel={() => setEditingItem(null)}
            />
          </div>
        </div>
      )}

      {moveItem && plan && (
        <div className="ws-modal" role="dialog" aria-modal="true" aria-label="انتقال فعالیت">
          <div className="ws-modal-card">
            <h3>انتقال «{moveItem.title || moveItem.subject_name}»</h3>
            <label>روز مقصد
              <select value={moveTarget} onChange={(e)=> setMoveTarget(e.target.value)}>
                {days.map((d)=> <option key={d} value={d}>{persianDate(d)} — {d}</option>)}
              </select>
            </label>
            <div className="ws-modal-actions">
              <button onClick={handleMove}>انتقال</button>
              <button className="ws-subtle" onClick={()=> { setMoveItem(null); setMoveTarget(""); }}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
