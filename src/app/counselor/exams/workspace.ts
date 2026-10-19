import type { ExamSchedule } from "@/components/exams/schedule";

export type CounselorExam = ExamSchedule & {
  id: number;
  updated_at?: string;
  archived_at?: string | null;
  trashed_at?: string | null;
  management_blocked?: boolean;
  provider_exam_id?: string | null;
  creation_mode?: string;
  title: string;
  student: number | null;
  student_name: string | null;
  assignment_count?: number;
  status: string;
  question_count: number | null;
  question_type: string | null;
  manage_url: string | null;
  duration_minutes: number | null;
  has_negative_score?: boolean | null;
  created_at?: string;
  result_available?: boolean;
  question_file_url?: string | null;
  answer_file_url?: string | null;
  key_file_url?: string | null;
};

export type WorkspaceFilters = { student: string; title: string; status: string; questionType: string };
export const emptyFilters: WorkspaceFilters = { student: "", title: "", status: "", questionType: "" };

function normalize(value: string) {
  return value.normalize("NFKC").replaceAll("ي", "ی").replaceAll("ك", "ک").replaceAll("\u200c", " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("fa-IR");
}

export function matchesExamFilters(exam: CounselorExam, filters: WorkspaceFilters) {
  return (!filters.student || String(exam.student) === filters.student)
    && (!filters.status || exam.status === filters.status)
    && (!filters.questionType || String(exam.question_type) === filters.questionType)
    && normalize(exam.title).includes(normalize(filters.title));
}

export function inExamSection(exam: CounselorExam, section: string, hasResult: boolean) {
  if (section === "trash") return !!exam.trashed_at;
  if (exam.trashed_at) return false;
  if (section === "active") return !exam.archived_at && ["DRAFT", "READY", "PUBLISHED"].includes(exam.status);
  if (section === "archive") return !!exam.archived_at || exam.status === "CLOSED";
  if (section === "results") return !!exam.result_available || hasResult;
  return true;
}

export function primaryExamAction(exam: CounselorExam) {
  if (exam.archived_at || exam.trashed_at || exam.management_blocked) return exam.result_available ? "result" : null;
  if (exam.status === "DRAFT" && exam.manage_url) return "manage";
  if (exam.status === "READY" && (exam.student !== null || (exam.assignment_count ?? 0) > 0)) return "publish";
  if (exam.status === "PUBLISHED" || exam.status === "CLOSED") return "result";
  return null;
}

export function needsExamAction(exam: CounselorExam, hasLoadedResult: boolean) {
  if (exam.archived_at || exam.trashed_at || exam.management_blocked) return false;
  const action = primaryExamAction(exam);
  return action === "manage" || action === "publish"
    || (exam.status === "PUBLISHED" && !!exam.result_available && !hasLoadedResult);
}
