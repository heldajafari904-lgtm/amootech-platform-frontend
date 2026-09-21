"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { persianDate, Plan, planningError, weekDates } from "@/lib/planning";
import { useStudentPlanAuth } from "../layout";
import PlanBlock from "../PlanBlock";

export default function StudentPlanDetail({ id }: { id: string }) {
  const { token } = useStudentPlanAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { api<Plan>(`/planning/plans/${id}/`, token).then(setPlan).catch((reason) => setError(planningError(reason))).finally(() => setLoading(false)); }, [id, token]);
  return <main className="planning-content"><Link href="/student/plans">← همه برنامه‌ها</Link>{loading && <p>در حال بارگذاری…</p>}<p className="planning-error" role="alert">{error}</p>{plan && <><h1>{plan.title || `برنامه هفته ${persianDate(plan.start_date)}`}</h1><p>{persianDate(plan.start_date)} تا {persianDate(plan.end_date)}</p><div className="planning-week planning-week-readonly">{weekDates(plan.start_date, plan.end_date).map((date) => { const day = plan.days?.find((entry) => entry.date === date); return <section className="planning-day" key={date}><header><h2>{persianDate(date)}</h2></header><div className="planning-day-items">{!day?.items.length && <p className="planning-empty">باکسی ثبت نشده است.</p>}{day?.items.map((item) => <PlanBlock key={item.id} item={item}/>)}</div></section>; })}</div></>}</main>;
}
