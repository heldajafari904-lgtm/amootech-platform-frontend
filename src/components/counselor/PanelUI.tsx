"use client";

import { useEffect, useRef } from "react";

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="panel-skeleton" role="status" aria-label="در حال بارگذاری"><span className="panel-skeleton-heading"/>{Array.from({ length: rows }, (_, index) => <span key={index}/>)}<span className="sr-only">در حال بارگذاری…</span></div>;
}

/** Traps keyboard focus in the existing dialog without changing its workflow. */
export function useDialogFocus(active: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; }, [close]);
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]')).filter(element => element.getClientRects().length);
    focusable()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const controls = focusable();
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [active]);
}

export type PanelIconName = "edit" | "copy" | "plus" | "close" | "trash" | "check" | "minus";

export function PanelIcon({ name }: { name: PanelIconName }) {
  const paths: Record<PanelIconName, string> = {
    edit: "M12 3l3 3M3 13l1-4 8-8 3 3-8 8-4 1z",
    copy: "M6 6h8v9H6zM3 11H2V2h8v1",
    plus: "M8 2v12M2 8h12",
    close: "M3 3l10 10M13 3L3 13",
    trash: "M4 4l-1 1v1h10V5l-1-1H4z M3 5v8a1 1 0 001 1h8a1 1 0 001-1V5 M7 8v4 M10 8v4",
    check: "M3 8l3 3 7-7",
    minus: "M3 8h10",
  };
  return <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}

export function IconButton({ icon, label, onClick, disabled, variant }: { icon: PanelIconName; label: string; onClick?: () => void; disabled?: boolean; variant?: "danger" }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={variant === "danger" ? "ws-danger" : undefined} style={{ width: 32, height: 32, minHeight: 32, padding: 0, display: "grid", placeItems: "center", borderRadius: 8 }}>
      <PanelIcon name={icon} />
    </button>
  );
}
