"use client";

import { useRef, useState } from "react";
import { useDialogFocus } from "@/components/counselor/PanelUI";
import type { AcademicTree } from "@/lib/academicTree";
import { type PlanItem, type Student } from "@/lib/planning";
import { contentPayload, displayTitle, initialContent, manualTitle } from "./flexibleContent";
import { planningApi, type ItemInput } from "./planningApi";
import { apiErrorMessage } from "./planningFeedback";
import TaxonomySelector from "./TaxonomySelector";
import "./timeline.css";

export type ActivityEditorProps = {
  token: string; student: Student; dayId: number; ordering: number; tree?: AcademicTree | null;
  creationContext?: Partial<Pick<ItemInput, 'kind' | 'planned_duration_minutes' | 'test_count' | 'start_time' | 'end_time' | 'note'>>;
  initialItem?: PlanItem; onSaved: (item: PlanItem) => Promise<void> | void;
  onError?: (message: string) => void; onCancel: () => void; modal?: boolean;
};

export default function ActivityEditor({ token, student, dayId, ordering, tree, initialItem, creationContext, onSaved, onError, onCancel, modal = false }: ActivityEditorProps) {
  const [content, setContent] = useState(() => initialContent(initialItem));
  const [busy, setBusy] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const saved = useRef<PlanItem | null>(null);
  function cancel() { if (!submitting.current) onCancel(); }
  useDialogFocus(modal, cancel);
  const title = displayTitle(content);
  // The outer planner supplies scheduling context; edits leave those fields untouched.
  const scheduling = { kind: 'STUDY' as const, planned_duration_minutes: 60, test_count: null, start_time: null, end_time: null, note: '', ...creationContext };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!title.trim()) { setError('عنوان فعالیت را بنویسید یا محتوای آموزشی انتخاب کنید.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      if (!saved.current) {
        const selection = contentPayload(content, !!initialItem);
        saved.current = initialItem
          ? await planningApi(token).updateItem(initialItem.id, selection)
          : await planningApi(token).createItem({
            plan_day: dayId, ordering, ...scheduling, ...selection,
          });
      }
      setHasSaved(true);
      await onSaved(saved.current);
    } catch (reason) {
      const message = saved.current ? 'فعالیت ذخیره شد، اما نمایش برنامه به‌روز نشد. برای به‌روزرسانی دوباره تلاش کنید.' : apiErrorMessage(reason);
      setError(message); onError?.(message);
    } finally { submitting.current = false; setBusy(false); }
  }

  return <form className="ws-quickadd flex-activity-editor" dir="rtl" aria-label={initialItem ? 'ویرایش فعالیت' : 'افزودن فعالیت'} onSubmit={save}>
    <fieldset disabled={busy || hasSaved} className="flex-editor-fields">
      <label className="flex-title-label">عنوان فعالیت<input name="title" value={title} maxLength={200} onChange={e => setContent(current => manualTitle(current, e.target.value))} placeholder="عنوان فعالیت"/></label>
      <TaxonomySelector token={token} student={student} tree={tree} content={content} onChange={setContent}/>
    </fieldset>
    {error && <p className="ws-error" role="alert">{error}</p>}
    <footer className="ws-quickadd-actions"><button type="submit" disabled={busy} aria-busy={busy}>تمام در همین مرحله</button></footer>
  </form>;
}
