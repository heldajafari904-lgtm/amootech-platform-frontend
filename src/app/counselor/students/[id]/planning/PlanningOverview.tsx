"use client";
import { useState } from "react";
import { sevenDayRange, formatJalaliShort, persianDate, type Plan, type Student } from "@/lib/planning";

// ---- Student Header ----
function toFa(s: string): string { return s.replace(/[0-9]/g, (d: string) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]); }

export function StudentPlanningHeader({
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
        {metrics && <span>عملکرد <strong>{actualLabel || "۰:۰۰"}</strong></span>}
        {stats && <span>فعالیت <strong>{toFa(String(stats.count))}</strong></span>}
        <span>تست <strong>{stats ? toFa(String(stats.tests)) : "—"}</strong>{at!=null && at!==stats?.tests ? ` / واقعی ${toFa(String(at))}` : ""}</span>
        {comp!=null ? <span>تکمیل <strong>{toFa(String(comp))}٪</strong></span> : null}
        {stats && <span className={`ws-status ${plan!.status === "PUBLISHED" ? "is-published" : ""}`}>{plan!.status === "DRAFT" ? "پیش‌نویس" : "منتشرشده"}</span>}
      </div>
    </div>
  );
}

export function TopChart({ plan }: { plan: Plan | null }) {
  const perDay = plan ? sevenDayRange(plan.start_date).map(date => { const items = plan.days?.find(day => day.date === date)?.items || []; return { date, mins: items.reduce((sum, item) => sum + (item.planned_duration_minutes || 0), 0), tests: items.reduce((sum, item) => sum + (item.test_count || 0), 0) }; }) : [];
  const [tab,setTab] = useState<"study"|"test">("study");
  if (!plan || perDay.length===0) return null;
  const maxMins = Math.max(1, ...perDay.map(d=>d.mins));
  const maxTests = Math.max(1, ...perDay.map(d=>d.tests));
  return (
    <div className="ws-top-left">
      <div className="ws-top-chart" aria-label="نمودار هفتگی">
        <div className="ws-top-chart-head">
          <span className="ws-top-chart-title">برنامه هفتگی · {tab === "study" ? "ساعت" : "تست"}</span>
          <div className="ws-top-chart-tabs" role="tablist" aria-label="شاخص نمودار برنامه">
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
                  <span style={{height: `${(val/max)*100}%`, background: tab==="study"?"var(--brand-purple)":"var(--brand-yellow)"}} />
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

