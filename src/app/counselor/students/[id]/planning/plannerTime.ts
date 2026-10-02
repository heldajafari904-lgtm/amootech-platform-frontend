import type { PlanItem, Commitment } from "@/lib/planning";

// The API permits the whole civil day. 24:00 is a ruler boundary, never an API time.
export const PLANNER_START = 0;
export const PLANNER_END = 24 * 60;
export const SNAP_MINUTES = 15;
export const PIXELS_PER_MINUTE = 1.2;
export const MIN_CARD_WIDTH = 190;
export const TIMELINE_WIDTH = (PLANNER_END - PLANNER_START) * PIXELS_PER_MINUTE;
export const LANE_HEIGHT = 220;

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
export function minutesToTime(minutes: number): string {
  const value = Math.round(minutes);
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
export function snapMinutes(minutes: number): number { return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES; }
export function clampTime(minutes: number, duration = 0): number {
  const last = Math.floor((Math.min(PLANNER_END - 1, 1439) - duration) / SNAP_MINUTES) * SNAP_MINUTES;
  return Math.max(PLANNER_START, Math.min(last, snapMinutes(minutes)));
}
export function positionFromTime(minutes: number): number { return (minutes - PLANNER_START) * PIXELS_PER_MINUTE; }
export function durationToWidth(duration: number): number { return Math.max(MIN_CARD_WIDTH, duration * PIXELS_PER_MINUTE); }
export function timeFromClientX(clientX: number, rect: { right: number; width: number }, duration = 0): number {
  // Use the actual content rect, not the scroll viewport. Morning is at the right.
  return clampTime(PLANNER_START + (rect.right - clientX) / rect.width * (PLANNER_END - PLANNER_START), duration);
}
export function itemDuration(item: PlanItem): number {
  return item.planned_duration_minutes || (item.start_time && item.end_time ? timeToMinutes(item.end_time) - timeToMinutes(item.start_time) : 60);
}
export function sortPlannerItems(items: PlanItem[]): PlanItem[] {
  return [...items].sort((a, b) => {
    if (a.start_time && b.start_time) return timeToMinutes(a.start_time) - timeToMinutes(b.start_time) || a.ordering - b.ordering;
    if (a.start_time) return -1;
    if (b.start_time) return 1;
    return a.ordering - b.ordering || a.id - b.id;
  });
}
// Timed entries reserve their actual intervals; flexible entries fill earliest gaps.
// A uniformly expanded time scale keeps even short activities readable in one row.
export function arrangeLanes(items: PlanItem[]) {
  const reserved = items.filter(item => item.start_time).map(item => ({ id: item.id, start: timeToMinutes(item.start_time!), end: timeToMinutes(item.start_time!) + itemDuration(item) }));
  const placed = sortPlannerItems(items).map(item => {
    let start = item.start_time ? timeToMinutes(item.start_time) : 360;
    if (!item.start_time) {
      for (const interval of [...reserved].sort((a,b) => a.start - b.start)) {
        if (start + itemDuration(item) <= interval.start) break;
        if (start < interval.end) start = interval.end;
      }
      reserved.push({ id: item.id, start, end: start + itemDuration(item) });
    }
    return { item, start, conflict: start + itemDuration(item) > PLANNER_END || reserved.some(interval => interval.id !== item.id && start < interval.end && start + itemDuration(item) > interval.start) };
  }).sort((a,b) => a.start - b.start || a.item.ordering - b.item.ordering || a.item.id - b.item.id);
  const scale = Math.max(PIXELS_PER_MINUTE, ...items.map(item => (MIN_CARD_WIDTH + 12) / Math.max(1, itemDuration(item))));
  let edge = 0;
  const entries = placed.map(entry => {
    const desired = entry.start * scale;
    const position = Math.max(desired, edge);
    const width = Math.max(MIN_CARD_WIDTH, itemDuration(entry.item) * scale - 12);
    edge = position + width + 12;
    return { ...entry, conflict: entry.conflict || position > desired, position, width, lane: 0 };
  });
  return { entries, lanes: 1, scale, width: Math.max(PLANNER_END * scale, edge) };
}
export function dropConflict(item: PlanItem, minutes: number, items: PlanItem[], commitments: Commitment[], date: string): string | null {
  const end = minutes + itemDuration(item);
  if (end > 1439) return "این فعالیت پیش از پایان روز جا نمی‌شود.";
  const overlaps = (start: number, finish: number) => minutes < finish && end > start;
  if (items.some(other => other.id !== item.id && other.start_time && overlaps(timeToMinutes(other.start_time), timeToMinutes(other.start_time) + itemDuration(other)))) return "این بازه با فعالیت دیگری تداخل دارد.";
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  if (commitments.some(commitment => commitment.active && commitment.weekday === weekday && overlaps(timeToMinutes(commitment.start_time), timeToMinutes(commitment.end_time)))) return "این زمان با برنامه ثابت دانش‌آموز تداخل دارد.";
  return null;
}
export function tehranClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return { date: `${value("year")}-${value("month")}-${value("day")}`, minutes: Number(value("hour")) * 60 + Number(value("minute")), time: `${value("hour")}:${value("minute")}` };
}
