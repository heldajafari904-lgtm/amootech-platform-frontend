"use client";
import JalaliDateInput from "@/components/JalaliDateInput";

import Link from "next/link";
import { StudentPlanningHeader, TopChart } from "./PlanningOverview";
import WizardAddBox from "./WizardAddBox";
import ActivityEditor from "./ActivityEditor";
import TimelineBoard from "./TimelineBoard";
import { planningApi } from "./planningApi";
import { clampTime, itemDuration, minutesToTime, timeToMinutes } from "./plannerTime";
import { apiErrorMessage } from "./planningFeedback";
import FixedSchedulePanel from "./FixedSchedulePanel";
import { PanelIcon, useDialogFocus } from "@/components/counselor/PanelUI";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, allPages } from "@/lib/api";
import { IconButton } from "@/components/counselor/PanelUI";
import {
  addDaysISO,
  currentWeekStart,
  weekdayFa,
  Commitment,
  SchoolSlot,
  formatJalaliShort,
  persianDate,
  Plan,
  PlanDay,
  PlanItem,
  planTitleSuggestion,
  sevenDayRange,
  Student,
  tehranTodayISO,
  tehranTomorrowISO,
} from "@/lib/planning";
import { useCounselor } from "@/lib/counselorContext";
import { fetchAcademicTree, type AcademicTree } from "@/lib/academicTree";

