"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, useDraggable, useDroppable, pointerWithin, rectIntersection, type DragEndEvent, type DragMoveEvent } from "@dnd-kit/core";
import { persianDate, type PlanItem, type PlanDay, type Commitment } from "@/lib/planning";
import { PanelIcon } from "@/components/counselor/PanelUI";
import PlanActivityCard from "./PlanActivityCard";
import { arrangeLanes, dropConflict, itemDuration, LANE_HEIGHT, MIN_CARD_WIDTH, minutesToTime, PLANNER_END, PLANNER_START, PIXELS_PER_MINUTE, SNAP_MINUTES, tehranClock, timeFromClientX } from "./plannerTime";
import "./timeline.css";

class PlannerPointerSensor extends PointerSensor {
  static activators = PointerSensor.activators.map(activator => ({ ...activator, handler: (...args: Parameters<typeof activator.handler>) => args[0].nativeEvent.pointerType !== "touch" && activator.handler(...args) }));
}

const EMPTY_ITEMS: PlanItem[] = [];

type Actions = { onEdit: (item: PlanItem) => void; onDelete: (item: PlanItem) => void; onDuplicate: (item: PlanItem) => void; onMoveMenu: (item: PlanItem, date: string) => void };
type Target = { date: string; minutes: number | null; ordering?: number; error?: string | null };
type Props = Actions & {
  dates: string[]; days: PlanDay[]; commitments: Commitment[]; pending: Set<number>;
  copyDate: string | null; copyBusy: boolean;
  onCopy: (day: PlanDay) => void; onCopyTarget: (date: string, day: PlanDay | null) => void;
  onAdd: (date: string) => void; onDrop: (item: PlanItem, target: Target) => Promise<void>;
};

function DraggableActivity({ item, date, pending, actions, disabled, placement }: { item: PlanItem; date: string; pending: boolean; actions: Actions; disabled: boolean; placement: string }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `item:${item.id}`, data: { item, date }, disabled: disabled || !item.counselor_editable || pending });
  return <div ref={setNodeRef} {...(disabled ? {} : attributes)} {...listeners} onPointerDownCapture={event => { if ((event.target as HTMLElement).closest("button, summary, details, input, a")) event.stopPropagation(); }} onTouchStartCapture={event => { if ((event.target as HTMLElement).closest("button, summary, details, input, a")) event.stopPropagation(); }} onKeyDownCapture={event => { if ((event.target as HTMLElement).closest("button, summary, details")) event.stopPropagation(); }} className={`timeline-activity ${isDragging ? "is-dragging" : ""}`}>
    <PlanActivityCard item={item} pending={pending} placement={placement} onEdit={() => actions.onEdit(item)} onAddNote={() => actions.onEdit(item)} onDelete={() => actions.onDelete(item)} onDuplicate={() => actions.onDuplicate(item)} onMove={() => actions.onMoveMenu(item, date)}/>
  </div>;
}

