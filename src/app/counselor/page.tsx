"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { allPages } from "@/lib/api";
import { useCounselor } from "@/lib/counselorContext";
import { persianDate, tehranTodayISO, type Plan, type Student } from "@/lib/planning";

export default function CounselorHome() {
  const { user, token } = useCounselor();
  const [metrics, setMetrics] = useState<{ students: number; drafts: number; current: number } | null>(null);
  useEffect(() => { let live = true; Promise.all([allPages<Student>("/students/", token), allPages<Plan>("/planning/plans/", token)]).then(([students, plans]) => { const today = tehranTodayISO(); if (live) setMetrics({ students: students.length, drafts: plans.filter(plan => plan.status === "DRAFT").length, current: plans.filter(plan => plan.status === "PUBLISHED" && plan.start_date <= today && plan.end_date >= today).length }); }).catch(() => {}); return () => { live = false; }; }, [token]);
  return <main className="planning-content"><header className="panel-page-heading"><div><p className="workspace-eyebrow">{persianDate(tehranTodayISO())}</p><h1>{user.first_name || user.username}، خوش آمدید</h1><p>از برنامه‌ریزی تا پیگیری عملکرد، فضای کار روزانه شما.</p></div></header>{metrics && <section className="panel-dashboard-metrics" aria-label="وضعیت واقعی فضای مشاور"><Link href="/counselor/students"><small>دانش‌آموزان من</small><strong>{metrics.students.toLocaleString("fa-IR")}</strong><span>مشاهده فهرست</span></Link><Link href="/counselor/students"><small>برنامه‌های پیش‌نویس</small><strong>{metrics.drafts.toLocaleString("fa-IR")}</strong><span>نیازمند تکمیل و انتشار</span></Link><Link href="/counselor/students"><small>برنامه‌های جاری منتشرشده</small><strong>{metrics.current.toLocaleString("fa-IR")}</strong><span>در بازه امروز تهران</span></Link></section>}<section className="panel-welcome"><div><span className="planning-badge">برنامه‌ریزی هفتگی</span><h2>هفته‌ای روشن، مسیر یادگیری مشخص</h2><p>دانش‌آموز را انتخاب کنید، برنامه هفتگی او را بنویسید و گزارش اجرای فعالیت‌ها را دنبال کنید.</p><Link className="planning-primary" href="/counselor/students">مشاهده دانش‌آموزان و شروع برنامه‌ریزی</Link></div><div className="panel-workflow"><div><b>۱</b><span>انتخاب دانش‌آموز<small>اطلاعات تحصیلی و تعهدهای ثابت</small></span></div><div><b>۲</b><span>برنامه‌ریزی هفتگی<small>فعالیت‌ها، بازه دلخواه و انتشار</small></span></div><div><b>۳</b><span>پیگیری عملکرد<small>گزارش روزانه و روند پیشرفت</small></span></div></div></section></main>;
}