// ---- util ----
function notify(setNotice: (s: string) => void, msg: string) {
  setNotice(msg);
  window.setTimeout(() => setNotice(""), 2500);
}
// ---- Main Workspace ----
export default function PlanningWorkspace({ studentId }: { studentId: string }) {
  const { token, user } = useCounselor();
  const [student, setStudent] = useState<Student | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [plan, setPlanState] = useState<Plan | null>(null);
  const planRef = useRef<Plan | null>(null);
  const setPlan = useCallback((value: React.SetStateAction<Plan | null>) => {
    const next = typeof value === "function" ? value(planRef.current) : value;
    planRef.current = next; setPlanState(next);
  }, []);
  const client = useMemo(() => planningApi(token), [token]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const locks = useRef(new Set<string>());
  const [actionKeys, setActionKeys] = useState(new Set<string>());
  const [deleteTarget, setDeleteTarget] = useState<PlanItem | null>(null);
  const [moveTime, setMoveTime] = useState("");
  const [moveUnscheduled, setMoveUnscheduled] = useState(false);
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
  const [pendingWrites, setPendingWrites] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [examDates, setExamDates] = useState<string[]>([]);
  const [newExamDates, setNewExamDates] = useState<string[]>([]);
  // draft cache: optimistic plan before Update
  const [hasDraft, setHasDraft] = useState(false);

  const today = tehranTodayISO();
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [schoolSlots, setSchoolSlots] = useState<SchoolSlot[]>([]);
  const [fixedOpen, setFixedOpen] = useState(false);
  const [copySource, setCopySource] = useState<PlanDay | null>(null);
  const [copyConfirm, setCopyConfirm] = useState<{target: PlanDay, mode: "append"|"replace"} | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const copying = useRef(false);
  const [chooseCopyMethod, setChooseCopyMethod] = useState(false);

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
    if (planId) { url.searchParams.set("plan", String(planId)); url.searchParams.delete("new"); }
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
        fetchAcademicTree(token, { student: String(s.id) }).then((t) => { if (live) setTree(t); }).catch(reason => { if (live) setError(apiErrorMessage(reason)); });
      // fetch fixed commitments for timeline + school slots
        allPages<Commitment>(`/planning/commitments/?student=${s.id}`, token).then((rows)=>{ if(live) setCommitments(rows); }).catch(reason => { if (live) setError(apiErrorMessage(reason)); });
        allPages<SchoolSlot>(`/planning/school-slots/?student=${s.id}`, token).then((rows)=>{ if(live) setSchoolSlots(rows); }).catch(()=>{});
      })
      .catch((r) => { if (live) setError(apiErrorMessage(r)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [studentId, token]);

  // load plan detail
  const refresh = useCallback(async (id = planId) => {
    if (!id) return;

    const before = planRef.current;
    const p = await client.getPlan(id);

    if (planRef.current !== before || (planRef.current && planRef.current.id !== id)) return;

    setPlan(p);
    setExamDates(
      (p as unknown as { exam_dates?: string[] }).exam_dates || []
    );
    setPlans((cur) =>
      cur.map((x) => (x.id === id ? p : x))
    );
  }, [client, planId, setPlan]);

  // Live resync: when fixed-schedule panel saved school slots, patch the open plan without full reload flicker
  useEffect(()=>{
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { planId: number; plan: Plan } | undefined;
      if (!detail?.plan) return;
      if (planRef.current?.id === detail.planId) setPlan(detail.plan);
      setPlans(current => current.map(plan => plan.id === detail.planId ? detail.plan : plan));
      notify(setNotice, "برنامه با برنامه‌های ثابت همگام شد.");
    };
    window.addEventListener("plan:fixed-resynced" as unknown as string, handler as EventListener);
    return ()=> window.removeEventListener("plan:fixed-resynced" as unknown as string, handler as EventListener);
  }, [planId, refresh, setPlan]);

  useEffect(() => {
    if (!planId) return;
    let live = true;
    const before = planRef.current;
    api<Plan>(`/planning/plans/${planId}/`, token)
      .then((p) => { if (live && planRef.current === before) { setPlan(p); setExamDates((p as unknown as {exam_dates?: string[]}).exam_dates||[]); } })
      .catch((r) => { if (live) setError(apiErrorMessage(r)); });
    return () => { live = false; };
  }, [planId, token, setPlan]);

  const refreshFixed = useCallback(async () => {
    if (!student) return;
    try {
      const [c, s] = await Promise.all([allPages<Commitment>(`/planning/commitments/?student=${student.id}`, token), allPages<SchoolSlot>(`/planning/school-slots/?student=${student.id}`, token)]);
      setCommitments(c); setSchoolSlots(s);
    } catch {}
  }, [student, token]);

  const [applyFixedChoice, setApplyFixedChoice] = useState<"apply"|"empty">("apply");
  const [newPlanStep, setNewPlanStep] = useState<1|2>(1);
  const creatingPlan = useRef(false);
  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!student || creatingPlan.current) return;
    creatingPlan.current = true; setPendingWrites(count => count + 1);
    setBusy(true); setError("");
    try {
      const endDate = addDaysISO(weekStart,6);
      const effectiveTitle = title.trim() || planTitleSuggestion(weekStart, endDate);
      const created = await client.createPlan({ student: student.id, start_date: weekStart, end_date: endDate, title: effectiveTitle, apply_fixed: applyFixedChoice==="apply", exam_dates: newExamDates });
      setHasSaved(true); setSaveFailed(false); setPlans((c) => [created, ...c]); setPlanId(created.id); setPlan(created); setTitle(""); setExamDates(created.exam_dates || []); setNewExamDates([]); setNewPlanStep(1); setShowNewPlan(false); notify(setNotice, applyFixedChoice==="apply" ? "برنامه با باکس‌های ثابت ساخته شد." : "برنامه خالی ساخته شد.");
    } catch (r) { setSaveFailed(true); setError(apiErrorMessage(r)); } finally { creatingPlan.current = false; setBusy(false); setPendingWrites(count => count - 1); }
  }

  async function perform<T>(key: string, operation: () => Promise<T>): Promise<T> {
    if (locks.current.has(key)) throw new Error("این عملیات در حال انجام است؛ منتظر بمانید.");
    locks.current.add(key); setActionKeys(new Set(locks.current));
    const task = queue.current.then(operation);
    queue.current = task.catch(() => {});
    try { return await task; }
    finally { locks.current.delete(key); setActionKeys(new Set(locks.current)); }
  }

  const creatingDays = useRef(new Map<string, Promise<PlanDay>>());
  async function ensureDay(date: string): Promise<PlanDay | null> {
    const current = planRef.current;
    if (!current) return null;
    const existing = current.days?.find(day => day.date === date);
    if (existing) return existing;
    const key = `${current.id}:${date}`;
    const pending = creatingDays.current.get(key);
    if (pending) return pending;
    const creation = client.createDay(current.id, date).then(created => {
      const canonical = { ...created, items: created.items || [] };
      setPlan(previous => previous?.id === current.id ? { ...previous, days: [...(previous.days || []).filter(day => day.id !== canonical.id), canonical] } : previous);
      return canonical;
    }).finally(() => creatingDays.current.delete(key));
    creatingDays.current.set(key, creation);
    return creation;
  }

  async function mutate(key: string, operation: () => Promise<unknown>, optimistic?: (value: Plan) => Plan, message?: string) {
    return perform(key, async () => {
      const snapshot = planRef.current;
      if (!snapshot) return;
      setError(""); setSaveFailed(false); setPendingWrites(count => count + 1);
      if (optimistic) { const nxt = optimistic(snapshot); setPlan(nxt); try{ localStorage.setItem(`draft:plan:${snapshot.id}`, JSON.stringify({...nxt, updated_at: new Date().toISOString()})); setHasDraft(true);}catch{} } 
      try {
        const result = await operation();
        if (result && typeof result === "object" && "plan_day" in result) {
          const item = result as PlanItem;
          setPlan(previous => previous?.id === snapshot.id ? { ...previous, days: previous.days?.map(day => ({ ...day, items: [...day.items.filter(old => old.id !== item.id), ...(day.id === item.plan_day ? [item] : [])] })) } : previous);
        } else if (result && typeof result === "object" && "items" in result) {
          const day = result as PlanDay;
          setPlan(previous => previous?.id === snapshot.id ? { ...previous, days: previous.days?.map(old => old.id === day.id ? day : old) } : previous);
        } else if (result && typeof result === "object" && "status" in result) {
          const summary = result as Plan;
          setPlan(previous => previous?.id === snapshot.id ? { ...previous, ...summary, days: previous.days } : previous);
        }
        await refresh(snapshot.id).catch(reason => setError(`تغییرات ذخیره شد؛ دریافت تازه‌ترین برنامه ناموفق بود: ${apiErrorMessage(reason)}`));
        setHasSaved(true); if (message) notify(setNotice, message);
      } catch (reason) {
        if (planRef.current?.id === snapshot.id) setPlan(snapshot);
        setSaveFailed(true); setError(apiErrorMessage(reason));
        throw reason;
      } finally { setPendingWrites(count => count - 1); }
    });
  }

  async function canonicalItem(item: PlanItem) {
    setPlan(previous => previous?.days?.some(day => day.id === item.plan_day) ? { ...previous, days: previous.days.map(day => ({ ...day, items: [...day.items.filter(old => old.id !== item.id), ...(day.id === item.plan_day ? [item] : [])] })) } : previous);
    // A failed read after a confirmed write must not turn a successful create into a retry/duplicate.
    if (planRef.current) await refresh(planRef.current.id).catch(reason => setError(`فعالیت ثبت شد؛ دریافت تازه‌ترین برنامه ناموفق بود: ${apiErrorMessage(reason)}`));
    setHasSaved(true); setSaveFailed(false); notify(setNotice, "فعالیت ثبت شد.");
  }

  async function handleDuplicate(item: PlanItem) {
    try { await mutate(`item:${item.id}`, () => client.duplicateItem(item.id), undefined, "فعالیت کپی شد."); } catch { /* visible error from mutate */ }
  }
  async function handleDelete(item: PlanItem) {
    try { await mutate(`item:${item.id}`, () => client.deleteItem(item.id), previous => ({ ...previous, days: previous.days?.map(day => ({ ...day, items: day.items.filter(old => old.id !== item.id) })) }), "فعالیت حذف شد."); setDeleteTarget(null); } catch { /* retain confirmation for retry */ }
  }
  async function transfer(item: PlanItem, target: { date: string; minutes: number | null; ordering?: number; error?: string | null }) {
    // No-op revert: same day + same start (scroll jitter while picking up) -> silently drop without API
    const isSameSpot = (() => {
      if (!item.start_time || target.minutes === null) return false;
      const origin = planRef.current?.days?.find(d=> d.items.some(x=> x.id===item.id))?.date;
      return origin === target.date && item.start_time.slice(0,5) === minutesToTime(target.minutes).slice(0,5);
    })();
    if (isSameSpot) return;
    if (target.error) { setError(target.error); return; }
    const duration = itemDuration(item);
    const start = target.minutes === null ? null : minutesToTime(target.minutes);
    const end = target.minutes === null ? null : minutesToTime(target.minutes + duration);
    try {
      await perform(`item:${item.id}`, async () => {
        const snapshot = planRef.current; if (!snapshot) return;
        const originalDay = snapshot.days?.find(day => day.items.some(entry => entry.id === item.id));
        const originalItem = originalDay?.items.find(entry => entry.id === item.id) || item;
        const day = await ensureDay(target.date); if (!day) return;
        setPendingWrites(count => count + 1); setError("");
        const moved = { ...item, plan_day: day.id, start_time: start, end_time: end, planned_duration_minutes: duration, ordering: target.ordering ?? day.items.length };
        setPlan(previous => previous?.id === snapshot.id ? { ...previous, days: previous.days?.map(entry => ({ ...entry, items: [...entry.items.filter(old => old.id !== item.id), ...(entry.id === day.id ? [moved] : [])] })) } : previous);
        try {
          const canonical = await client.moveItem(item.id, { target_day: day.id, start_time: start, end_time: end, planned_duration_minutes: duration, ordering: target.ordering });
          setPlan(previous => previous?.id === snapshot.id ? { ...previous, days: previous.days?.map(entry => ({ ...entry, items: [...entry.items.filter(old => old.id !== item.id), ...(entry.id === canonical.plan_day ? [canonical] : [])] })) } : previous);
          if (canonical.fixed_source_type) void refreshFixed();
          setHasSaved(true); setSaveFailed(false); notify(setNotice, "فعالیت جابه‌جا شد.");
        } catch (reason) {
          setPlan(previous => previous?.id === snapshot.id ? { ...previous, days: previous.days?.map(entry => ({ ...entry, items: [...entry.items.filter(old => old.id !== item.id), ...(entry.id === originalDay?.id ? [originalItem] : [])] })) } : previous);
          setSaveFailed(true); throw reason;
        }
        finally { setPendingWrites(count => count - 1); }
      });
    } catch (reason) { setError(`${apiErrorMessage(reason)} تغییرات برگردانده شد.`); }
  }
  async function handleMove() {
    if (!moveItem || !moveTarget) return;
    const minutes = moveUnscheduled ? null : clampTime(timeToMinutes(moveTime || "06:00"), itemDuration(moveItem));
    await transfer(moveItem, { date: moveTarget, minutes });
    // Keep the move dialog open if the server rejected the operation.
    const actual = planRef.current?.days?.find(day => day.date === moveTarget)?.items.find(item => item.id === moveItem.id);
    if (actual && actual.start_time?.slice(0,5) === (minutes === null ? undefined : minutesToTime(minutes))) setMoveItem(null);
  }

  function startCopy(day: PlanDay) { setSelectedDay(null); setChooseCopyMethod(false); setCopySource(day); setCopyConfirm(null); setError(""); }
  function cancelCopy() { if (!copyBusy) { setCopySource(null); setCopyConfirm(null); } }
  async function executeCopy(target: PlanDay, mode: "append" | "replace") {
    if (!copySource || copying.current) return;
    copying.current = true; const source = copySource; setCopyBusy(true);
    try { await mutate(`copy:${source.id}`, () => client.copyDay(source.id,target.id,mode), undefined, `فعالیت‌های ${persianDate(source.date)} به ${persianDate(target.date)} اضافه شدند.`); setCopySource(null); setCopyConfirm(null); }
    catch { /* copy mode stays open, destination is never overwritten on failure */ }
    finally { copying.current = false; setCopyBusy(false); }
  }
  async function handleCopyTargetClick(date: string, existing?: PlanDay | null) {
    if (!copySource || copyBusy || copySource.date === date) return;
    try {
      const target = existing || await ensureDay(date); if (!target) return;
      if (chooseCopyMethod) { setCopyConfirm({ target, mode: "append" }); return; }
      await executeCopy(target,"append");
    } catch (reason) { setError(apiErrorMessage(reason)); }
  }
  useEffect(() => {
    if (!copySource || copyBusy) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setCopySource(null); setCopyConfirm(null); } };
    window.addEventListener("keydown",escape); return () => window.removeEventListener("keydown",escape);
  },[copySource,copyBusy]);
  async function addToDay(date: string) {
    try { await perform(`day:${date}`, async () => { const day = await ensureDay(date); if (day) setQuickAddDay(date); }); }
    catch (reason) { setError(apiErrorMessage(reason)); }
  }
  async function publishPlan() {
    if (!plan) return;
    try { await mutate(`publish:${plan.id}`, () => client.publish(plan.id), undefined, "برنامه منتشر شد."); } catch { /* visible */ }
  }
  async function exportPlan(format: "excel" | "pdf") {
    if (!plan) return;
    try { await perform(`export:${format}`, () => client.export(plan.id,format)); } catch (reason) { setError(apiErrorMessage(reason)); }
  }

  const [showNewPlan, setShowNewPlan] = useState(false);
  useDialogFocus(!loading && (showNewPlan || !!copyConfirm || !!moveItem || !!deleteTarget), () => { setShowNewPlan(false); setCopyConfirm(null); setMoveItem(null); setDeleteTarget(null); });
  // open modal if ?new=1
  useEffect(()=>{
    const q=new URLSearchParams(window.location.search);
    if(q.get("new")==="1") queueMicrotask(()=> setShowNewPlan(true));
  },[]);
  // reuse MetricsBar data as metrics prop (lifted via state)
  const [topMetrics, setTopMetrics] = useState<{plannedMinutes:number; actualMinutes:number; plannedTests:number; actualTests:number; completion:number|null}|null>(null);
  // mirror MetricsBar fetch into topMetrics (lightweight)
  useEffect(()=>{
    if(!plan?.id || plan.start_date > tehranTodayISO()){ queueMicrotask(()=> setTopMetrics(null)); return; }
    const plannedMinutes=(plan.days||[]).flatMap(d=>d.items).reduce((a,i)=>a+(i.planned_duration_minutes||0),0);
    const plannedTests=(plan.days||[]).flatMap(d=>d.items).reduce((a,i)=>a+(i.test_count||0),0);
    let live=true;
    api<unknown>(`/counselor/students/${plan.student}/progress/?start_date=${plan.start_date}&end_date=${plan.end_date > tehranTodayISO() ? tehranTodayISO() : plan.end_date}`, token).then((res: unknown)=>{
      if(!live) return;
      const r=res as {planned_items?:{id:number;actual_minutes:number|null; actual_tests:number|null; status:string}[]};
      if(r && Array.isArray(r.planned_items)){
        const ids = new Set((plan.days || []).flatMap(day => day.items).map(item => item.id));
        const actualItems = r.planned_items.filter(item => ids.has(item.id));
        const actualMinutes=actualItems.reduce((a:number,it:{actual_minutes:number|null})=>a+(it.actual_minutes||0),0);
        const actualTests=actualItems.reduce((a:number,it:{actual_tests:number|null})=>a+(it.actual_tests||0),0);
        const comp = actualItems.length ? Math.round(actualItems.filter((it:{status:string})=>it.status==="COMPLETED").length*100/actualItems.length) : null;
        setTopMetrics({plannedMinutes, actualMinutes, plannedTests, actualTests, completion: comp});
      } else setTopMetrics(null);
    }).catch(reason => { if(live) { setTopMetrics(null); setError(`دریافت عملکرد ناموفق بود: ${apiErrorMessage(reason)}`); } });
    return()=>{live=false;};
  },[plan, token]);

  const activeCommitments = commitments.filter(c=>c.active);
  const days = plan ? sevenDayRange(plan.start_date) : [];
  if (loading) {
    return (
      <main className="ws-shell">
        <div className="ws-skeleton-card" />
        <div className="ws-skeleton-grid"><span/><span/><span/><span/><span/><span/><span/></div>
      </main>
    );
  }
  return (
    <main className="ws-shell">
      <Link href={`/counselor/students/${studentId}`} className="ws-back">← بازگشت به فضای دانش‌آموز</Link>
      {error && <p className="ws-error" role="alert">{error}</p>}
      {notice && <p className="ws-notice" role="status">{notice}</p>}
      {student && (
        <section className="ws-top" aria-label="خلاصه و کنترل برنامه">
          <div className="ws-top-main">
            <StudentPlanningHeader student={student} plan={plan} counselorName={user.first_name || user.username} metrics={topMetrics} />
            <TopChart plan={plan} />
          </div>
          <div className="ws-toolbar">
            <div className="ws-toolbar-plan">
              {plan ? <span className="ws-toolbar-plan-name">{plan.title || `${persianDate(plan.start_date)} تا ${persianDate(plan.end_date)}`}</span> : <span style={{fontSize:".85rem",color:"#5a6d76"}}>برنامه‌ای انتخاب نشده</span>}
              {plan && <span className={`ws-status ${plan.status==="PUBLISHED"?"is-published":""}`}>{plan.status==="DRAFT"?"پیش‌نویس":"منتشرشده"}</span>}
              {plans.length>1 && (
                <select className="ws-plan-select" value={planId||""} onChange={(e)=>{ setPlan(null); setPlanId(Number(e.target.value));}} aria-label="انتخاب برنامه">
                  {plans.map((p)=><option key={p.id} value={p.id}>{p.title || `${persianDate(p.start_date)} تا ${persianDate(p.end_date)}`}</option>)}
                </select>
              )}
            </div>
            <div className="ws-toolbar-actions"><span className="ws-save-state" role="status">{pendingWrites ? "در حال ذخیره…" : hasDraft ? "تغییرات ذخیره موقت شد" : saveFailed ? "خطا در ذخیره" : hasSaved ? "ذخیره شد" : ""}</span>
              {plan && <><button type="button" disabled={actionKeys.has("export:excel")} onClick={() => { void exportPlan("excel"); }}>Excel</button><button type="button" disabled={actionKeys.has("export:pdf")} onClick={() => { void exportPlan("pdf"); }}>PDF</button></>}
              {hasDraft && plan && <button type="button" onClick={async()=>{ if(planId) { localStorage.removeItem(`draft:plan:${planId}`); setHasDraft(false); await refresh(planId); notify(setNotice,"پیش‌نویس پاک شد."); }}}>لغو پیش‌نویس</button>}
              {plan && <button type="button" disabled={!hasDraft} title={hasDraft?"به‌روزرسانی نهایی":"تغییری برای اعمال نیست"} onClick={async()=>{ if(!planId||!hasDraft) return; try{ const raw=localStorage.getItem(`draft:plan:${planId}`); if(!raw) return; const draft=JSON.parse(raw); // push exam_dates if changed
                  if(draft.exam_dates) await api(`/planning/plans/${planId}/`, token, "PATCH", {exam_dates: draft.exam_dates, title: draft.title});
                  localStorage.removeItem(`draft:plan:${planId}`); setHasDraft(false); await refresh(planId); notify(setNotice,"برنامه به‌روزرسانی شد."); }catch(e){ setError(apiErrorMessage(e)); }}}>به‌روزرسانی برنامه</button>}
              {plan && <IconButton icon="trash" label="حذف برنامه" variant="danger" onClick={async()=>{ if(!plan) return; if(!confirm("برنامه هفتگی حذف شود؟")) return; try{ await api(`/planning/plans/${plan.id}/`, token, "DELETE"); setPlans(v=>v.filter(x=>x.id!==plan.id)); setPlan(null); setPlanId(null); localStorage.removeItem(`draft:plan:${plan.id}`); notify(setNotice,"برنامه حذف شد."); }catch(e){ setError(apiErrorMessage(e)); }}} />}
              {plan?.status === "DRAFT" && <button type="button" className="ws-primary" disabled={actionKeys.has(`publish:${plan.id}`)} onClick={() => { void publishPlan(); }}>{actionKeys.has(`publish:${plan.id}`) ? "در حال انتشار…" : "انتشار برنامه"}</button>}
              <button type="button" className="ws-toolbar-new" onClick={()=> setShowNewPlan(true)}>＋ برنامه جدید</button>
            </div>
          </div>
        </section>
      )}
      {copySource && (
        <div className="ws-copy-banner" role="status">
          <span>{copyBusy ? "در حال کپی و ذخیره…" : `«${persianDate(copySource.date)}» به‌عنوان مبدأ انتخاب شد — روز مقصد را انتخاب کنید`}</span>
          <div className="panel-row-actions"><button type="button" aria-pressed={chooseCopyMethod} onClick={() => setChooseCopyMethod(value => !value)}>{chooseCopyMethod ? "انتخاب روش کپی فعال است" : "انتخاب روش افزودن / جایگزینی"}</button><button type="button" className="ws-subtle" onClick={cancelCopy}>لغو کپی (Esc)</button></div>
        </div>
      )}
      <section style={{ display: "grid", gap: 8 }}>
        <button onClick={() => setFixedOpen(v => !v)} style={{ justifySelf: "start", border: "1px solid #e7e1ec", background: fixedOpen ? "#f6f1fb" : "white", color: fixedOpen ? "#5B0FAD" : "#16041E", borderRadius: 8, padding: "8px 14px", fontWeight: 700 }}>{fixedOpen ? "بستن برنامه‌های ثابت" : "مدیریت برنامه‌های ثابت (مدرسه و کلاس‌ها)"}</button>
        {fixedOpen && <FixedSchedulePanel token={token} studentId={studentId} commitments={commitments} schoolSlots={schoolSlots} onRefresh={refreshFixed} planId={planId ?? undefined} />}
      </section>
      {/* New plan modal (no longer always visible) */}
      {showNewPlan && (
        <div className="ws-modal" role="dialog" aria-modal="true" aria-label="برنامه جدید" onClick={()=> { setShowNewPlan(false); setNewPlanStep(1); }}>
          <div className="ws-modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:560}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <h3 style={{fontSize:".95rem",fontWeight:800}}>برنامه جدید</h3>
              <button type="button" className="ws-subtle" aria-label="بستن برنامه جدید" onClick={()=> { setShowNewPlan(false); setNewPlanStep(1); }}><PanelIcon name="close"/></button>
            </div>
            <div className="ws-wizard-steps" aria-hidden>
              <span className={`ws-wizard-stepdot ${newPlanStep===1?"is-active": newPlanStep===2?"is-done":""}`}>۱</span>
              <span style={{flex:1, height:2, background: newPlanStep===2? "#5B0FAD":"#e7e1ec", borderRadius:2}}/>
              <span className={`ws-wizard-stepdot ${newPlanStep===2?"is-active":""}`}>۲</span>
            </div>
            {error && <p className="ws-error" role="alert">{error}</p>}
            {newPlanStep===1 ? (
              <div style={{display:"grid", gap:12}}>
                <div className="ws-date-picker">
                  <label>شروع برنامه
                    <JalaliDateInput required value={weekStart} onChange={(e)=> setWeekStart(e.target.value)} />
                    <small>{formatJalaliShort(weekStart)} — تا {formatJalaliShort(addDaysISO(weekStart,6))}</small>
                  </label>
                  <div className="ws-date-quick">
                    <button type="button" onClick={()=> setWeekStart(tehranTodayISO())}>امروز — {formatJalaliShort(tehranTodayISO())}</button>
                    <button type="button" onClick={()=> setWeekStart(tehranTomorrowISO())}>فردا — {formatJalaliShort(tehranTomorrowISO())}</button>
                  </div>
                </div>
                <label style={{display:"grid",gap:".3rem",fontSize:".82rem"}}>عنوان (اختیاری)<input value={title} onChange={(e)=> setTitle(e.target.value)} placeholder={planTitleSuggestion(weekStart, addDaysISO(weekStart,6))} /></label>
                <div style={{display:"grid", gap:8}}>
                  <strong style={{fontSize:12}}>نوع برنامه</strong>
                  <button type="button" className={`ws-choice-card ${applyFixedChoice==="apply"?"is-selected":""}`} onClick={()=>setApplyFixedChoice("apply")}><b>◧</b><span><strong style={{fontSize:13}}>با موارد ثابت</strong><small style={{color:"#706578"}}>مدرسه و کلاس‌ها خودکار به برنامه اضافه می‌شود</small></span></button>
                  <button type="button" className={`ws-choice-card ${applyFixedChoice==="empty"?"is-selected":""}`} onClick={()=>setApplyFixedChoice("empty")}><b>◫</b><span><strong style={{fontSize:13}}>برنامه خالی</strong><small style={{color:"#706578"}}>بدون باکس ثابت — بعداً خودت بچین</small></span></button>
                </div>
                <div style={{display:"flex", gap:8, justifyContent:"end"}}>
                  <button type="button" className="ws-subtle" onClick={()=> { setShowNewPlan(false); setNewPlanStep(1); }}>انصراف</button>
                  <button type="button" className="ws-primary" onClick={event=>{ const input=event.currentTarget.closest('[role="dialog"]')?.querySelector<HTMLInputElement>('input'); if(input?.reportValidity()) setNewPlanStep(2); }}>ادامه — انتخاب روزهای آزمون</button>
                </div>
              </div>
            ) : (
              <form onSubmit={createPlan} style={{display:"grid",gap:12}}>
                <div>
                  <strong style={{fontSize:13}}>دانش‌آموز چه روزهایی آزمون/کوییز دارد؟</strong>
                  <p style={{fontSize:11, color:"#706578", margin:"4px 0 8px"}}>روزها را انتخاب کن — روی خودِ روز در برنامه «امتحان داره» و علامت باکس آمادگی نمایش داده می‌شود.</p>
                  <div className="ws-exam-grid" style={{display:"grid", gridTemplateColumns:"repeat(4, minmax(0,1fr))", gap:8}}>
                    {sevenDayRange(weekStart).map(iso=>{ const label=weekdayFa(iso); const active=newExamDates.includes(iso); return <button key={iso} type="button" onClick={()=> setNewExamDates(v=> active? v.filter(x=>x!==iso): [...v, iso])} className={active?"is-active":""} style={{display:"grid", gap:4, padding:"10px 8px", borderRadius:10, border: active?"1px solid #5B0FAD":"1px solid #e7e1ec", background: active?"#f6f1fb":"white", color: active?"#5B0FAD":"#16041E"}}><span style={{fontSize:11, fontWeight:700}}>{label}</span><span style={{fontSize:11}}>{formatJalaliShort(iso)}</span></button>; })}
                  </div>
                  {newExamDates.length>0 && <p style={{fontSize:11, color:"#5B0FAD", background:"#f6f1fb", border:"1px solid #e7e1ec", borderRadius:8, padding:"6px 8px", marginTop:8}}>{newExamDates.length} روز انتخاب شد — بعد از ساخت، هر روز گوشه کادر و بالای روز «امتحان داره» دارد و تا باکس آمادگی نگذاری، برچسب هشدار می‌ماند.</p>}
                </div>
                <div style={{display:"flex", gap:8, justifyContent:"space-between"}}>
                  <button type="button" className="ws-subtle" onClick={()=> setNewPlanStep(1)}>بازگشت</button>
                  <div style={{display:"flex", gap:8}}>
                    <button type="button" className="ws-subtle" onClick={()=> { setNewExamDates([]); }}>رد شدن</button>
                    <button type="submit" disabled={busy} className="ws-primary">{busy ? "در حال ساخت…" : "ساخت برنامه ۷ روزه"}</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {!plan && !loading && <div className="ws-empty"><h2>اولین برنامه هفتگی را بسازید</h2><p>تاریخ شروع را انتخاب کنید و فعالیت‌های هفت روز را بچینید.</p><button className="ws-primary" onClick={() => setShowNewPlan(true)}>ساخت برنامه جدید</button></div>}

      {plan && (
        <>
          {/* Mobile day tabs */}
          <nav className="ws-day-tabs" aria-label="روزهای هفته">
            {days.map((d) => (
              <button key={d} aria-pressed={selectedDay === d} className={selectedDay === d ? "is-active" : ""} onClick={() => setSelectedDay(d)}>{formatJalaliShort(d)}{d === today ? " · امروز" : ""}{examDates.includes(d) ? " · آزمون" : ""}</button>
            ))}
            <button aria-pressed={!selectedDay} className={!selectedDay ? "is-active" : ""} onClick={() => setSelectedDay(null)}>همه روزها</button>
          </nav>

          <TimelineBoard schoolEvents={plan.school_events} examDates={plan.exam_dates || []} dates={days.filter(date => !selectedDay || date === selectedDay)} days={plan.days || []} commitments={activeCommitments} schoolSlots={schoolSlots} pending={new Set([...actionKeys].filter(key => key.startsWith("item:")).map(key => Number(key.split(":")[1])))} copyDate={copySource?.date || null} copyBusy={copyBusy} onCopy={startCopy} onCopyTarget={(date,day) => { void handleCopyTargetClick(date,day); }} onAdd={date => { void addToDay(date); }} onDrop={transfer} onEdit={setEditingItem} onDelete={setDeleteTarget} onDuplicate={item => { void handleDuplicate(item); }} onMoveMenu={(item,date) => { setMoveItem(item); setMoveTarget(date); setMoveTime(item.start_time?.slice(0,5) || "06:00"); setMoveUnscheduled(!item.start_time); }}/>

        </>
      )}

      {quickAddDay && student && plan?.days?.find(day => day.date === quickAddDay) && <WizardAddBox date={quickAddDay} token={token} dayId={plan.days.find(day => day.date === quickAddDay)!.id} ordering={Math.max(-1,...plan.days.find(day => day.date === quickAddDay)!.items.map(item => item.ordering))+1} tree={tree} student={student} onCreated={async item => { await canonicalItem(item); setQuickAddDay(null); }} onError={setError} onCancel={() => setQuickAddDay(null)}/>}
      {deleteTarget && <div className="ws-modal" role="dialog" aria-modal="true" aria-label="حذف فعالیت"><div className="ws-modal-card"><h3>فعالیت حذف شود؟</h3><p>{deleteTarget.title || deleteTarget.subject_name}</p><p>این عمل فعالیت برنامه‌ریزی‌شده را حذف می‌کند.</p><div className="panel-row-actions"><button className="ws-danger" disabled={actionKeys.has(`item:${deleteTarget.id}`)} onClick={() => { void handleDelete(deleteTarget); }}>{actionKeys.has(`item:${deleteTarget.id}`) ? "در حال حذف…" : "حذف"}</button><button onClick={() => setDeleteTarget(null)}>لغو</button></div>{error && <p className="ws-error" role="alert">{error}</p>}</div></div>}
      {editingItem && student && (
        <div className="ws-modal" role="dialog" aria-modal="true" aria-label="ویرایش فعالیت">
          <div className="ws-modal-card">
            <ActivityEditor key={editingItem.id} modal
              token={token}
              student={student!}
              dayId={editingItem.plan_day}
              ordering={editingItem.ordering}
              tree={tree}
              initialItem={editingItem}
              onSaved={async item => { await canonicalItem(item); setEditingItem(null); notify(setNotice, "تغییرات ذخیره شد."); }}
              onError={setError}
              onCancel={() => setEditingItem(null)}
            />
          </div>
        </div>
      )}

      {copyConfirm && (
        <div className="ws-modal" role="dialog" aria-modal="true" aria-label="کپی روز">
          <div className="ws-modal-card">
            <h3>روز «{persianDate(copyConfirm.target.date)}» {copyConfirm.target.items.length} فعالیت دارد</h3>
            <p style={{fontSize:".82rem",color:"#5a6d76"}}>می‌خواهید فعالیت‌های «{copySource ? persianDate(copySource.date) : ""}» را چگونه کپی کنید؟</p>
            <div style={{display:"grid",gap:".5rem"}}>
              <button type="button" className="ws-primary" disabled={copyBusy} onClick={()=> executeCopy(copyConfirm.target, "append")}>افزودن به فعالیت‌های موجود</button>
              <button type="button" style={{border:"1px solid #c0392b",color:"#c0392b",background:"white",borderRadius:".35rem",padding:".45rem .7rem"}} disabled={copyBusy} onClick={()=> { if(window.confirm("جایگزینی باعث حذف فعالیت‌های فعلی روز مقصد می‌شود. ادامه می‌دهید؟ اگر فعالیت‌ها دارای اجرای ثبت‌شده باشند جایگزینی انجام نخواهد شد.")) executeCopy(copyConfirm.target, "replace"); }}>جایگزینی کامل (با تأیید)</button>
              <button type="button" className="ws-subtle" onClick={()=> setCopyConfirm(null)}>انصراف</button>
            </div>
            {error && <p className="ws-error" role="alert">{error}</p>}
            {copyBusy && <span style={{fontSize:".78rem"}}>در حال کپی…</span>}
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
            <label><span>بدون ساعت</span><input type="checkbox" checked={moveUnscheduled} onChange={event => setMoveUnscheduled(event.target.checked)}/></label>
            {!moveUnscheduled && <label>ساعت مقصد<input type="time" step={900} value={moveTime} onChange={event => setMoveTime(event.target.value)}/></label>}
            {error && <p className="ws-error" role="alert">{error}</p>}
            <div className="ws-modal-actions">
              <button disabled={!!moveItem && actionKeys.has(`item:${moveItem.id}`)} onClick={handleMove}>انتقال</button>
              <button className="ws-subtle" onClick={()=> { setMoveItem(null); setMoveTarget(""); }}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
