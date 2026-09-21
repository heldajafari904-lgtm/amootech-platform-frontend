"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { downloadPlanExport, persianDate, Plan, planningError, weekDates } from "@/lib/planning";
import { useStudentPlanAuth } from "../layout";
import PlanBlock from "../PlanBlock";

export default function StudentPlanDetail({ id }: { id: string }) {
  const { token } = useStudentPlanAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Plan>(`/planning/plans/${id}/`, token).then(setPlan).catch((reason) => setError(planningError(reason))).finally(() => setLoading(false)); }, [id, token]);
  async function exportPlan(format: "pdf" | "excel") {
    if (!plan) return;
    setExporting(format); setError("");
    try { await downloadPlanExport(plan.id, format, token); }
    catch (reason) { setError(planningError(reason)); }
    finally { setExporting(null); }
  }
  return <main className="planning-content"><Link href="/student/plans">← همه برنامه‌ها</Link>{loading && <p>در حال بارگذاری…</p>}<p className="planning-error" role="alert">{error}</p>{plan && <><h1>{plan.title || `برنامه هفته ${persianDate(plan.start_date)}`}</h1><p>{persianDate(plan.start_date)} تا {persianDate(plan.end_date)}</p><div className="planning-actions"><button type="button" onClick={() => exportPlan("pdf")} disabled={exporting !== null}>{exporting === "pdf" ? "در حال دریافت…" : "دریافت PDF"}</button><button type="button" onClick={() => exportPlan("excel")} disabled={exporting !== null}>{exporting === "excel" ? "در حال دریافت…" : "دریافت اکسل"}</button></div><div className="planning-week planning-week-readonly">{weekDates(plan.start_date, plan.end_date).map((date) => { const day = plan.days?.find((entry) => entry.date === date); const timed = day?.items.filter((item) => item.start_time && item.end_time).sort((a, b) => a.start_time!.localeCompare(b.start_time!)) || []; const flexible = day?.items.filter((item) => !item.start_time || !item.end_time) || []; return <section className="planning-day" key={date}><header><h2>{persianDate(date)}</h2></header><div className="planning-day-content"><div className="planning-day-lane"><h3>زمان‌بندی‌شده</h3><div className="planning-timeline">{timed.length ? timed.map((item) => <PlanBlock key={item.id} item={item}/>) : <p className="planning-empty">باکس زمان‌دار ندارد.</p>}</div></div><div className="planning-day-lane planning-flexible"><h3>بدون ساعت مشخص</h3><div className="planning-timeline">{flexible.length ? flexible.map((item) => <PlanBlock key={item.id} item={item}/>) : <p className="planning-empty">باکس انعطاف‌پذیر ندارد.</p>}</div></div></div></section>; })}</div></>}</main>;
}
