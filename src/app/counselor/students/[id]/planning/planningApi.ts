import { api } from "@/lib/api";
import { downloadPlanExport, type Commitment, type Plan, type PlanDay, type PlanItem, type SchoolSlot } from "@/lib/planning";

export type ItemInput = Pick<PlanItem, "plan_day" | "kind" | "ordering" | "planned_duration_minutes" | "start_time" | "end_time" | "note" | "subject" | "chapter" | "topic" | "test_count"> & { title?: string; taxonomy?: PlanItem["taxonomy"]; reset_generated_title?: boolean };
export type MoveInput = { target_day: number; ordering?: number; start_time?: string | null; end_time?: string | null; planned_duration_minutes?: number };
export function planningApi(token: string) {
  return {
    createItem: (data: ItemInput) => api<PlanItem>("/planning/items/", token, "POST", data),
    updateItem: (id: number, data: Partial<ItemInput>) => api<PlanItem>(`/planning/items/${id}/`, token, "PATCH", data),
    deleteItem: (id: number) => api<void>(`/planning/items/${id}/`, token, "DELETE"),
    duplicateItem: (id: number) => api<PlanItem>(`/planning/items/${id}/duplicate/`, token, "POST", {}),
    moveItem: (id: number, data: MoveInput) => api<PlanItem>(`/planning/items/${id}/move/`, token, "POST", data),
    copyDay: (id: number, target: number, mode: "append" | "replace" = "append") => api<PlanDay>(`/planning/days/${id}/copy-day/`, token, "POST", { target_day: target, mode }),
    reorderItems: (id: number, ordering: number[]) => api<PlanDay>(`/planning/days/${id}/reorder/`, token, "POST", { ordering }),
    createDay: (plan: number, date: string) => api<PlanDay>("/planning/days/", token, "POST", { plan, date }),
    createPlan: (data: { student: number; start_date: string; end_date: string; title: string; apply_fixed?: boolean; exam_dates?: string[] }) => api<Plan>("/planning/plans/", token, "POST", data),
    getPlan: (id: number) => api<Plan>(`/planning/plans/${id}/`, token),
    publish: (id: number) => api<Plan>(`/planning/plans/${id}/publish/`, token, "POST", {}),
    applyFixed: (id: number) => api<{ plan: Plan; created: number; removed: number; skipped: { date: string; title: string; start: string; end: string; reason: string }[] }>(`/planning/plans/${id}/apply-fixed/`, token, "POST", {}),
    export: (id: number, format: "excel" | "pdf") => downloadPlanExport(id, format, token),
    // Fixed schedule
    listCommitments: (student: number) => api<Commitment[]>("/planning/commitments/?student=" + student, token, "GET").catch(async () => {
      const { allPages } = await import("@/lib/api");
      return allPages<Commitment>("/planning/commitments/?student=" + student, token);
    }),
    createCommitment: (data: { student: number; kind: string; title: string; weekday: number; start_time: string; end_time: string; valid_from?: string | null; valid_until?: string | null }) => api<Commitment>("/planning/commitments/", token, "POST", data),
    updateCommitment: (id: number, data: Partial<{ title: string; kind: string; weekday: number; start_time: string; end_time: string; active: boolean; valid_from: string | null; valid_until: string | null }>) => api<Commitment>(`/planning/commitments/${id}/`, token, "PATCH", data),
    deleteCommitment: (id: number) => api<void>(`/planning/commitments/${id}/`, token, "DELETE"),
    toggleCommitment: (id: number) => api<Commitment>(`/planning/commitments/${id}/toggle-active/`, token, "POST", {}),
    batchCommitment: (data: { student: number; kind: string; title: string; weekdays: number[]; start_time: string; end_time: string; valid_from?: string | null; valid_until?: string | null }) => api<Commitment[]>("/planning/commitments/batch/", token, "POST", data),
    groupUpdate: (data: { group_id: string; title?: string; kind?: string; start_time?: string; end_time?: string; valid_from?: string | null; valid_until?: string | null; active?: boolean }) => api<Commitment[]>("/planning/commitments/group-update/", token, "POST", data),
    groupDelete: (group_id: string) => api<void>("/planning/commitments/group-delete/", token, "POST", { group_id }),
    schoolHours: (data: { student: number; weekdays: number[]; start_time: string; end_time: string; title?: string; valid_from?: string | null; valid_until?: string | null }) => api<Commitment[]>("/planning/commitments/school-hours/", token, "POST", data),
    listSchoolSlots: (student: number) => api<SchoolSlot[]>("/planning/school-slots/?student=" + student, token, "GET").catch(async () => {
      const { allPages } = await import("@/lib/api");
      return allPages<SchoolSlot>("/planning/school-slots/?student=" + student, token);
    }),
    bulkSchoolSlots: (data: { student: number; slots: { weekday: number; period: number; subject_name: string }[] }) => api<SchoolSlot[]>("/planning/school-slots/bulk/", token, "POST", data),
    clearSchoolSlots: (student: number, weekday?: number) => api<void>("/planning/school-slots/clear/?student=" + student + (weekday !== undefined ? "&weekday=" + weekday : ""), token, "DELETE"),
  };
}
