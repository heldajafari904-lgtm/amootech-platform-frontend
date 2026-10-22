"use client";
import { persianDate } from "@/lib/planning";
import ActivityEditor, { type ActivityEditorProps } from "./ActivityEditor";

// Retain the workspace's add entry point and dialog, with a compact single-form editor.
export default function WizardAddBox({ date, onCreated, ...props }: Omit<ActivityEditorProps, 'onSaved'> & { date: string; onCreated: ActivityEditorProps['onSaved'] }) {
  return <div className="ws-modal" role="dialog" aria-modal="true" aria-label={`افزودن فعالیت ${persianDate(date)}`}><div className="ws-modal-card flex-editor-dialog"><ActivityEditor {...props} modal onSaved={onCreated}/></div></div>;
}
