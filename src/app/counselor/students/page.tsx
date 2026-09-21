"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { allPages } from "@/lib/api";
import { planningError, Student } from "@/lib/planning";
import { useCounselor } from "../layout";

export default function CounselorStudents() {
  const { token } = useCounselor();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    allPages<Student>("/students/", token).then(setStudents).catch((reason) => setError(planningError(reason))).finally(() => setLoading(false));
  }, [token]);
  return <main className="planning-content"><h1>دانش‌آموزان من</h1>{loading && <p>در حال بارگذاری…</p>}<p className="planning-error" role="alert">{error}</p>{!loading && !error && students.length === 0 && <p>هنوز دانش‌آموزی به شما اختصاص داده نشده است.</p>}<div className="planning-student-grid">{students.map((student) => <Link className="planning-card" href={`/counselor/students/${student.id}`} key={student.id}><strong>{student.user.first_name} {student.user.last_name}</strong><span>{student.grade_name || "پایه نامشخص"} · {student.field_name || "رشته نامشخص"}</span><span>{student.school_name || "مدرسه ثبت نشده"}</span></Link>)}</div></main>;
}
