"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, allPages } from "@/lib/api";
import { Commitment, planningError, Student } from "@/lib/planning";
import { useCounselor } from "../../layout";
import StudentSummary from "../StudentSummary";

export default function CounselorStudentDetail({ id }: { id: string }) {
  const { token } = useCounselor();
  const [student, setStudent] = useState<Student | null>(null);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api<Student>(`/students/${id}/`, token), allPages<Commitment>("/planning/commitments/", token)]).then(([studentData, allCommitments]) => { setStudent(studentData); setCommitments(allCommitments.filter((item) => item.student === studentData.id)); }).catch((reason) => setError(planningError(reason))).finally(() => setLoading(false));
  }, [id, token]);
  return <main className="planning-content"><Link href="/counselor/students">← دانش‌آموزان</Link>{loading && <p>در حال بارگذاری…</p>}<p className="planning-error" role="alert">{error}</p>{student && <><StudentSummary student={student} commitments={commitments}/><Link className="planning-primary" href={`/counselor/students/${id}/planning`}>نوشتن برنامه هفتگی</Link></>}</main>;
}
