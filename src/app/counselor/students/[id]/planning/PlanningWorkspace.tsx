"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, allPages } from "@/lib/api";
import {
  addDaysISO,
  Commitment,
  downloadPlanExport,
  formatJalaliShort,
  persianDate,
  Plan,
  PlanDay,
  PlanItem,
  planningError,
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
function apiErrorMessage(reason: unknown): string {
  const msg = planningError(reason);
  if (msg.includes("permission") || msg.includes("اجازه")) return "اجازه ویرایش این برنامه را ندارید.";
  if (msg.includes("past") || msg.includes("گذشته")) return "این فعالیت خارج از بازه برنامه است.";
  if (msg.includes("Date must be within")) return "این فعالیت خارج از بازه برنامه است.";
  return msg;
}

// ---- Student Header ----
function toFa(s: string): string { return s.replace(/[0-9]/g, (d: string) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]); }

function StudentPlanningHeader({
  student,
  plan,
  counselorName,
  metrics,
}: {
  student: Student;
  plan: Plan | null;
  counselorName: string;
  metrics: { plannedMinutes: number; actualMinutes: number; plannedTests: number; actualTests: number; completion: number | null } | null;
}) {
  const stats = plan ? (()=>{ const items=(plan.days||[]).flatMap(d=>d.items); const mins=items.reduce((a,i)=>a+(i.planned_duration_minutes||0),0); const tests=items.reduce((a,i)=>a+(i.test_count||0),0); const h=Math.floor(mins/60), m=mins%60; return {mins,h,m,tests,count:items.length}; })() : null;
  // perDay handled by TopChart
  const am = metrics?.actualMinutes;
  const at = metrics?.actualTests;
  const comp = metrics?.completion;
  const plannedLabel = stats ? `${toFa(String(stats.h))}:${toFa(String(stats.m).padStart(2,"0"))}` : "—";
  const actualLabel = am!=null && am>0 ? `${toFa(String(Math.floor(am/60)))}:${toFa(String(am%60).padStart(2,"0"))}` : null;
  return (
    <div className="ws-top-right">
      <div className="ws-hero-top">
        <div className="ws-hero-student">
          <div className="ws-hero-avatar">{(student.user.first_name?.[0] || student.user.username[0] || "?").toUpperCase()}</div>
          <div>
            <div className="ws-hero-name">{student.user.first_name} {student.user.last_name}</div>
            <div className="ws-hero-meta">{student.grade_name || "پایه نامشخص"} · {student.field_name || "رشته نامشخص"} · مشاور: {counselorName}</div>
          </div>
        </div>
        {plan && <span className="ws-hero-week">{plan.title || `${persianDate(plan.start_date)} تا ${persianDate(plan.end_date)}`}</span>}
      </div>
      <div className="ws-hero-stats" aria-label="شاخص‌های برنامه">
        <span>برنامه <strong>{plannedLabel}</strong></span>
        {actualLabel ? <span>اجرا <strong>{actualLabel}</strong></span> : stats ? <span>برنامه <strong>{plannedLabel}</strong></span> : null}
        <span>تست <strong>{stats ? toFa(String(stats.tests)) : "—"}</strong>{at!=null && at!==stats?.tests ? ` / واقعی ${toFa(String(at))}` : ""}</span>
        {comp!=null ? <span>تکمیل <strong>{toFa(String(comp))}٪</strong></span> : null}
        {stats && <span className={`ws-status ${plan!.status === "PUBLISHED" ? "is-published" : ""}`}>{plan!.status === "DRAFT" ? "پیش‌نویس" : "منتشرشده"}</span>}
      </div>
    </div>
  );
}

