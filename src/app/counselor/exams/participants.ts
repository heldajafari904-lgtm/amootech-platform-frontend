import type { CounselorExam } from "./workspace";

export type Assignment = { student: number; student_name: string; assigned_at: string };
export type ParticipantStudent = { id: number; user: { first_name: string; last_name: string; username: string } };
export const ROWS_PER_PAGE = 30;
export const MAX_ASSIGNMENTS = 200;
export function participantName(student: ParticipantStudent) {
  return `${student.user.first_name} ${student.user.last_name}`.trim() || student.user.username;
}
function normalize(value: string) {
  return value.normalize("NFKC").replaceAll("ي", "ی").replaceAll("ك", "ک").replaceAll("\u200c", " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("fa-IR");
}
export function searchStudents<T extends ParticipantStudent>(students: T[], query: string): T[] {
  return students.filter(student => normalize(participantName(student)).includes(normalize(query)));
}
export function selectStudents(selected: number[], candidates: number[], assigned: Assignment[]) {
  const existing = new Set(assigned.map(row => row.student));
  return [...new Set([...selected, ...candidates])].filter(id => !existing.has(id)).slice(0, MAX_ASSIGNMENTS);
}
export type ParticipantState = {
  assignments: Assignment[]; count: number; selected: number[]; pendingRemoval: Assignment | null;
  loading: boolean; ready: boolean; busy: boolean; error: string; notice: string;
};
type Request = <T>(path: string, method?: string, body?: object) => Promise<T>;

/** One mounted exam panel owns a session; obsolete responses cannot publish state. */
export class ParticipantSession {
  state: ParticipantState = { assignments: [], count: 0, selected: [], pendingRemoval: null, loading: true, ready: false, busy: false, error: "", notice: "" };
  private revision = 0;
  private listener: (state: ParticipantState) => void = () => {};
  private id: number;
  private request: Request;
  private onExam: (exam: CounselorExam) => void;
  private onCount: (count: number) => void;
  constructor(id: number, request: Request, onExam: (exam: CounselorExam) => void, onCount: (count: number) => void) {
    this.id = id; this.request = request; this.onExam = onExam; this.onCount = onCount;
  }
  connect(listener: (state: ParticipantState) => void) { this.listener = listener; }
  dispose() { ++this.revision; this.listener = () => {}; }
  private update(patch: Partial<ParticipantState>) { this.state = { ...this.state, ...patch }; this.listener(this.state); }
  select(ids: number[]) {
    if (!this.state.ready || this.state.busy || this.state.loading) return;
    this.update({ selected: selectStudents([], ids, this.state.assignments) });
  }
  confirmRemoval(row: Assignment | null) {
    if (!this.state.busy) this.update({ pendingRemoval: row, error: "" });
  }
  private async snapshot(revision: number) {
    const examPromise = this.request<CounselorExam>(`/exams/${this.id}/`);
    const rowsPromise = (async () => {
      const rows: Assignment[] = [];
      let next: string | null = `/exams/${this.id}/assignments/`;
      const visited = new Set<string>();
      while (next) {
        if (visited.has(next)) throw new Error("صفحه‌بندی شرکت‌کنندگان معتبر نیست.");
        visited.add(next);
        const page: { results: Assignment[]; next: string | null } = await this.request(next);
        rows.push(...page.results); next = page.next;
      }
      return rows;
    })();
    const [exam, assignments] = await Promise.all([examPromise, rowsPromise]);
    if (revision !== this.revision) return;
    this.update({ assignments, count: exam.assignment_count ?? assignments.length, selected: selectStudents([], this.state.selected, assignments), ready: true });
    this.onExam(exam);
  }
  async load() {
    if (this.state.busy) return;
    const revision = ++this.revision;
    this.update({ loading: true, ready: false, error: "" });
    try { await this.snapshot(revision); }
    catch (reason) { if (revision === this.revision) this.update({ error: reason instanceof Error ? reason.message : "دریافت شرکت‌کنندگان انجام نشد." }); }
    finally { if (revision === this.revision) this.update({ loading: false }); }
  }
  async save(method: "POST" | "DELETE") {
    if (!this.state.ready || this.state.busy || this.state.loading) return;
    const ids = method === "DELETE" ? this.state.pendingRemoval ? [this.state.pendingRemoval.student] : [] : selectStudents([], this.state.selected, this.state.assignments);
    if (!ids.length) return;
    const revision = ++this.revision;
    this.update({ busy: true, error: "", notice: "" });
    let saved = false;
    try {
      const result = await this.request<{ assignment_count: number }>(`/exams/${this.id}/assignments/`, method, { student_ids: ids });
      if (revision !== this.revision) return;
      saved = true;
      this.onCount(result.assignment_count);
      this.update({ count: result.assignment_count, selected: [], pendingRemoval: null, ready: false, notice: method === "POST" ? "دانش‌آموزان به آزمون اضافه شدند." : "تخصیص دانش‌آموز حذف شد." });
      await this.snapshot(revision);
    } catch (reason) {
      if (revision === this.revision) this.update({ error: `${saved ? "تغییر ثبت شد؛ بازخوانی فهرست ناموفق بود. " : ""}${reason instanceof Error ? reason.message : "درخواست انجام نشد؛ فهرست را بازخوانی کنید."}`, ready: false });
    } finally { if (revision === this.revision) this.update({ busy: false }); }
  }
}