function TimelineDay({ date, day, clock, preview, props }: { date: string; day?: PlanDay; clock: ReturnType<typeof tehranClock>; preview: Target | null; props: Props }) {
  const items = day?.items || EMPTY_ITEMS;
  const viewport = useRef<HTMLDivElement>(null);
  const { entries, scale, width } = useMemo(() => arrangeLanes(items), [items]);
  const { setNodeRef: setDayNode } = useDroppable({ id: `day:${date}`, data: { date, scheduled: true }, disabled: !!props.copyDate });
  useEffect(() => { if (viewport.current) viewport.current.scrollLeft = -Math.max(0, 360 * scale - 24); }, [scale]);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackHeight, setTrackHeight] = useState(44 + LANE_HEIGHT);
  // Auto-height: track must enclose tallest box (note may expand)
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const compute = () => {
      const boxes = track.querySelectorAll<HTMLElement>(".timeline-activity .ws-box");
      let max = 0;
      boxes.forEach((el) => { max = Math.max(max, el.offsetHeight); });
      // Empty state uses default lane height; otherwise tallest box + ruler(44) + padding(16)
      const next = boxes.length ? max + 44 + 16 : 44 + LANE_HEIGHT;
      setTrackHeight(next);
    };
    compute();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", compute);
      return () => window.removeEventListener("resize", compute);
    }
    const ro = new ResizeObserver(compute);
    // observe track and each box; also re-observe when entries change
    ro.observe(track);
    track.querySelectorAll(".timeline-activity .ws-box").forEach((el) => ro.observe(el));
    // also watch for future note toggles via mutation
    const mo = new MutationObserver(() => {
      // re-attach observers for new boxes after expand
      track.querySelectorAll<HTMLElement>(".timeline-activity .ws-box").forEach((el) => ro.observe(el));
      compute();
    });
    mo.observe(track, { childList: true, subtree: true });
    window.addEventListener("resize", compute);
    // also compute after fonts load
    if (document.fonts?.ready) document.fonts.ready.then(compute).catch(() => {});
    return () => { ro.disconnect(); mo.disconnect(); window.removeEventListener("resize", compute); };
  }, [entries]);
  const source = props.copyDate === date;
  const destination = !!props.copyDate && !source;
  const active = preview?.date === date;
  const minutes = items.reduce((total,item) => total + (item.planned_duration_minutes || 0), 0);
  const tests = items.reduce((total,item) => total + (item.test_count || 0), 0);
  const now = date === clock.date && clock.minutes >= PLANNER_START && clock.minutes < PLANNER_END;
  return <section ref={setDayNode} className={`ws-day-row timeline-day ${date === clock.date ? "is-today" : ""} ${source ? "is-copy-source" : ""} ${destination ? "is-copy-target" : ""} ${active ? preview.error ? "is-invalid-drop" : "is-valid-drop" : ""}`} data-date={date} tabIndex={destination ? 0 : undefined} onKeyDown={event => { if (destination && event.target === event.currentTarget && ["Enter", " "].includes(event.key)) { event.preventDefault(); props.onCopyTarget(date, day || null); } }} onClickCapture={event => { if (destination) { event.preventDefault(); event.stopPropagation(); if (!props.copyBusy) props.onCopyTarget(date, day || null); } }}>
    <header className="ws-day-row-head"><div className="ws-day-row-title"><h3>{persianDate(date)}</h3>{date === clock.date && <span className="ws-badge-today">امروز</span>}{source && <span className="planning-status">مبدأ</span>}</div><div className="ws-day-row-summary"><span>{Math.floor(minutes/60).toLocaleString("fa-IR")}:{String(minutes%60).padStart(2,"0")} برنامه</span><span>{tests.toLocaleString("fa-IR")} تست</span><span>{items.length.toLocaleString("fa-IR")} فعالیت</span></div><div className="panel-row-actions"><button className="ws-copy" aria-label={`کپی ${persianDate(date)}`} disabled={!items.length || source || props.copyBusy} onClick={event => { event.stopPropagation(); if (day) props.onCopy(day); }}><PanelIcon name="copy"/></button><button className="ws-add" onClick={event => { event.stopPropagation(); props.onAdd(date); }}>＋ افزودن باکس</button></div></header>
    <div ref={viewport} className="timeline-viewport" aria-label={`خط زمانی ${persianDate(date)}`} tabIndex={0}>
      <div className="timeline-stage" style={{ width: width + MIN_CARD_WIDTH }}>
        <div ref={trackRef} className="timeline-track" data-time-track={date} data-time-scale={scale} style={{ width, height: trackHeight, minHeight: 44 + LANE_HEIGHT, backgroundImage: `repeating-linear-gradient(to left, transparent 0, transparent ${120 * scale - 1}px, #ece5f3 ${120 * scale - 1}px, #ece5f3 ${120 * scale}px)` }}>
          <div className="timeline-ruler" aria-label="ساعت‌های روز">{Array.from({length:(PLANNER_END-PLANNER_START)/120+1},(_,index) => PLANNER_START+index*120).map(value => <span key={value} style={{right:value * scale}}>{minutesToTime(value)}</span>)}</div>
          {now && <div className="timeline-now" style={{right:clock.minutes * scale}}><span>اکنون {clock.time}</span></div>}
          {active && preview.minutes !== null && <div className={`timeline-target ${preview.error ? "is-invalid" : ""}`} style={{right:preview.minutes * scale}}><span>{preview.error || `رها کردن در ${minutesToTime(preview.minutes)}`}</span></div>}
          {entries.map(entry => <div key={entry.item.id} className={`timeline-position ${entry.conflict ? "has-conflict" : ""}`} style={{right:entry.position,top:44,width:entry.width}}><DraggableActivity item={entry.item} date={date} pending={props.pending.has(entry.item.id)} actions={props} disabled={!!props.copyDate} placement={!entry.item.start_time ? `شناور · ${minutesToTime(entry.start)}${entry.conflict ? " · تداخل" : ""}` : entry.conflict ? "تداخل زمانی · جایگاه نمایشی" : ""}/></div>)}
          {!entries.length && <p className="timeline-empty">برای شروع، یک فعالیت اضافه کنید.</p>}
        </div>
      </div>
    </div>
    {destination && <span className="timeline-copy-hint">برای افزودن فعالیت‌های مبدأ، روی هر قسمت این روز کلیک کنید.</span>}
  </section>;
}

