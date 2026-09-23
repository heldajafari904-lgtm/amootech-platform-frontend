import type { ProgressDay } from "./progress";

export type CounselorPlanItemProgress = {
  id: number;
  date: string;
  kind: "STUDY" | "TEST" | "REVIEW" | "EXAM" | "EVENT";
  title: string;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  planned_minutes: number | null;
  actual_minutes: number | null;
  planned_tests: number | null;
  actual_tests: number | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "PARTIAL" | "NOT_DONE";
  correct: number | null;
  wrong: number | null;
  unanswered: number | null;
};

export type CounselorProgress = {
  today: ProgressDay;
  recent_days: ProgressDay[];
  planned_items: CounselorPlanItemProgress[];
  subject_workload: { name: string; minutes: number }[];
  subjects: import("./reports").ReportSubject[];
  topic_repetition: import("./reports").ReportResponse["topic_repetition"];
};
