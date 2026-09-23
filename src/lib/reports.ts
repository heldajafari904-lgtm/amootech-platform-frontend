export type ReportMetric = "all" | "study" | "tests" | "plan";
export function tehranTodayIso() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const find = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${find("year")}-${find("month")}-${find("day")}`;
}
export function daysAgoIso(iso: string, count: number) {
  const value = new Date(`${iso}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - count);
  return value.toISOString().slice(0, 10);
}
export type ReportSubject = {
  id: number; name: string; planned_minutes: number; actual_minutes: number;
  planned_tests: number; actual_tests: number; wrong_tests: number | null;
  completed: number; incomplete: number; extra_minutes: number; extra_activities: number;
  distribution_percent: number; completion_percent: number | null;
  completed_items: ReportBlock[]; incomplete_items: ReportBlock[];
  extra_items: { id: number; title: string; resource: string; actual_minutes: number | null }[];
};
export type ReportBlock = { id: number; title: string; planned_minutes: number | null; actual_minutes: number | null; status: string };
export type ReportResponse = {
  start_date: string; end_date: string; metric: ReportMetric;
  summary: { planned_minutes: number; actual_minutes: number; planned_tests: number; actual_tests: number;
    completed_blocks: number; planned_blocks: number; completion_percent: number | null };
  trend: { date: string; value: number }[];
  days: { date: string; planned_minutes: number; actual_minutes: number; planned_tests: number; actual_tests: number; completed: number; partial: number; not_done: number; remaining: number; planned_blocks: number; completion_percent: number | null; self_rating: number | null; has_report: boolean }[];
  subjects: ReportSubject[];
  topic_repetition: { id: number; subject_id: number | null; name: string; planned: number; actual: number; planned_minutes: number; actual_minutes: number; planned_tests: number; actual_tests: number }[];
};