function TopChart({ plan }: { plan: Plan | null }) {
  const perDay = plan ? (plan.days||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)).map(d=> ({date:d.date, mins: d.items.reduce((a,i)=>a+(i.planned_duration_minutes||0),0), tests: d.items.reduce((a,i)=>a+(i.test_count||0),0)})) : [];
  const [tab,setTab] = useState<"study"|"test">("study");
  if (!plan || perDay.length===0) return null;
  const maxMins = Math.max(1, ...perDay.map(d=>d.mins));
  const maxTests = Math.max(1, ...perDay.map(d=>d.tests));
  return (
    <div className="ws-top-left">
      <div className="ws-top-chart" aria-label="نمودار هفتگی">
        <div className="ws-top-chart-head">
          <span className="ws-top-chart-title">روند هفته</span>
          <div className="ws-top-chart-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab==="study"} className={tab==="study"?"is-active":""} onClick={()=>setTab("study")}>مطالعه</button>
            <button type="button" role="tab" aria-selected={tab==="test"} className={tab==="test"?"is-active":""} onClick={()=>setTab("test")}>تست</button>
          </div>
        </div>
        <div className="ws-mini-chart">
          {perDay.map(d=> {
            const val = tab==="study" ? d.mins : d.tests;
            const max = tab==="study" ? maxMins : maxTests;
            return (
              <div key={d.date} className="ws-mini-bar">
                <div className="ws-mini-bar-track">
                  <span style={{height: `${Math.max(4, (val/max)*100)}%`, background: tab==="study"?"#0e6477":"#2a9d8f"}} />
                </div>
                <span className="ws-mini-bar-value">{tab==="study" ? toFa(String(Math.round(val/6)/10)) : toFa(String(val))}</span>
                <span className="ws-mini-bar-label">{formatJalaliShort(d.date).split(" ")[0].slice(0,3)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- Metrics Bar (kept for compatibility, not rendered) ----
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

function WizardAddBox({ token, dayId, ordering, tree, onCreated, onError, onCancel }: { token: string; dayId: number; ordering: number; tree: AcademicTree; onCreated: () => void; onError:(m:string)=>void; onCancel:()=>void }) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<PlanItem["kind"] | null>(null);
  const [subject, setSubject] = useState<string>("");
  const [chapter, setChapter] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
  const [duration, setDuration] = useState<string>("60");
  const [testCount, setTestCount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const chapters = subject ? tree.chapters.filter(c=> String(c.subject)===subject) : [];
  const topics = chapter ? tree.topics.filter(t=> String(t.chapter)===chapter) : [];
  // Dynamic steps: kind -> subject (if academic) -> chapter/topic -> duration -> testCount (if TEST) -> confirm
  // Build step list
  const steps: {key:string; optional?:boolean}[] = [];
  steps.push({key:"kind"});
  if (kind && kind!=="EVENT") steps.push({key:"subject"});
  if (kind && kind!=="EVENT" && subject && chapters.length>0) steps.push({key:"chapter", optional: true});
  if (kind && kind!=="EVENT" && chapter && topics.length>0) steps.push({key:"topic", optional: true});
  steps.push({key:"duration"});
  if (kind==="TEST") steps.push({key:"testCount"});
  steps.push({key:"confirm"});
  const cur = steps[step]?.key;
  const total = steps.length;
  const progress = ((step+1)/total)*100;

  function next(){ if(step < total-1) setStep(s=>s+1); }
  function prev(){ if(step>0) setStep(s=>s-1); }

  async function create(){
    if(busy) return;
    setBusy(true);
    const payload: Record<string, unknown> = {
      plan_day: dayId, kind: kind!, ordering, title: "", planned_duration_minutes: duration ? Number(duration):null, start_time: null, end_time: null, note: note || "",
      subject: subject ? Number(subject):null, chapter: chapter ? Number(chapter):null, topic: topic ? Number(topic):null,
      test_count: kind==="TEST" ? (testCount ? Number(testCount):null) : null,
    };
    try { await api("/planning/items/", token, "POST", payload); onCreated(); } catch(reason){ onError(apiErrorMessage(reason)); } finally { setBusy(false); }
  }

  // Keyboard support
  function handleKey(e: React.KeyboardEvent){ if(e.key==="Escape") onCancel(); }

  return (
    <div className="ws-wizard" role="dialog" aria-modal="true" onKeyDown={handleKey} onClick={onCancel}>
      <div className="ws-wizard-card" onClick={e=>e.stopPropagation()}>
        <div className="ws-wizard-head">
          <span className="ws-wizard-step">مرحله {step+1} از {total}</span>
          <button type="button" className="ws-subtle" onClick={onCancel}>✕</button>
        </div>
        <div className="ws-wizard-progress"><span style={{width: `${progress}%`}} /></div>

        {cur==="kind" && (
          <div className="ws-wizard-options" aria-label="نوع باکس">
            <p className="ws-wizard-title">نوع باکس را انتخاب کن</p>
            {(["STUDY","TEST","REVIEW","EXAM","EVENT"] as const).map(k=> (
              <button key={k} type="button" className={`ws-wizard-option ${kind===k?"is-selected":""}`} onClick={()=>{ setKind(k); setTimeout(next,120); }}>{k==="STUDY"?"مطالعه":k==="TEST"?"تست":k==="REVIEW"?"مرور":k==="EXAM"?"آزمون":"سایر"}</button>
            ))}
          </div>
        )}

        {cur==="subject" && (
          <div className="ws-wizard-options">
            <p className="ws-wizard-title">درس را انتخاب کن</p>
            {tree.subjects.length===0 ? <p className="ws-empty-text">درسی یافت نشد</p> : tree.subjects.map(s=> (
              <button key={s.id} type="button" className={`ws-wizard-option ${subject===String(s.id)?"is-selected":""}`} onClick={()=>{ setSubject(String(s.id)); setChapter(""); setTopic(""); setTimeout(next,120); }}>{s.name}</button>
            ))}
            <button type="button" className="ws-wizard-skip" onClick={next}>رد شدن</button>
          </div>
        )}

        {cur==="chapter" && (
          <div className="ws-wizard-options">
            <p className="ws-wizard-title">فصل / مبحث</p>
            {chapters.map(c=> (
              <button key={c.id} type="button" className={`ws-wizard-option ${chapter===String(c.id)?"is-selected":""}`} onClick={()=>{ setChapter(String(c.id)); setTopic(""); setTimeout(next,120); }}>{c.name}</button>
            ))}
            <button type="button" className="ws-wizard-skip" onClick={()=>{ setChapter(""); next(); }}>رد شدن</button>
          </div>
        )}

        {cur==="topic" && (
          <div className="ws-wizard-options">
            <p className="ws-wizard-title">ریز مبحث</p>
            {topics.map(topicItem=> (
              <button key={topicItem.id} type="button" className={`ws-wizard-option ${topic===String(topicItem.id)?"is-selected":""}`} onClick={()=>{ setTopic(String(topicItem.id)); setTimeout(next,120); }}>{topicItem.name}</button>
            ))}
            <button type="button" className="ws-wizard-skip" onClick={()=>{ setTopic(""); next(); }}>رد شدن</button>
          </div>
        )}

        {cur==="duration" && (
          <div className="ws-wizard-options">
            <p className="ws-wizard-title">مدت زمان</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:".4rem"}}>
              {["30","45","60","90","120"].map(v=> (
                <button key={v} type="button" className={`ws-wizard-option ${duration===v?"is-selected":""}`} style={{flex:"1 1 4rem"}} onClick={()=>{ setDuration(v); setTimeout(next,120); }}>{v} دقیقه</button>
              ))}
            </div>
            <label style={{display:"grid",gap:".25rem",fontSize:".78rem"}}>دلخواه<input type="number" min={5} value={duration} onChange={e=>setDuration(e.target.value)} /></label>
            <button type="button" className="ws-link" onClick={next}>ادامه</button>
          </div>
        )}

        {cur==="testCount" && (
          <div className="ws-wizard-options">
            <p className="ws-wizard-title">تعداد تست</p>
            {["5","10","20","30","50"].map(v=> (
              <button key={v} type="button" className={`ws-wizard-option ${testCount===v?"is-selected":""}`} onClick={()=>{ setTestCount(v); setTimeout(next,120); }}>{v} تست</button>
            ))}
            <label style={{display:"grid",gap:".25rem"}}>دلخواه<input type="number" min={1} value={testCount} onChange={e=>setTestCount(e.target.value)} /></label>
            <button type="button" className="ws-wizard-skip" onClick={()=>{ setTestCount(""); next(); }}>رد شدن</button>
          </div>
        )}

        {cur==="confirm" && (
          <div className="ws-wizard-options">
            <p className="ws-wizard-title">بازبینی کوتاه</p>
            <div className="ws-wizard-preview">
              <span>{kind==="STUDY"?"مطالعه":kind==="TEST"?"تست":kind==="REVIEW"?"مرور":kind==="EXAM"?"آزمون":"رویداد"} {subject ? `— ${tree.subjects.find(s=>String(s.id)===subject)?.name || ""}` : ""}</span>
              {chapter && <span>فصل: {chapters.find(c=>String(c.id)===chapter)?.name}</span>}
              <span>{duration} دقیقه {testCount ? `· ${testCount} تست` : ""}</span>
            </div>
            <label style={{display:"grid",gap:".2rem",fontSize:".78rem"}}>توضیحات (اختیاری، بعداً هم قابل افزودن است)<textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="مثلاً صفحات یا نکته" /></label>
            <div className="ws-wizard-actions">
              <button type="button" disabled={busy || !kind} onClick={create} className="ws-primary">{busy ? "در حال ثبت…" : "ثبت باکس"}</button>
              <button type="button" className="ws-wizard-skip" onClick={prev}>بازگشت</button>
            </div>
          </div>
        )}

        {cur!=="kind" && cur!=="confirm" && (
          <div className="ws-wizard-actions">
            <button type="button" className="ws-wizard-skip" onClick={prev}>بازگشت</button>
            {steps[step]?.optional && <button type="button" className="ws-wizard-skip" onClick={next}>رد شدن</button>}
          </div>
        )}
      </div>
    </div>
  );
}

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
function toFaDigits(s: string): string { return s.replace(/[0-9]/g, (d: string) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]); }
function formatDuration(mins: number | null): string { if(!mins) return ""; const h=Math.floor(mins/60), m=mins%60; return m? `${toFaDigits(String(h))}:${toFaDigits(String(m).padStart(2,"0"))}` : `${toFaDigits(String(h))}:۰۰`; }

function PlanActivityCard({
  item,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
  onAddNote,
  draggableProps,
}: {
  item: PlanItem;
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onDelete: () => void;
  onAddNote: () => void;
  draggableProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const kindClass = `ws-box ws-box-${item.kind.toLowerCase()}`;
  const title = item.title || item.subject_name || "—";
  const sub = (item.chapter_name || item.topic_name) ? [item.chapter_name, item.topic_name].filter(Boolean).join(" › ") : (item.subject_name && item.title ? item.subject_name : "");
  return (
    <article className={kindClass} draggable {...draggableProps} data-item-id={item.id}>
      <div className="ws-box-head">
        <span className="ws-box-kind">{item.kind === "STUDY" ? "مطالعه" : item.kind === "TEST" ? "تست" : item.kind === "REVIEW" ? "مرور" : item.kind === "EXAM" ? "آزمون" : "رویداد"}</span>
        {item.start_time && item.end_time && <span className="ws-box-time">{toFaDigits(item.start_time.slice(0,5))}–{toFaDigits(item.end_time.slice(0,5))}</span>}
      </div>
      <strong className="ws-box-title" title={title}>{title}</strong>
      {sub && <span className="ws-box-sub" title={sub}>{sub}</span>}
      <span className="ws-box-meta">{item.planned_duration_minutes ? formatDuration(item.planned_duration_minutes) : ""}{item.test_count ? ` · ${toFaDigits(String(item.test_count))} تست` : ""}</span>
      <div className="ws-box-actions">
        <button type="button" aria-label="ویرایش" onClick={onEdit}>✎</button>
        <button type="button" aria-label="کپی" onClick={onDuplicate}>⧉</button>
        <button type="button" aria-label="افزودن توضیحات" onClick={onAddNote}>＋</button>
        <details className="ws-more">
          <summary aria-label="بیشتر">⋯</summary>
          <button type="button" onClick={onMove}>جابه‌جایی</button>
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
  const [weekStart, setWeekStart] = useState(tehranTodayISO);
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
  const today = tehranTodayISO();
  const [mode, setMode] = useState<"day"|"week">("day"); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [activeDay, setActiveDay] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showBacklog, setShowBacklog] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showContext, setShowContext] = useState(true);
  const [commitments, setCommitments] = useState<Commitment[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [copySource, setCopySource] = useState<PlanDay | null>(null);
  const [copyConfirm, setCopyConfirm] = useState<{target: PlanDay, mode: "append"|"replace"} | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);

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
        // fetch fixed commitments for timeline
        api<Commitment[]>(`/planning/commitments/?student=${s.id}`, token).then((cs)=>{ if(live) setCommitments(cs.filter(c=>c.active)); }).catch(()=>{});
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

  // sync activeDay to first day of plan
  useEffect(() => {
    if (plan && plan.days && plan.days.length && !activeDay) {
      const sorted = [...plan.days].sort((a,b)=> a.date.localeCompare(b.date));
      queueMicrotask(()=> setActiveDay(sorted[0].date));
    }
  }, [plan, activeDay]);

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
      const effectiveTitle = title.trim() || planTitleSuggestion(weekStart, endDate);
      const created = await api<Plan>("/planning/plans/", token, "POST", { student: student.id, start_date: weekStart, end_date: endDate, title: effectiveTitle });
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
      await api(`/planning/items/${moveItem.id}/move/`, token, "POST", { target_day: targetDay!.id, start_time: moveItem.start_time || undefined });
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

  // Copy Day handlers — قانون اصلی: تمام ۷ روز همیشه فعال، کپی از هر روز به هر ۶ روز دیگر با یک کلیک (append) بدون تایید دوم
  function startCopy(day: PlanDay){ setCopySource(day); setCopyConfirm(null); setError(""); notify(setNotice, "روز مقصد را انتخاب کنید — روی کادر هر روز دیگری کلیک کنید تا فوراً کپی شود"); }
  function cancelCopy(){ setCopySource(null); setCopyConfirm(null); }
  async function executeCopy(target: PlanDay, mode: "append"|"replace"){
    if(!copySource) return;
    setCopyBusy(true); setError("");
    try {
      await api(`/planning/days/${copySource.id}/copy-day/`, token, "POST", { target_day: target.id, mode });
      await refresh();
      notify(setNotice, "برنامه با موفقیت کپی شد");
      setCopySource(null); setCopyConfirm(null);
    } catch(reason: unknown){
      const msg = planningError(reason);
      setError(msg);
    } finally { setCopyBusy(false); }
  }
  // کلیک روی کادر روز مقصد → فوراً append کپی (بدون مودال). برای روز خالی ابتدا PlanDay ساخته می‌شود.
  async function handleCopyTargetClick(date: string, existingDay?: PlanDay | null){
    if(!copySource || copyBusy) return;
    if(existingDay && copySource.id === existingDay.id) return;
    // اگر همان تاریخ مبدأ باشد کپی نکن
    if(copySource.date === date) return;
    let target = existingDay || null;
    if(!target){
      const created = await ensureDay(date);
      if(!created) { setError("ساخت روز مقصد ناموفق بود."); return; }
      target = created;
    }
    // بدون پرسش جایگزینی — همیشه append فوری طبق الزام محصول
    await executeCopy(target, "append");
  }
  // Escape to cancel copy
  useEffect(()=>{
    if(!copySource) return;
    function onKey(e: KeyboardEvent){ if(e.key==="Escape") cancelCopy(); }
    window.addEventListener("keydown", onKey);
    return ()=> window.removeEventListener("keydown", onKey);
  }, [copySource]);

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



  const [showNewPlan, setShowNewPlan] = useState(false);
  // open modal if ?new=1
  useEffect(()=>{
    const q=new URLSearchParams(window.location.search);
    if(q.get("new")==="1") queueMicrotask(()=> setShowNewPlan(true));
  },[]);
  // reuse MetricsBar data as metrics prop (lifted via state)
  const [topMetrics, setTopMetrics] = useState<{plannedMinutes:number; actualMinutes:number; plannedTests:number; actualTests:number; completion:number|null}|null>(null);
  // mirror MetricsBar fetch into topMetrics (lightweight)
  useEffect(()=>{
    if(!plan?.id){ queueMicrotask(()=> setTopMetrics(null)); return; }
    const plannedMinutes=(plan.days||[]).flatMap(d=>d.items).reduce((a,i)=>a+(i.planned_duration_minutes||0),0);
    const plannedTests=(plan.days||[]).flatMap(d=>d.items).reduce((a,i)=>a+(i.test_count||0),0);
    let live=true;
    api<unknown>(`/counselor/students/${plan.student}/progress/?start_date=${plan.start_date}&end_date=${plan.end_date}`, token).then((res: unknown)=>{
      if(!live) return;
      const r=res as {planned_items?:{actual_minutes:number|null; actual_tests:number|null; status:string}[]};
      if(r && Array.isArray(r.planned_items)){
        const actualMinutes=r.planned_items.reduce((a:number,it:{actual_minutes:number|null})=>a+(it.actual_minutes||0),0);
        const actualTests=r.planned_items.reduce((a:number,it:{actual_tests:number|null})=>a+(it.actual_tests||0),0);
        const comp = r.planned_items.length ? Math.round(r.planned_items.filter((it:{status:string})=>it.status==="COMPLETED").length*100/r.planned_items.length) : null;
        setTopMetrics({plannedMinutes, actualMinutes, plannedTests, actualTests, completion: comp});
      } else setTopMetrics({plannedMinutes, actualMinutes:0, plannedTests, actualTests:0, completion:null});
    }).catch(()=>{ if(live) setTopMetrics({plannedMinutes, actualMinutes:0, plannedTests, actualTests:0, completion:null});});
    return()=>{live=false;};
  },[plan, token]);

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
            <div className="ws-toolbar-actions">
              {plan && <><button type="button" onClick={async()=>{ try{ await downloadPlanExport(plan.id,"excel",token);}catch(r){ setError(apiErrorMessage(r));}}}>Excel</button><button type="button" onClick={async()=>{ try{ await downloadPlanExport(plan.id,"pdf",token);}catch(r){ setError(apiErrorMessage(r));}}}>PDF</button></>}
              <button type="button" className="ws-toolbar-new" onClick={()=> setShowNewPlan(true)}>＋ برنامه جدید</button>
            </div>
          </div>
        </section>
      )}
      {copySource && (
        <div className="ws-copy-banner" role="status">
          <span>«{persianDate(copySource.date)}» به‌عنوان مبدأ انتخاب شد — روز مقصد را انتخاب کنید</span>
          <button type="button" className="ws-subtle" onClick={cancelCopy}>لغو کپی (Esc)</button>
        </div>
      )}
      {/* New plan modal (no longer always visible) */}
      {showNewPlan && (
        <div className="ws-modal" role="dialog" aria-modal="true" aria-label="برنامه جدید" onClick={()=> setShowNewPlan(false)}>
          <div className="ws-modal-card" onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <h3 style={{fontSize:".9rem",fontWeight:700}}>برنامه جدید</h3>
              <button type="button" className="ws-subtle" onClick={()=> setShowNewPlan(false)}>✕</button>
            </div>
            <form onSubmit={async(e)=>{ await createPlan(e); setShowNewPlan(false); }} style={{display:"grid",gap:".6rem"}}>
              <div className="ws-date-picker">
                <label>شروع برنامه
                  <input type="date" required value={weekStart} onChange={(e)=> setWeekStart(e.target.value)} />
                  <small>{formatJalaliShort(weekStart)} — تا {formatJalaliShort(addDaysISO(weekStart,6))}</small>
                </label>
                <div className="ws-date-quick">
                  <button type="button" onClick={()=> setWeekStart(tehranTodayISO())}>امروز — {formatJalaliShort(tehranTodayISO())}</button>
                  <button type="button" onClick={()=> setWeekStart(tehranTomorrowISO())}>فردا — {formatJalaliShort(tehranTomorrowISO())}</button>
                </div>
              </div>
              <label style={{display:"grid",gap:".2rem",fontSize:".82rem"}}>عنوان (اختیاری)<input value={title} onChange={(e)=> setTitle(e.target.value)} placeholder={planTitleSuggestion(weekStart, addDaysISO(weekStart,6))} /></label>
              <button type="submit" disabled={busy} className="ws-primary">{busy ? "در حال ساخت…" : "ساخت برنامه ۷ روزه"}</button>
            </form>
          </div>
        </div>
      )}

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

          <div className="ws-stack" aria-label="روزهای هفته">
            {days.filter((d) => !selectedDay || d === selectedDay).map((date) => {
              const day = plan.days?.find((x) => x.date === date);
              const items = day?.items ? [...day.items].sort((a,b)=> a.ordering - b.ordering) : [];
              const mins = items.reduce((a,i)=> a+(i.planned_duration_minutes||0),0);
              const tests = items.reduce((a,i)=> a+(i.test_count||0),0);
              const h=Math.floor(mins/60), m=mins%60;
              const freeHint = ""; // free time computed via commitments if needed
              const isCopySource = !!copySource && copySource.date === date;
              const isCopyTarget = !!copySource && copySource.date !== date;
              return (
                <section
                  key={date}
                  className={`ws-day-row ${date === today ? "is-today" : ""} ${date < today ? "is-past" : ""} ${isCopySource ? "is-copy-source" : ""} ${isCopyTarget ? "is-copy-target" : ""}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { if(day) onDrop(e, day); }}
                  onClick={() => { if(copySource && copySource.date !== date) handleCopyTargetClick(date, day || null); }}
                  style={isCopyTarget ? {cursor:"pointer"} : undefined}
                  aria-disabled={false}
                >
                  <header
                    className="ws-day-row-head"
                    style={isCopyTarget ? {cursor:"pointer"} : undefined}
                  >
                    <div className="ws-day-row-title">
                      {date < today && <span className="ws-badge-past">گذشته</span>}
                      {date === today && <span className="ws-badge-today">امروز</span>}
                      <h3>{persianDate(date)}</h3>
                      <small>{formatJalaliShort(date)}</small>
                    </div>
                    <div className="ws-day-row-summary">
                      <span><b>{toFaDigits(String(items.length))}</b> فعالیت</span>
                      <span><b>{toFaDigits(String(h))}:{toFaDigits(String(m).padStart(2,"0"))}</b> مطالعه</span>
                      <span><b>{toFaDigits(String(tests))}</b> تست</span>
                      {freeHint && <span className="ws-free">{freeHint}</span>}
                    </div>
                    <div style={{display:"flex",gap:".3rem",alignItems:"center"}}>
                      <button
                        type="button"
                        className="ws-copy"
                        aria-label={`کپی ${persianDate(date)}`}
                        disabled={!day || (!!copySource && copySource.date===date)}
                        onClick={(e)=>{ e.stopPropagation(); if(day) startCopy(day); }}
                        title={day ? "کپی این روز به روز دیگر (یک کلیک روی مقصد)" : "روز خالی — چیزی برای کپی ندارد"}
                      >⧉</button>
                      <button
                        type="button"
                        className="ws-add"
                        disabled={false}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!day) {
                            const nd = await ensureDay(date);
                            if (nd) setQuickAddDay(date);
                          } else setQuickAddDay(quickAddDay === date ? null : date);
                        }}
                        aria-label={`افزودن باکس برای ${date}`}
                      >
                        ＋ افزودن باکس
                      </button>
                    </div>
                  </header>

                  <div className="ws-boxes" onDragOver={(e)=>e.preventDefault()} onClick={(e)=>{ if(copySource) e.stopPropagation(); }}>
                    {items.length === 0 ? <span className="ws-boxes-empty">فعالیتی ثبت نشده</span> : items.map((item, idx) => (
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
                          onAddNote={() => setEditingItem(item)}
                        />
                        {item.counselor_editable && items.length > 1 && (
                          <div className="ws-reorder">
                            <button aria-label="بالا" disabled={idx===0} onClick={()=> handleReorder(day!, item.id, idx-1)}>↑</button>
                            <button aria-label="پایین" disabled={idx===items.length-1} onClick={()=> handleReorder(day!, item.id, idx+1)}>↓</button>
                          </div>
                        )}
                      </div>
                    ))}
                    {day && items.length>0 && <div className="ws-drop-end" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=> onDrop(e, day, items.length)}>رها کنید تا به انتها اضافه شود</div>}
                  </div>

                  {quickAddDay === date && tree && day && (
                    <WizardAddBox
                      token={token}
                      dayId={day.id}
                      ordering={items.length}
                      tree={tree}
                      onCreated={async () => { setQuickAddDay(null); await refresh(); notify(setNotice, "باکس ساخته شد."); }}
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
