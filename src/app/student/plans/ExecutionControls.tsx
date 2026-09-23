"use client";

import { Kind, PlanItemExecution } from "@/lib/planning";

type TimerAction = "start" | "pause" | "resume" | "quick-complete" | "not-done";
const statusLabel: Record<PlanItemExecution["status"], string> = {
  IN_PROGRESS: "در حال انجام", PAUSED: "توقف موقت", COMPLETED: "انجام شد",
  PARTIAL: "ناقص", NOT_DONE: "انجام نشد",
};

function clock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return [Math.floor(value / 3600), Math.floor(value % 3600 / 60), value % 60]
    .map((part) => String(part).padStart(2, "0")).join(":");
}

export default function ExecutionControls({ itemId, kind, execution, now, busy, onAction, onFinish }: {
  itemId: number; kind: Kind; execution?: PlanItemExecution; now: number; busy: boolean;
  onAction: (itemId: number, action: TimerAction) => Promise<boolean>;
  onFinish: (status: "COMPLETED" | "PARTIAL") => void;
}) {
  const elapsed = execution?.accumulated_seconds || 0;
  const running = execution?.status === "IN_PROGRESS" && execution.current_session_started_at
    ? Math.max(0, Math.floor((now - Date.parse(execution.current_session_started_at)) / 1000)) : 0;
  const status = execution ? statusLabel[execution.status] : "شروع نشده";
  const unresolved = !execution || execution.status === "IN_PROGRESS" || execution.status === "PAUSED";
  return <div className="execution-controls"><span className={`execution-status execution-status-${execution?.status.toLowerCase() || "not-started"}`}>{status}</span>
    {execution?.started_at && <span className="execution-clock" dir="ltr" aria-label="زمان فعالیت">{clock(elapsed + running)}</span>}
    <div className="execution-actions">
      {kind !== "EVENT" && !execution && <button type="button" disabled={busy} onClick={() => onAction(itemId, "start")}>⏱ شروع با کرنومتر</button>}
      {execution?.status === "IN_PROGRESS" && <button type="button" disabled={busy} onClick={() => onAction(itemId, "pause")}>توقف موقت</button>}
      {execution?.status === "PAUSED" && <button type="button" disabled={busy} onClick={() => onAction(itemId, "resume")}>ادامه</button>}
      {unresolved && <button type="button" disabled={busy} onClick={() => kind === "EVENT" ? onAction(itemId, "quick-complete") : onFinish("COMPLETED")}>{execution?.status === "IN_PROGRESS" || execution?.status === "PAUSED" ? "پایان و ثبت عملکرد" : "✓ اتمام / ثبت عملکرد"}</button>}
      {unresolved && kind !== "EVENT" && <button type="button" disabled={busy} onClick={() => onFinish("PARTIAL")}>بخشی انجام شد</button>}
      {unresolved && !execution && <button type="button" className="planning-subtle" disabled={busy} onClick={() => onAction(itemId, "not-done")}>✕ انجام نشد</button>}
    </div>
  </div>;
}
