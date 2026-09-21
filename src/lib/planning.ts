import type { User } from "@/lib/api";

export type Student = {
  id: number;
  user: User;
  grade: number | null;
  grade_name?: string;
  field: number | null;
  field_name?: string;
  school_name: string;
};

export type Commitment = {
  id: number;
  student: number;
  kind: "SCHOOL" | "CLASS" | "SPORTS" | "COMMUTE" | "OTHER";
  title: string;
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
};

export type Kind = "STUDY" | "TEST" | "REVIEW" | "EXAM" | "EVENT";
export type PlanItem = {
  id: number;
  plan_day: number;
  kind: Kind;
  ordering: number;
  title: string;
  planned_duration_minutes: number | null;
  start_time: string | null;
  end_time: string | null;
  note: string;
  subject: number | null;
  subject_name?: string;
  chapter: number | null;
  chapter_name?: string;
  topic: number | null;
  topic_name?: string;
  test_count: number | null;
};
export type PlanDay = { id: number; plan: number; date: string; items: PlanItem[] };
export type Plan = {
  id: number;
  student: number;
  counselor: number;
  title: string;
  start_date: string;
  end_date: string;
  status: "DRAFT" | "PUBLISHED";
  published_at: string | null;
  days?: PlanDay[];
};
export type AcademicOption = { id: number; name: string; field?: number; subject?: number; chapter?: number };

export const kindLabel: Record<Kind, string> = {
  STUDY: "مطالعه", TEST: "تست", REVIEW: "مرور", EXAM: "آزمون", EVENT: "رویداد",
};
export const commitmentLabel: Record<Commitment["kind"], string> = {
  SCHOOL: "مدرسه", CLASS: "کلاس", SPORTS: "ورزش", COMMUTE: "رفت‌وآمد", OTHER: "سایر",
};

export function persianDate(iso: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00`));
}

export function weekDates(start: string, end: string) {
  const dates: string[] = [];
  const date = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (date <= last && dates.length < 31) {
    dates.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`);
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

export function currentWeekStart() {
  const date = new Date();
  date.setDate(date.getDate() - ((date.getDay() + 1) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function timeText(value: string | null) { return value?.slice(0, 5) || ""; }

export function planningError(reason: unknown) {
  if (!(reason instanceof Error)) return "خطایی رخ داد.";
  try {
    const data: unknown = JSON.parse(reason.message);
    if (typeof data === "object" && data !== null) {
      const detail = "detail" in data ? String(data.detail) : "";
      if (/authentication credentials were not provided|token is invalid|token has expired/i.test(detail)) return "نشست شما پایان یافته است. دوباره وارد شوید.";
      if (/permission to perform this action/i.test(detail)) return "اجازه انجام این کار را ندارید.";
      if (/not found|matches the given query/i.test(detail)) return "مورد درخواستی پیدا نشد یا دسترسی ندارید.";
      const labels: Record<string, string> = { student: "دانش‌آموز", counselor: "مشاور", plan: "برنامه", plan_day: "روز", date: "تاریخ", start_date: "شروع", end_date: "پایان", subject: "درس", chapter: "فصل", topic: "مبحث", test_count: "تعداد تست", planned_duration_minutes: "مدت", title: "عنوان", days: "روزها" };
      return Object.entries(data).map(([field, value]) => `${labels[field] || field}: ${Array.isArray(value) ? value.join("، ") : String(value)}`).join(" | ");
    }
  } catch { /* The error was plain text. */ }
  return reason.message;
}
