"use client";

import { useState } from "react";
import { applyStudentFixed } from "@/lib/planning";
import { apiErrorMessage } from "./planningFeedback";

export default function ApplyFixedButton({ token, studentId, planId, onApplied }: { token: string; studentId: number; planId?: number; onApplied?: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function apply() {
    setBusy(true); setMessage("");
    try {
      const result = await applyStudentFixed(token, studentId, planId);
      const conflicts = result.skipped.filter(item => item.reason === "conflict").length;
      setMessage(conflicts ? `برنامه همگام شد؛ ${conflicts} مورد به‌دلیل تداخل اضافه نشد.` : "برنامه مدرسه و رویدادهای ثابت به برنامه اضافه شد.");
      await onApplied?.();
    } catch (error) { setMessage(apiErrorMessage(error)); }
    finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={() => void apply()}>افزودن برنامه مدرسه و رویدادهای ثابت به برنامه</button>{message && <p role="status">{message}</p>}</div>;
}
