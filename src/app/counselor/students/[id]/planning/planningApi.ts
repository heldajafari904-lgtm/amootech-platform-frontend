import { api } from "@/lib/api";
import { downloadPlanExport, type Plan, type PlanDay, type PlanItem } from "@/lib/planning";

export type ItemInput = Pick<PlanItem, "plan_day" | "kind" | "ordering" | "title" | "planned_duration_minutes" | "start_time" | "end_time" | "note" | "subject" | "chapter" | "topic" | "test_count">;
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
    createPlan: (data: { student: number; start_date: string; end_date: string; title: string }) => api<Plan>("/planning/plans/", token, "POST", data),
    getPlan: (id: number) => api<Plan>(`/planning/plans/${id}/`, token),
    publish: (id: number) => api<Plan>(`/planning/plans/${id}/publish/`, token, "POST", {}),
    export: (id: number, format: "excel" | "pdf") => downloadPlanExport(id, format, token),
  };
}
