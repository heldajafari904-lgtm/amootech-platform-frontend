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
  group_id?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
};

export type SchoolSlot = {
  id: number;
  student: number;
  weekday: number;
  period: number;
  subject_name: string;
  start_time?: string | null;
  end_time?: string | null;
};

export type Kind = "STUDY" | "TEST" | "REVIEW" | "EXAM" | "EVENT";
export type PlanningTaxonomy = { provider: "quiz24"; grade?: number; course?: number; chapter?: number; subject?: number; object?: number; labels?: Partial<Record<"grade" | "course" | "chapter" | "subject" | "object", string>> } | Record<string, never>;
export type PlanItem = {
  taxonomy?: PlanningTaxonomy;
  title_is_custom?: boolean;
  generated_title?: string;
  id: number;
  plan_day: number;
  kind: Kind;
  ordering: number;
  title: string;
  planned_duration_minutes: number | null;
  start_time: string | null;
  end_time: string | null;
  note: string;
  fixed_source_type?: "school_slot" | "commitment" | "event" | "";
  fixed_source_id?: number | null;
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
export type SchoolEventOccurrence = { id: number; date: string; kind: "EXAM" | "QUIZ"; title: string; recurring: boolean; start_time: string | null; end_time: string | null };
export type Plan = {
  school_events?: SchoolEventOccurrence[];
  id: number;
  student: number;
  counselor: number;
  title: string;
  start_date: string;
  end_date: string;
  status: "DRAFT" | "PUBLISHED";
  published_at: string | null;
  exam_dates?: string[];
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

export const weekdayLabels: Record<number, string> = {
  0: "دوشنبه", 1: "سه‌شنبه", 2: "چهارشنبه", 3: "پنجشنبه", 4: "جمعه", 5: "شنبه", 6: "یکشنبه",
};
export const weekdayShort: Record<number, string> = {
  5: "شنبه", 6: "یکشنبه", 0: "دوشنبه", 1: "سه‌شنبه", 2: "چهارشنبه", 3: "پنجشنبه", 4: "جمعه",
};
export const WEEKDAY_ORDER = [5, 6, 0, 1, 2, 3, 4] as const; // Sat..Fri Persian week


// ----- Central date/time utilities (Gregorian canonical, Jalali presentation, Tehran TZ) -----
const TEHRAN_TZ = "Asia/Tehran";

export function tehranTodayISO(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone: TEHRAN_TZ, year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part = (type: string) => parts.find(p=>p.type===type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function tehranTomorrowISO() { return addDaysISO(tehranTodayISO(),1); }
export function civilDate(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==iso) throw new Error('تاریخ معتبر نیست.');
  return date;
}
/** Persisted/API convention: Python weekday, Monday=0, Saturday=5. */
export function weekdayIndex(iso: string) { return (civilDate(iso).getUTCDay()+6)%7; }
export function weekdayFa(iso: string) { return weekdayLabels[weekdayIndex(iso)]; }
export function formatJalali(iso: string, withWeekday = true) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {timeZone:'UTC',year:'numeric',month:'long',day:'numeric', ...(withWeekday?{weekday:'long' as const}:{})}).format(civilDate(iso));
}
export function formatJalaliShort(iso: string) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric'}).format(civilDate(iso));
}
export const persianDate = formatJalaliShort;
/** Timestamp date in Tehran; civil dates are already calendar days. */
export function formatTehranDate(value: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatJalali(value, false);
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {timeZone:TEHRAN_TZ,dateStyle:'medium'}).format(new Date(value));
}
export function formatJalaliDateTime(value: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatJalali(value,false);
  const instant = new Date(value);
  const date = new Intl.DateTimeFormat('fa-IR-u-ca-persian',{timeZone:TEHRAN_TZ,dateStyle:'medium'}).format(instant);
  const time = new Intl.DateTimeFormat('fa-IR',{timeZone:TEHRAN_TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(instant);
  return `${date}، ${time}`;
}
export const formatJalaliDate = formatJalali;
export function addDaysISO(iso: string, delta: number) {
  const d=civilDate(iso); d.setUTCDate(d.getUTCDate()+delta); return d.toISOString().slice(0,10);
}
export function weekDates(start: string, end: string) {
  const result: string[]=[];
  for(let date=start;date<=end && result.length<31;date=addDaysISO(date,1)) result.push(date);
  return result;
}
export function sevenDayRange(start: string) { return Array.from({length:7},(_,i)=>addDaysISO(start,i)); }
export function currentWeekStart() { const today=tehranTodayISO(); return addDaysISO(today,-((weekdayIndex(today)+2)%7)); }

export function planTitleSuggestion(startISO: string, endISO: string): string {
  // "برنامه ۸ تا ۱۴ مهر"
  const a = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", timeZone:"UTC" }).format(civilDate(startISO));
  const b = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", timeZone:"UTC" }).format(civilDate(endISO));
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
  const { apiBlob } = await import("@/lib/api");
  const blob = await apiBlob(`/planning/plans/${planId}/export/${format}/`, token);
  // Guard: server may return tiny JSON error blob
  if (blob.size < 100) {
    const text = await blob.text().catch(() => "");
    if (text.trim().startsWith("{")) {
      try {
        const data = JSON.parse(text);
        throw new Error(data.detail || data.message || "خطا در تولید فایل.");
      } catch {
        throw new Error(text || "خطا در تولید فایل.");
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const ext = format === "pdf" ? "pdf" : "xlsx";
  const filename = `plan-${planId}.${ext}`;
  // Try anchor download (preserves filename); keep click in same microtask
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  // Some browsers require click to be trusted; we are still within user-gesture async chain
  link.click();
  // Fallback: if download attribute ignored, open in new tab
  setTimeout(() => {
    if (link.isConnected) link.remove();
    // If file didn't download (e.g., popup blocker), offer blob URL
    // No auto-open to avoid popup blocker; user sees file downloaded.
  }, 100);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
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

// Prefer the selected draft, then the current week, then the latest draft.
export async function applyStudentFixed(token: string, studentId: number, preferredPlanId?: number) {
  const { api, allPages } = await import("@/lib/api");
  const plans = await allPages<Plan>(`/planning/plans/?student=${studentId}`, token);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const drafts = plans.filter(plan => plan.status === "DRAFT");
  const draft = drafts.find(plan => plan.id === preferredPlanId) || drafts.find(plan => plan.start_date <= today && plan.end_date >= today) || drafts[0];
  if (!draft) throw new Error("برنامه هفتگی پیش‌نویس وجود ندارد؛ ابتدا یک برنامه پیش‌نویس بسازید.");
  const result = await api<{ plan: Plan; created: number; removed: number; skipped: { reason: string }[] }>(`/planning/plans/${draft.id}/apply-fixed/`, token, "POST", {});
  window.dispatchEvent(new CustomEvent("plan:fixed-resynced", { detail: { planId: draft.id, plan: result.plan } }));
  return result;
}
