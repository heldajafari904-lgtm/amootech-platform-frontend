"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PanelSkeleton } from "@/components/counselor/PanelUI";
import { allPages } from "@/lib/api";
import { planningError, Plan, Student, tehranTodayISO } from "@/lib/planning";
import { useCounselor } from "@/lib/counselorContext";

export default function CounselorStudents() {
  const { token } = useCounselor();
  const [query, setQuery] = useState("");
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([allPages<Student>("/students/", token), allPages<Plan>("/planning/plans/", token).catch(() => null)]).then(([studentRows, planRows]) => { setStudents(studentRows); setPlans(planRows); }).catch((reason) => setError(planningError(reason))).finally(() => setLoading(false));
  }, [token]);
  const today = tehranTodayISO();
  const planStates = new Map<number, string>();
  for (const plan of plans || []) { if (plan.status === "PUBLISHED" && plan.start_date <= today && plan.end_date >= today) planStates.set(plan.student, "برنامه جاری منتشرشده"); else if (plan.status === "DRAFT" && !planStates.has(plan.student)) planStates.set(plan.student, "پیش‌نویس برنامه"); }
  const filtered = students.filter(student => `${student.user.first_name} ${student.user.last_name} ${student.user.username} ${student.grade_name || ""} ${student.field_name || ""}`.includes(query.trim()));
  return <main className="planning-content"><div className="panel-page-heading"><div><p className="workspace-eyebrow">فضای کار مشاور</p><h1>دانش‌آموزان من</h1><p>برنامه، گزارش و پیشرفت هر دانش‌آموز را از اینجا دنبال کنید.</p></div>{!loading && !error && <span className="planning-badge">{students.length.toLocaleString("fa-IR")} دانش‌آموز</span>}</div><label className="panel-search">جست‌وجوی دانش‌آموز<input type="search" placeholder="نام، پایه یا رشته" value={query} onChange={event => setQuery(event.target.value)}/></label>{loading && <PanelSkeleton/>}<p className="planning-error" role="alert">{error}</p>{!loading && !error && !filtered.length && <div className="workspace-empty"><h2>{students.length ? "نتیجه‌ای پیدا نشد" : "هنوز دانش‌آموزی ندارید"}</h2><p>{students.length ? "نام، پایه یا رشته دیگری را جست‌وجو کنید." : "پس از اختصاص دانش‌آموز، اطلاعات او در این بخش نمایش داده می‌شود."}</p></div>}<div className="panel-student-list">{filtered.map(student => <article className="panel-student-row" key={student.id}><span className="panel-avatar" aria-hidden="true">{student.user.first_name?.[0] || student.user.username[0]}</span><div><Link href={`/counselor/students/${student.id}`}><strong>{student.user.first_name || student.user.username} {student.user.last_name}</strong></Link><p>{student.grade_name || "پایه نامشخص"} · {student.field_name || "رشته نامشخص"}</p></div>{plans && <span className="planning-status">{planStates.get(student.id) || "بدون برنامه جاری"}</span>}<span className="panel-student-school">{student.school_name || "مدرسه ثبت نشده"}</span><div className="panel-row-actions"><Link className="panel-secondary" href={`/counselor/students/${student.id}`}>مشاهده</Link><Link className="planning-primary" href={`/counselor/students/${student.id}/planning`}>برنامه‌ریزی</Link></div></article>)}</div></main>;
}
