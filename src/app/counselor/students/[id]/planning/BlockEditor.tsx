"use client";

import { useEffect, useState } from "react";
import { fetchAcademicTree, type AcademicTree } from "@/lib/academicTree";
import type { PlanItem, Student } from "@/lib/planning";
import ActivityEditor from "./ActivityEditor";

// Legacy builder uses the same content/title contract as the weekly workspace.
export default function BlockEditor({ token, dayId, ordering, student, initial, onSaved, onCancel }: {
  token: string; dayId: number; ordering: number; student: Student; grades: { id: number; name: string }[]; initial?: PlanItem;
  onSaved: () => void; onCancel: () => void;
}) {
  const [tree, setTree] = useState<AcademicTree | null>(null);
  useEffect(() => {
    let live = true;
    fetchAcademicTree(token, { student: String(student.id) }).then(value => { if (live) setTree(value); }).catch(() => {});
    return () => { live = false; };
  }, [token, student.id]);
  return <ActivityEditor key={`${dayId}:${initial?.id ?? 'new'}`} token={token} student={student} dayId={dayId} ordering={ordering} initialItem={initial} tree={tree} onSaved={onSaved} onCancel={onCancel}/>;
}
