export type ParticipationStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "UNKNOWN";
export const participationLabels: Record<ParticipationStatus, string> = {
  NOT_STARTED: "شروع نکرده", IN_PROGRESS: "در حال شرکت", COMPLETED: "تکمیل‌شده", UNKNOWN: "نامشخص / تأییدنشده",
};
export type MonitoringRow = {
  student: number; student_name: string; status: ParticipationStatus; last_known_status: ParticipationStatus | null;
  observed_at: string | null; started_at: string | null; completed_at: string | null; absent: boolean; warnings: string[];
  local_attempt: { status: string; requested_at: string | null; finished_at?: string | null } | null;
};
export type MonitoringData = {
  count: number; next: string | null; previous: string | null; results: MonitoringRow[];
  summary: Record<ParticipationStatus, number> & { assigned: number; started: number };
  last_success_at: string | null; fresh_until?: string | null; fresh: boolean; partial: boolean; error: string; syncing: boolean;
  retry_after: number; availability: { label: string };
};
export function effectiveMonitoring(data: MonitoringData | null, now = Date.now()): MonitoringData | null {
  if (!data || !data.fresh || !data.fresh_until || now < Date.parse(data.fresh_until)) return data;
  return {
    ...data, fresh: false,
    summary: { ...data.summary, started: data.summary.COMPLETED, IN_PROGRESS: 0, NOT_STARTED: 0, UNKNOWN: data.summary.assigned - data.summary.COMPLETED },
    results: data.results.map(row => row.status === "COMPLETED" ? row : { ...row, status: "UNKNOWN", last_known_status: row.status === "UNKNOWN" ? row.last_known_status : row.status, absent: false }),
  };
}
export function monitoringPath(id: number, query = "", status = "", page = 1) {
  const params = new URLSearchParams({ page: String(page) });
  if (query.trim()) params.set("q", query.trim());
  if (status) params.set("status", status);
  return `/exams/${id}/monitoring/?${params}`;
}
export type MonitoringState = { data: MonitoringData | null; loading: boolean; syncing: boolean; error: string; notice: string };
export class MonitoringSession {
  state: MonitoringState = { data: null, loading: true, syncing: false, error: "", notice: "" };
  private id: number;
  private request: <T>(path: string, method?: string) => Promise<T>;
  private revision = 0;
  private active = true;
  private query: [string, string, number] = ["", "", 1];
  private listener: (state: MonitoringState) => void = () => {};
  constructor(id: number, request: <T>(path: string, method?: string) => Promise<T>) { this.id = id; this.request = request; }
  connect(listener: (state: MonitoringState) => void) { this.listener = listener; this.active = true; }
  dispose() { this.active = false; ++this.revision; this.listener = () => {}; }
  private update(patch: Partial<MonitoringState>) { if (this.active) { this.state = { ...this.state, ...patch }; this.listener(this.state); } }
  async load(query = this.query[0], status = this.query[1], page = this.query[2], clearError = true) {
    this.query = [query, status, page];
    const revision = ++this.revision;
    this.update({ loading: true, ...(clearError ? { error: "" } : {}) });
    try {
      const data = await this.request<MonitoringData>(monitoringPath(this.id, query, status, page));
      if (revision === this.revision) this.update({ data });
    } catch (reason) {
      if (revision === this.revision) this.update({ data: null, error: reason instanceof Error ? reason.message : "دریافت پایش انجام نشد." });
    } finally { if (revision === this.revision) this.update({ loading: false }); }
  }
  async sync() {
    if (this.state.syncing || !this.active) return;
    this.update({ syncing: true, error: "", notice: "" });
    try {
      await this.request(`/exams/${this.id}/monitoring/sync/`, "POST");
      this.update({ notice: "اطلاعات قابل تأیید از سرویس دریافت شد؛ تازگی و هشدارهای فهرست را بررسی کنید." });
    } catch (reason) {
      this.update({ error: reason instanceof Error ? reason.message : "همگام‌سازی ناموفق بود؛ آخرین وضعیت حفظ شد." });
    } finally {
      if (this.active) { await this.load(...this.query, false); this.update({ syncing: false }); }
    }
  }
}