export default function TimelineBoard(props: Props) {
  const [activeItem, setActiveItem] = useState<PlanItem | null>(null);
  const [preview, setPreview] = useState<Target | null>(null);
  const [clock,setClock] = useState(tehranClock);
  const pointer = useRef<{x:number;y:number} | null>(null);
  const sensors = useSensors(useSensor(PlannerPointerSensor,{activationConstraint:{distance:6}}),useSensor(TouchSensor,{activationConstraint:{delay:300,tolerance:6}}),useSensor(KeyboardSensor,{coordinateGetter:(event,{currentCoordinates}) => { const track = document.elementFromPoint(currentCoordinates.x, currentCoordinates.y)?.closest(".timeline-day")?.querySelector<HTMLElement>("[data-time-scale]"); const delta = SNAP_MINUTES * Number(track?.dataset.timeScale || PIXELS_PER_MINUTE); if (event.code === "ArrowLeft") return {...currentCoordinates,x:currentCoordinates.x-delta}; if (event.code === "ArrowRight") return {...currentCoordinates,x:currentCoordinates.x+delta}; if (event.code === "ArrowUp") return {...currentCoordinates,y:currentCoordinates.y-25}; if (event.code === "ArrowDown") return {...currentCoordinates,y:currentCoordinates.y+25}; return undefined; }}));
  useEffect(() => { const timer = setInterval(() => setClock(tehranClock()),60000); return () => clearInterval(timer); },[]);
  useEffect(() => {
    const track = (event: PointerEvent | TouchEvent) => { const point = "touches" in event ? event.touches[0] : event; if(point) pointer.current={x:point.clientX,y:point.clientY}; };
    window.addEventListener("pointermove",track,{passive:true}); window.addEventListener("touchmove",track,{passive:true});
    return () => { window.removeEventListener("pointermove",track); window.removeEventListener("touchmove",track); };
  },[]);
  function target(event: DragMoveEvent | DragEndEvent): Target | null {
    const data = event.over?.data.current; const item = event.active.data.current?.item as PlanItem | undefined;
    if (!data || !item) return null;
    const date = data.date as string;
    if (!data.scheduled) return {date,minutes:null,ordering: data.ordering === undefined ? undefined : data.ordering - (event.active.data.current?.date === date && item.ordering < data.ordering ? 1 : 0)};
    const track = document.querySelector<HTMLElement>(`[data-time-track="${date}"]`);
    if (!track) return null;
    const keyboard = event.activatorEvent instanceof KeyboardEvent;
    const rect = track.getBoundingClientRect();
    const x = !keyboard && pointer.current ? pointer.current.x : (event.active.rect.current.translated?.right || rect.right);
    const minutes = timeFromClientX(x,{right:rect.right,width:1440 * Number(track.dataset.timeScale)},itemDuration(item));
    return {date,minutes,error:dropConflict(item,minutes,props.days.find(day=>day.date===date)?.items || [],props.commitments,date)};
  }
  return <DndContext sensors={sensors} collisionDetection={args => { const hits = pointerWithin(args); return hits.length ? hits : rectIntersection(args); }} autoScroll onDragStart={event => { const point = event.activatorEvent as PointerEvent; pointer.current=typeof point.clientX === "number" ? {x:point.clientX,y:point.clientY} : null; setActiveItem(event.active.data.current?.item as PlanItem); }} onDragMove={event=>setPreview(target(event))} onDragOver={event=>setPreview(target(event))} onDragCancel={()=>{setActiveItem(null);setPreview(null);}} onDragEnd={event=>{const destination=target(event);const item=event.active.data.current?.item as PlanItem;setActiveItem(null);setPreview(null);if(destination) void props.onDrop(item,destination);}} accessibility={{screenReaderInstructions:{draggable:"برای جابه‌جایی کلید فاصله را بزنید، با پیکان‌ها حرکت کنید و برای رها کردن دوباره فاصله را بزنید. Escape لغو می‌کند. انتقال به روز و ساعت دیگر از منوی فعالیت نیز در دسترس است."}}}>
    <div className="ws-stack">{props.dates.map(date=><TimelineDay key={date} date={date} day={props.days.find(day=>day.date===date)} clock={clock} preview={preview} props={props}/>)}</div>
    <DragOverlay dropAnimation={null}>{activeItem && <div className="timeline-overlay"><strong>{activeItem.subject_name || activeItem.title}</strong><span>{preview?.error || (preview?.minutes != null ? `${persianDate(preview.date)} · ${minutesToTime(preview.minutes)}` : "روز و ساعت مقصد را انتخاب کنید")}</span></div>}</DragOverlay>
  </DndContext>;
}
