import type { User } from "@/lib/api";
// apiBlob used via dynamic import in downloadPlanExport

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
  counselor_editable?: boolean;
  edit_lock_reason?: string | null;
};
export type PlanItemExecution = {
  plan_item: number;
  status: "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "PARTIAL" | "NOT_DONE";
  started_at: string | null;
  current_session_started_at: string | null;
  accumulated_seconds: number;
  elapsed_seconds: number;
  completed_at: string | null;
  completion_method: "QUICK" | "TIMER";
};
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
export type PlanDay = { id: number; plan: number; date: string; items: PlanItem[] };
export type AcademicOption = { id: number; name: string; field?: number; subject?: number; chapter?: number };

export const kindLabel: Record<Kind, string> = {
  STUDY: "\u0645\u0637\u0627\u0644\u0639\u0647", TEST: "\u062a\u0633\u062a", REVIEW: "\u0645\u0631\u0648\u0631", EXAM: "\u0622\u0632\u0645\u0648\u0646", EVENT: "\u0631\u0648\u06cc\u062f\u0627\u062f",
};
export const commitmentLabel: Record<Commitment["kind"], string> = {
  SCHOOL: "\u0645\u062f\u0631\u0633\u0647", CLASS: "\u06a9\u0644\u0627\u0633", SPORTS: "\u0648\u0631\u0632\u0634", COMMUTE: "\u0631\u0641\u062a\u200c\u0648\u0622\u0645\u062f", OTHER: "\u0633\u0627\u06cc\u0631",
};

// ----- Central date/time utilities (Gregorian canonical, Jalali presentation, Tehran TZ) -----
const TEHRAN_TZ = "Asia/Tehran";

export function tehranTodayISO(): string {
  // Use Intl to get Tehran date correctly (avoid UTC off-by-one at 23:30 Tehran)
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TEHRAN_TZ }).format(new Date());
  return parts; // YYYY-MM-DD
}

export function tehranTomorrowISO(): string {
  const today = tehranTodayISO();
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function formatJalali(iso: string, withWeekday = true): string {
  const opts: Intl.DateTimeFormatOptions = withWeekday ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "long", year: "numeric" };
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", opts).format(new Date(`${iso}T12:00:00`));
}

export function formatJalaliShort(iso: string): string {
  // e.g. سه‌شنبه ۸ مهر
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00`));
}

export function weekdayFa(iso: string): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" }).format(new Date(`${iso}T12:00:00`));
}

export function persianDate(iso: string) { return formatJalaliShort(iso); }

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

export function sevenDayRange(startISO: string): string[] {
  const out: string[] = [];
  const d = new Date(`${startISO}T12:00:00`);
  for (let i=0;i<7;i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
    d.setDate(d.getDate()+1);
  }
  return out;
}

export function addDaysISO(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate()+delta);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function currentWeekStart() { return tehranTodayISO(); }

export function planTitleSuggestion(startISO: string, endISO: string): string {
  // "برنامه ۸ تا ۱۴ مهر"
  const a = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long" }).format(new Date(`${startISO}T12:00:00`));
  const b = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long" }).format(new Date(`${endISO}T12:00:00`));
  return `برنامه ${a} تا ${b}`;
}

// ----- Timeline geometry (deterministic, centralized) -----
export const PLANNER_START = "06:00";
export const PLANNER_END = "24:00";
export function timeToMinutes(t: string): number {
  const [h,m] = t.split(":").map(Number);
  return h*60+m;
}
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins/60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
export function clampSnap(mins: number, snap=15): number { return Math.round(mins/snap)*snap; }
export function durationToHeight(durationMinutes: number | null, pxPerHour=64): number {
  const mins = durationMinutes ?? 30;
  return Math.max(28, (mins/60)*pxPerHour);
}
export function minutesToTop(startTime: string, pxPerHour=64): number {
  const startMins = timeToMinutes(startTime);
  const base = timeToMinutes(PLANNER_START);
  return Math.max(0, ((startMins - base)/60)*pxPerHour);
}
export function isOverlapping(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(aEnd) > timeToMinutes(bStart);
}
export function freeWindowsForDay(dayDate: string, commitments: Commitment[], items: PlanItem[]): {start:string,end:string}[] {
  // commitments filtered to weekday of dayDate already externally; here just compute free within PLANNER range minus commitments and timed items
  const allBlocks: {s:number,e:number}[] = [];
  for (const c of commitments) if (c.start_time && c.end_time) allBlocks.push({s: timeToMinutes(c.start_time), e: timeToMinutes(c.end_time)});
  for (const it of items) if (it.start_time && it.end_time) allBlocks.push({s: timeToMinutes(it.start_time), e: timeToMinutes(it.end_time)});
  allBlocks.sort((a,b)=>a.s-b.s);
  const res: {start:string,end:string}[] = [];
  let cursor = timeToMinutes(PLANNER_START);
  const end = timeToMinutes(PLANNER_END);
  // merge
  const merged: typeof allBlocks = [];
  for (const b of allBlocks) { if (!merged.length || b.s > merged[merged.length-1].e) merged.push({...b}); else merged[merged.length-1].e = Math.max(merged[merged.length-1].e, b.e); }
  for (const m of merged) {
    if (cursor < m.s) res.push({start: minutesToTime(cursor), end: minutesToTime(m.s)});
    cursor = Math.max(cursor, m.e);
  }
  if (cursor < end) res.push({start: minutesToTime(cursor), end: minutesToTime(end)});
  return res;
}

export function timeText(value: string | null) { return value?.slice(0, 5) || ""; }

export async function downloadPlanExport(planId: number, format: "pdf" | "excel", token: string) {
  const blob = await (await import("@/lib/api")).apiBlob(`/planning/plans/${planId}/export/${format}/`, token);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `plan-${planId}.${format === "pdf" ? "pdf" : "xlsx"}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function planningError(reason: unknown) {
  if (!(reason instanceof Error)) return "خطایی رخ داد.";
  try {
    const data: unknown = JSON.parse(reason.message);
    if (typeof data === "object" && data !== null) {
      const dataRecord = data as Record<string, unknown>;
      const detail = "detail" in dataRecord ? String(dataRecord.detail) : "";
      const code = "code" in dataRecord ? String(dataRecord.code) : "";
      if (/authentication credentials were not provided|token is invalid|token has expired/i.test(detail)) return "نشست شما پایان یافته است. دوباره وارد شوید.";
      if (/permission to perform this action/i.test(detail)) return "اجازه انجام این کار را ندارید.";
      if (/not found|matches the given query/i.test(detail)) return "مورد درخواستی پیدا نشد یا دسترسی ندارید.";
      if (code === "MOVE_CONFLICT" || /تداخل دارد/.test(detail)) return "این زمان با فعالیت دیگری تداخل دارد.";
      if (code === "COMMITMENT_CONFLICT" || /تعهد ثابت/.test(detail)) return "این بازه با کلاس/مدرسه/تعهد ثابت دانش‌آموز تداخل دارد.";
      const labels: Record<string, string> = { student: "دانش‌آموز", counselor: "مشاور", plan: "برنامه", plan_day: "روز", date: "تاریخ", start_date: "شروع", end_date: "پایان", subject: "درس", chapter: "فصل", topic: "مبحث", test_count: "تعداد تست", planned_duration_minutes: "مدت", title: "عنوان", days: "روزها" };
      return Object.entries(dataRecord).map(([field, value]) => `${labels[field] || field}: ${Array.isArray(value) ? (value as unknown[]).join("، ") : String(value)}`).join(" | ");
    }
  } catch { /* plain text */ }
  return (reason as Error).message;
}
