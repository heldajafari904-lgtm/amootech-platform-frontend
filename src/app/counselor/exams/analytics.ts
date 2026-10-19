import type { ExamResult } from "@/components/exams/ExamUI";

export const resultLabels: Record<string, string> = {
  SCORED: "نمره تأییدشده", IDENTITY_MISSING: "اتصال حساب کامل نیست", NEEDS_VERIFICATION: "نیاز به تأیید نمره",
  AWAITING_RESULT: "در انتظار دریافت نتیجه", NOT_COMPLETED: "تکمیل تأیید نشده",
};
export type AnalyticsRow = {
  student: number; student_name: string; status: string; score: number | null; quiz24_balance: number | null;
  group_rank: number | null; provider_rank: number | null; provider_rank_in_class: number | null;
  verified_at: string | null; stale: boolean; details_available: boolean;
};
export type AnalyticsData = {
  count: number; next: string | null; previous: string | null; results: AnalyticsRow[];
  metrics: {
    assigned: number; completed: number; valid_scored: number; participation_percentage: number | null;
    average_score: number | null; highest_score: number | null; lowest_score: number | null; median_score: number | null;
    average_quiz24_balance: number | null; balance_contributors: number;
    answer_counts: Record<string, { total: number | null; average: number | null; contributors: number }>;
    distribution: { lower: number; upper: number; count: number; upper_inclusive: boolean }[];
  };
  score_scale: { label: string }; ranking: { provisional: boolean }; last_success_at: string | null;
  fresh: boolean; fresh_until?: string | null; partial: boolean; error: string; syncing: boolean; remaining_in_cycle: number;
  batch_limit: number; last_batch_size: number; last_error_count: number;
};
export function effectiveAnalytics(data: AnalyticsData | null, now = Date.now()): AnalyticsData | null {
  if (!data) return data;
  return {
    ...data, fresh: data.fresh && (!data.fresh_until || now < Date.parse(data.fresh_until)),
    results: data.results.map(row => ({ ...row, stale: row.stale || !!row.verified_at && now >= Date.parse(row.verified_at) + 300_000 })),
  };
}
export function resultNumber(value: number | null | undefined) {
  return value == null ? "—" : value.toLocaleString("fa-IR", { maximumFractionDigits: 2 });
}
export function analyticsPath(id: number, query = "", status = "", ordering = "rank", page = 1) {
  const params = new URLSearchParams({ page: String(page), ordering });
  if (query.trim()) params.set("q", query.trim());
  if (status) params.set("status", status);
  return `/exams/${id}/analytics/?${params}`;
}
export type AnalyticsState = { data: AnalyticsData | null; loading: boolean; syncing: boolean; error: string; notice: string };
export class AnalyticsSession {
  state: AnalyticsState = { data: null, loading: true, syncing: false, error: "", notice: "" };
  private id: number;
  private request: <T>(path: string, method?: string) => Promise<T>;
  private revision = 0;
  private active = true;
  private query: [string, string, string, number] = ["", "", "rank", 1];
  private listener: (state: AnalyticsState) => void = () => {};
  constructor(id: number, request: <T>(path: string, method?: string) => Promise<T>) { this.id = id; this.request = request; }
  connect(listener: (state: AnalyticsState) => void) { this.listener = listener; this.active = true; }
  dispose() { this.active = false; ++this.revision; this.listener = () => {}; }
  private update(patch: Partial<AnalyticsState>) { if (this.active) { this.state = { ...this.state, ...patch }; this.listener(this.state); } }
  async load(query = this.query[0], status = this.query[1], ordering = this.query[2], page = this.query[3], clearError = true) {
    this.query = [query, status, ordering, page];
    const revision = ++this.revision;
    this.update({ loading: true, ...(clearError ? { error: "" } : {}) });
    try {
      const data = await this.request<AnalyticsData>(analyticsPath(this.id, query, status, ordering, page));
      if (revision === this.revision) this.update({ data });
    } catch (reason) {
      if (revision === this.revision) this.update({ data: null, error: reason instanceof Error ? reason.message : "دریافت نتایج انجام نشد." });
    } finally { if (revision === this.revision) this.update({ loading: false }); }
  }
  async sync() {
    if (this.state.syncing || !this.active) return;
    this.update({ syncing: true, error: "", notice: "" });
    try {
      const summary = await this.request<Pick<AnalyticsData, "last_error_count">>(`/exams/${this.id}/analytics/sync/`, "POST");
      this.update({ notice: `این بسته بررسی شد؛ ${summary.last_error_count ?? 0} نتیجه تأیید نشد. وضعیت پوشش و داده‌های باقی‌مانده را بررسی کنید.` });
    } catch (reason) {
      this.update({ error: reason instanceof Error ? reason.message : "همگام‌سازی ناموفق بود؛ نتایج معتبر قبلی حفظ شدند." });
    } finally {
      if (this.active) { await this.load(...this.query, false); this.update({ syncing: false }); }
    }
  }
  detail(student: number): Promise<ExamResult> { return this.request(`/exams/${this.id}/result/?student=${student}`); }
}
