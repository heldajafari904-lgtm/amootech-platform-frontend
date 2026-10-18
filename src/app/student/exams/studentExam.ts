export type StudentExam = {
  id: number; title: string; question_count: number | null; question_type: string | null;
  duration_minutes: number | null; status: string; counselor_name?: string | null;
  result_available?: boolean; is_personal_practice?: boolean;
};
export const studentEmptyStates: Record<string, string> = {
  active: "آزمون فعالی ندارید.", practice: "هنوز آزمون تمرینی نساخته‌اید.",
  results: "هنوز نتیجه‌ای ثبت نشده است.", past: "هنوز آزمونی در بخش گذشته ندارید.",
};
export function studentExamInSection(exam: StudentExam, section: string, hasResult: boolean) {
  if (section === "practice") return !!exam.is_personal_practice;
  if (section === "results") return !!exam.result_available || hasResult;
  if (section === "past") return exam.status === "CLOSED" || !!exam.result_available || hasResult;
  return canStartExam(exam, hasResult);
}
export function canStartExam(exam: StudentExam, hasResult: boolean) {
  return exam.status === "PUBLISHED" && !exam.result_available && !hasResult;
}
export async function runExclusive(lock: { current: boolean }, task: () => Promise<void>, keepOnSuccess = false) {
  if (lock.current) return false;
  lock.current = true;
  let success = false;
  try { await task(); success = true; return true; }
  finally { if (!success || !keepOnSuccess) lock.current = false; }
}
export const difficulties = [
  { key: "easy", label: "آسان" }, { key: "medium", label: "متوسط" },
  { key: "hard", label: "سخت" }, { key: "very_hard", label: "خیلی سخت" },
] as const;
export type Difficulty = typeof difficulties[number]["key"];
export type Inventory = Record<Difficulty, number>;
export function validCounts(counts: Record<Difficulty, string>, available: Inventory | null) {
  return available !== null && difficulties.every(({ key }) => counts[key] !== "" && Number.isInteger(Number(counts[key])) && Number(counts[key]) >= 0 && Number(counts[key]) <= available[key]) && difficulties.reduce((sum, { key }) => sum + Number(counts[key]), 0) > 0;
}

export type PracticeFilters = { grade_id: number; course_id: number; question_type: number; chapter_ids: number[]; subject_ids: number[]; object_ids: number[] };
export function practicePayload(filters: PracticeFilters, counts: Record<Difficulty, string>, title: string, duration: number) {
  return {
    grade_external_id: filters.grade_id, course_id: filters.course_id, question_type: filters.question_type,
    chapter_ids: filters.chapter_ids, subject_ids: filters.subject_ids, object_ids: filters.object_ids,
    consider_used_question: false, title: title.trim(), duration_minutes: duration, has_negative_score: false,
    easy_count: Number(counts.easy), medium_count: Number(counts.medium), hard_count: Number(counts.hard), very_hard_count: Number(counts.very_hard),
  };
}
