import type { DailyReport, DailyReportItem } from './dailyReports.ts';

export const quickStatuses = ['COMPLETED', 'PARTIAL', 'NOT_DONE'] as const;
export type ReportedStatus = typeof quickStatuses[number];
export const quickLabels: Record<ReportedStatus, string> = { COMPLETED: 'خوندم', PARTIAL: 'نصفه', NOT_DONE: 'نخوندم' };
export function submittedStatus(item: Pick<DailyReportItem, 'reported_status'>): ReportedStatus | null {
  return quickStatuses.includes(item.reported_status as ReportedStatus) ? item.reported_status as ReportedStatus : null;
}
export function reportingProgress(items: DailyReportItem[]) {
  const planned = items.filter(item => item.plan_item !== null);
  const reported = planned.filter(item => submittedStatus(item) !== null).length;
  return { reported, total: planned.length, percent: planned.length ? Math.round(reported * 100 / planned.length) : 0 };
}
// The existing API returns a full day. Serialize writes so a slower older snapshot
// cannot erase a different card's newer status or optional daily details.
export function createReportWriteQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation, operation);
    tail = result.catch(() => undefined);
    return result;
  };
}
export function reportEditable(report: Pick<DailyReport, 'date' | 'editable'>, today: string) {
  if (typeof report.editable === 'boolean') return report.editable;
  const age = (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${report.date}T12:00:00Z`)) / 86400000;
  return age >= 0 && age <= 30;
}
