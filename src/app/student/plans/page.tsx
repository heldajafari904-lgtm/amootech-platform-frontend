"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { allPages } from "@/lib/api";
import { persianDate, Plan, planningError } from "@/lib/planning";
import { useStudentPlanAuth } from "./layout";
import { tehranTodayIso } from "@/lib/reports";

export default function StudentPlans() {
  const { token } = useStudentPlanAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { allPages<Plan>("/planning/plans/", token).then(setPlans).catch((reason) => setError(planningError(reason))).finally(() => setLoading(false)); }, [token]);
  const today = tehranTodayIso();
  const current = plans.find((plan) => plan.start_date <= today && plan.end_date >= today);
  return <main className="planning-content"><h1>برنامه‌های من</h1>{current ? <Link className="planning-primary" href={`/student/plans/${current.id}`}>برنامه امروز و ثبت عملکرد</Link> : <Link className="planning-primary" href={`/student/plans/report/${today}`}>گزارش امروز</Link>}{loading && <p>در حال بارگذاری…</p>}<p className="planning-error" role="alert">{error}</p>{!loading && !error && plans.length === 0 && <p>هنوز برنامه منتشرشده‌ای برای شما وجود ندارد.</p>}{current && <section className="planning-current"><h2>برنامه فعلی</h2><Link href={`/student/plans/${current.id}`}>{current.title || `هفته ${persianDate(current.start_date)}`} ←</Link></section>}<div className="planning-student-grid">{plans.map((plan) => <Link className="planning-card" href={`/student/plans/${plan.id}`} key={plan.id}><strong>{plan.title || `هفته ${persianDate(plan.start_date)}`}</strong><span>{persianDate(plan.start_date)} تا {persianDate(plan.end_date)}</span><span className="planning-status is-published">منتشرشده</span></Link>)}</div></main>;
}
