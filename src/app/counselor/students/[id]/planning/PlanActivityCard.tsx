"use client";
import { useState } from "react";
import type { PlanItem } from "@/lib/planning";
import { PanelIcon } from "@/components/counselor/PanelUI";

function toFaDigits(s: string): string { return s.replace(/[0-9]/g, (d: string) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]); }
function formatDuration(mins: number | null): string { if(!mins) return ""; const h=Math.floor(mins/60), m=mins%60; return m? `${toFaDigits(String(h))}:${toFaDigits(String(m).padStart(2,"0"))}` : `${toFaDigits(String(h))}:۰۰`; }

const NOTE_COLLAPSE_CHARS = 120;

export default function PlanActivityCard({
  item,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
  onAddNote,
  dragHandle,
  placement,
  pending = false,
}: {
  item: PlanItem;
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onDelete: () => void;
  onAddNote: () => void;
  dragHandle?: React.ReactNode;
  placement?: string;
  pending?: boolean;
}) {
  const kindClass = `ws-box ws-box-${item.kind.toLowerCase()}`;
  const title = item.title || item.subject_name || "—";
  const sub = (item.chapter_name || item.topic_name) ? [item.chapter_name, item.topic_name].filter(Boolean).join(" › ") : (item.subject_name && item.title ? item.subject_name : "");
  const note = (item.note || "").trim();
  const isLongNote = note.length > NOTE_COLLAPSE_CHARS;
  const [expanded, setExpanded] = useState(false);
  return (
    <article className={kindClass} data-item-id={item.id} aria-busy={pending}>
      <button type="button" className="timeline-delete ws-danger" aria-label={`حذف ${title}`} disabled={pending || !item.counselor_editable} onClick={onDelete}><PanelIcon name="close"/></button>
      <div className="ws-box-head">{dragHandle}
        <span className="ws-box-kind">{item.kind === "STUDY" ? "مطالعه" : item.kind === "TEST" ? "تست" : item.kind === "REVIEW" ? "مرور" : item.kind === "EXAM" ? "آزمون" : "رویداد"}</span>
        {item.start_time && item.end_time && <span className="ws-box-time">{toFaDigits(item.start_time.slice(0,5))}–{toFaDigits(item.end_time.slice(0,5))}</span>}
      </div>
      {placement && <span className="timeline-placement" title={placement}>{placement}</span>}
      <strong className="ws-box-title" title={title}>{title}</strong>
      {sub && <span className="ws-box-sub" title={sub}>{sub}</span>}
      <span className="ws-box-meta">{item.planned_duration_minutes ? formatDuration(item.planned_duration_minutes) : ""}{item.test_count ? ` · ${toFaDigits(String(item.test_count))} تست` : ""}</span>
      {note && (
        <div className="ws-box-note-wrap">
          <p className={`ws-box-note ${!expanded && isLongNote ? "is-clamped" : ""}`} title={note}>{note}</p>
          {isLongNote && (
            <button
              type="button"
              className="ws-box-note-toggle"
              aria-expanded={expanded}
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {expanded ? "نمایش کمتر" : "نمایش بیشتر"}
            </button>
          )}
        </div>
      )}
      <div className="ws-box-actions">
        <button type="button" aria-label="ویرایش" disabled={pending || !item.counselor_editable} onClick={onEdit}><PanelIcon name="edit"/></button>
        <button type="button" aria-label="کپی" disabled={pending || !item.counselor_editable} onClick={onDuplicate}><PanelIcon name="copy"/></button>
        <button type="button" aria-label="افزودن توضیحات" disabled={pending || !item.counselor_editable} onClick={onAddNote}><PanelIcon name="plus"/></button>
        <details className="ws-more">
          <summary aria-label={`عملیات ${title}`}>⋯</summary>
          <div className="ws-menu" onClick={event => { if ((event.target as HTMLElement).closest("button")) event.currentTarget.closest("details")?.removeAttribute("open"); }}><button type="button" disabled={pending || !item.counselor_editable} onClick={onEdit}>ویرایش</button><button type="button" disabled={pending || !item.counselor_editable} onClick={onDuplicate}>تکثیر فعالیت</button><button type="button" disabled={pending || !item.counselor_editable} onClick={onAddNote}>توضیحات</button><button type="button" disabled={pending || !item.counselor_editable} onClick={onMove}>انتقال به روز/ساعت دیگر</button><button type="button" className="ws-danger" disabled={pending || !item.counselor_editable} onClick={onDelete}>حذف</button></div>
        </details>
      </div>
      {!item.counselor_editable && item.edit_lock_reason && <small className="ws-lock">{item.edit_lock_reason}</small>}
    </article>
  );
}
