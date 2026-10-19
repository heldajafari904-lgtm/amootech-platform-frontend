export type ExamAvailability = {
  code: "UPCOMING" | "AVAILABLE" | "DEADLINE_PASSED" | "CLOSED" | "UNAVAILABLE" | "ARCHIVED" | "TRASHED";
  label: string; can_start: boolean; results_released: boolean; server_time: string;
};
export type ExamSchedule = {
  scheduled_start_at?: string | null;
  participation_deadline_at?: string | null;
  result_release_at?: string | null;
  availability?: ExamAvailability;
  schedule_locked?: boolean;
};
export type ScheduleInput = { date: string; time: string };
export const scheduleFields = ["scheduled_start_at", "participation_deadline_at", "result_release_at"] as const;
export type ScheduleField = typeof scheduleFields[number];
export type ScheduleDraft = Record<ScheduleField, ScheduleInput>;

export function tehranInput(value?: string | null): ScheduleInput {
  if (!value) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(row => row.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}:${part("second")}` };
}
export function tehranISO({ date, time }: ScheduleInput): string | null {
  if (!date && !time) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) throw new Error("تاریخ و ساعت را کامل وارد کنید.");
  const wall = `${date}T${time.length === 5 ? time + ":00" : time}`;
  const utc = Date.parse(wall + "Z");
  if (!Number.isFinite(utc)) throw new Error("تاریخ یا ساعت معتبر نیست.");
  const offset = new Intl.DateTimeFormat("en", { timeZone: "Asia/Tehran", timeZoneName: "longOffset" }).formatToParts(new Date(utc)).find(row => row.type === "timeZoneName")?.value;
  const match = offset?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) throw new Error("تبدیل منطقه زمانی تهران انجام نشد.");
  const minutes = (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "+" ? 1 : -1);
  const iso = new Date(utc - minutes * 60_000).toISOString();
  const roundtrip = tehranInput(iso);
  if (roundtrip.date !== date || roundtrip.time !== wall.split("T")[1]) throw new Error("تاریخ یا ساعت معتبر نیست.");
  return iso;
}
export function scheduleDraft(exam: ExamSchedule): ScheduleDraft {
  return Object.fromEntries(scheduleFields.map(key => [key, tehranInput(exam[key])])) as ScheduleDraft;
}
export function schedulePayload(draft: ScheduleDraft) {
  return Object.fromEntries(scheduleFields.map(key => [key, tehranISO(draft[key])])) as Record<ScheduleField, string | null>;
}
export function examDateTime(value?: string | null) {
  if (!value) return "تعیین نشده";
  return new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
export function participationMessage(exam: ExamSchedule) {
  if (exam.availability?.code === "UPCOMING") return "آزمون هنوز شروع نشده است.";
  if (exam.availability?.code === "DEADLINE_PASSED") return "مهلت شرکت در آزمون به پایان رسیده است.";
  return exam.availability?.label ?? "";
}
