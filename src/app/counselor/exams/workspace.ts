export type CounselorExam = {
  id: number;
  title: string;
  student: number | null;
  student_name: string | null;
  status: string;
  question_count: number | null;
  question_type: string | null;
  manage_url: string | null;
  duration_minutes: number | null;
  has_negative_score?: boolean | null;
  created_at?: string;
  result_available?: boolean;
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
  if (section === "active") return ["DRAFT", "READY", "PUBLISHED"].includes(exam.status);
  if (section === "archive") return exam.status === "CLOSED";
  if (section === "results") return !!exam.result_available || hasResult;
  return true;
}

export function primaryExamAction(exam: CounselorExam) {
  if (exam.status === "DRAFT" && exam.manage_url) return "manage";
  if (exam.status === "READY" && exam.student !== null) return "publish";
  if (exam.status === "PUBLISHED" || exam.status === "CLOSED") return "result";
  return null;
}

export function needsExamAction(exam: CounselorExam, hasLoadedResult: boolean) {
  const action = primaryExamAction(exam);
  return action === "manage" || action === "publish"
    || (exam.status === "PUBLISHED" && !!exam.result_available && !hasLoadedResult);
}
