import type { Kind, Student } from "@/lib/planning";

export type DailyReportItem = {
  id: number;
  plan_item: number | null;
  kind: Kind;
  title: string;
  resource: string;
  note: string;
  start_time: string | null;
  end_time: string | null;
  subject: number | null;
  subject_name: string | null;
  chapter: number | null;
  chapter_name: string | null;
  topic: number | null;
  topic_name: string | null;
  planned_duration_minutes: number | null;
  planned_test_count: number | null;
  actual_duration_minutes: number | null;
  entered_actual_duration_minutes: number | null;
  duration_source: "TIMER" | "MANUAL" | "PLAN" | null;
  actual_test_count: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  unanswered_count: number | null;
  execution_status: "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "PARTIAL" | "NOT_DONE" | "UNPLANNED";
};
export type DailyReport = {
  id: number;
  student: number;
  date: string;
  wake_time: string | null;
  sleep_time: string | null;
  mobile_minutes: number | null;
  self_rating: number | null;
  note: string;
  closed_at: string | null;
  items: DailyReportItem[];
  summary: {
    planned_minutes: number;
    total_actual_minutes: number;
    planned_tests: number;
    total_tests: number;
    completed_plan_items: number;
    partial_plan_items: number;
    not_done_plan_items: number;
    uncompleted_plan_items: number;
    planned_items: number;
    academic_activities: number;
    by_subject: { name: string; minutes: number }[];
  };
};
export type ReportStudent = Pick<Student, "grade" | "grade_name" | "field" | "field_name">;
export const reportStatus: Record<DailyReportItem["execution_status"], string> = {
  NOT_STARTED: "شروع نشده", IN_PROGRESS: "در حال انجام", PAUSED: "توقف موقت",
  COMPLETED: "انجام شد", PARTIAL: "ناقص", NOT_DONE: "انجام نشد", UNPLANNED: "خارج از برنامه",
};
export function minutesText(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours} ساعت${minutes ? ` و ${minutes} دقیقه` : ""}` : `${minutes} دقیقه`;
}
