"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { applyStudentFixed, commitmentLabel, type Commitment, type SchoolSlot, WEEKDAY_ORDER } from "@/lib/planning";
import { planningApi } from "./planningApi";
import { apiErrorMessage } from "./planningFeedback";
import ApplyFixedButton from "./ApplyFixedButton";
import { IconButton } from "@/components/counselor/PanelUI";

const WEEKDAY_LABEL: Record<number, string> = { 5: "شنبه", 6: "یکشنبه", 0: "دوشنبه", 1: "سه‌شنبه", 2: "چهارشنبه", 3: "پنج‌شنبه", 4: "جمعه" };
const KIND_OPTIONS: { value: Commitment["kind"]; label: string }[] = [
  { value: "CLASS", label: "کلاس" },
  { value: "SPORTS", label: "باشگاه" },
  { value: "COMMUTE", label: "رفت‌وآمد" },
  { value: "OTHER", label: "سایر" },
];

function timeToMins(t: string) { const [h,m]=t.split(":").map(Number); return h*60+m; }
function minsToTime(m: number){ const total = ((m % (24*60)) + 24*60) % (24*60); return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`; }
function durationLabel(mins:number){ if(mins===90) return "۹۰ دقیقه"; if(mins===45) return "۴۵ دقیقه"; return `${mins} دقیقه`; }

type FixedEvent = { id: number; student: number; title: string; date: string; start_time: string; end_time: string; active: boolean };
const DAY_TABS = WEEKDAY_ORDER as unknown as number[];

export default function FixedSchedulePanel({ token, studentId, commitments, schoolSlots, onRefresh: refreshSources, planId }: { token: string; studentId: string; commitments: Commitment[]; schoolSlots: SchoolSlot[]; onRefresh: () => void | Promise<void>; planId?: number }) {
  const client = useMemo(() => planningApi(token), [token]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const sid = Number(studentId);
  const [section, setSection] = useState<"school"|"events">("school");

  const schoolCommits = commitments.filter(c=>c.kind==="SCHOOL");
  const otherCommits = commitments.filter(c=>c.kind!=="SCHOOL");

  // Which days are school days (has SCHOOL commitment)
  const schoolDays = useMemo(()=> new Set(schoolCommits.filter(c=>c.active).map(c=>c.weekday)), [schoolCommits]);
  const [activeDay, setActiveDay] = useState<number>(5);
  const [periodPreset, setPeriodPreset] = useState<"45"|"90"|"custom">("90");
  const [breakMins, setBreakMins] = useState<number>(10);
  const [slotsDraft, setSlotsDraft] = useState<{period:number; subject_name:string; start_time:string; end_time:string}[]>([]);
  const [saving, setSaving] = useState(false);
  const [copySource, setCopySource] = useState<number|null>(null);
  const [copyTargets, setCopyTargets] = useState<number[]>([]);
  const [events, setEvents] = useState<FixedEvent[]>([]);
  const [resyncNote, setResyncNote] = useState<string>("");
  const [evDay, setEvDay] = useState<number>(5);
  const [evTitle, setEvTitle] = useState("");
  const [evStart, setEvStart] = useState("17:00");
  const [evEnd, setEvEnd] = useState("18:30");

  // other recurring
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Commitment["kind"]>("CLASS");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("20:00");

  async function onRefresh() {
    await refreshSources();
    try {
      const result = await applyStudentFixed(token, sid, planId);
      const conflicts = result.skipped.filter(item => item.reason === "conflict").length;
      setResyncNote(conflicts ? `برنامه همگام شد؛ ${conflicts} مورد به‌دلیل تداخل اضافه نشد.` : "برنامه با تغییرات همگام شد.");
    } catch (error) { setError(`تغییرات ثابت ذخیره شد؛ ${apiErrorMessage(error)}`); }
  }

  function notify(msg:string){ setNotice(msg); setTimeout(()=>setNotice(""),2500); }

  useEffect(()=>{
    const normalize = (v: unknown): FixedEvent[] => {
      if (Array.isArray(v)) return v as FixedEvent[];
      if (v && typeof v === "object" && "results" in (v as Record<string, unknown>)) return ((v as Record<string, unknown>).results as FixedEvent[]) ?? [];
      return [];
    };
    api<FixedEvent[] | {results: FixedEvent[]}>(`/planning/fixed-events/?student=${sid}`, token).catch(async()=>{ const{allPages}=await import("@/lib/api"); return allPages<FixedEvent>(`/planning/fixed-events/?student=${sid}`, token);}).then(v=> setEvents(normalize(v))).catch(()=> setEvents([]));
  },[sid, token, commitments]);

  // infer preset from loaded slots when switching day (detect 45 vs 90 vs custom)
  function inferPreset(slots: {start_time?: string | null; end_time?: string | null}[]): "45"|"90"|"custom" {
    if(!slots.length) return "90";
    const diffs = slots.filter(s=> s.start_time && s.end_time).map(s=> timeToMins(s.end_time!.slice(0,5)) - timeToMins(s.start_time!.slice(0,5)));
    if(!diffs.length) return "90";
    const all45 = diffs.every(d=> d===45);
    const all90 = diffs.every(d=> d===90);
    if(all45) return "45";
    if(all90) return "90";
    return "custom";
  }

  // Load slots for activeDay - sequential
  useEffect(()=>{
    const slots = schoolSlots.filter(s=>s.weekday===activeDay).sort((a,b)=>a.period-b.period);
    if(slots.length){
      const preset = inferPreset(slots);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPeriodPreset(preset);
      if(preset !== "custom"){
        // infer break from gap between first two
        if(slots.length>=2 && slots[0].end_time && slots[1].start_time){
          const gap = timeToMins(slots[1].start_time.slice(0,5)) - timeToMins(slots[0].end_time.slice(0,5));
          if(gap>=5 && gap<=20) setBreakMins(gap);
        }
      }
      setSlotsDraft(slots.map(s=>({period:s.period, subject_name:s.subject_name, start_time: s.start_time?.slice(0,5)||"07:30", end_time: (s.end_time as string|null)?.slice(0,5) || minsToTime(timeToMins(s.start_time?.slice(0,5)||"07:30")+(preset==="90"?90:45))})));
    } else {
       
      // new day empty -> default 90 min first period
      setSlotsDraft([{period:1, subject_name:"", start_time:"07:30", end_time:"09:00"}]);
    }
  },[activeDay, schoolSlots]);

  const isSchool = schoolDays.has(activeDay);
  const schoolCommitForDay = schoolCommits.find(c=>c.weekday===activeDay);

  async function toggleSchoolDay(day:number){
    const has = schoolDays.has(day);
    try{
      if(has){
        const c = schoolCommits.find(x=>x.weekday===day);
        if(!c) return;
        if(!confirm(`${WEEKDAY_LABEL[day]} از روزهای مدرسه حذف شود؟ (زنگ‌ها نیز حذف می‌شوند)`)) return;
        // optimistic: clear locally so plan feels instant; then sync
        const prevSlots = [...schoolSlots];
        // immediate local prune for snappy UI (will be corrected by refresh)
        // do delete on server
        await api<void>(`/planning/commitments/${c.id}/`, token, "DELETE");
        const slotsToClear = prevSlots.filter(x=>x.weekday===day);
        for(const s of slotsToClear) await api<void>(`/planning/school-slots/${s.id}/`, token, "DELETE").catch(()=>{});
        setSlotsDraft([{period:1, subject_name:"", start_time:"07:30", end_time:"09:00"}]);
        await onRefresh();
        notify("روز از مدرسه حذف شد.");
      } else {
        await client.schoolHours({student:sid, weekdays:[day], start_time:"07:30", end_time:"13:30", title:"مدرسه"});
        await onRefresh();
      }
    }catch(e){ setError(apiErrorMessage(e)); }
  }
function applySequential(list:{period:number; subject_name:string; start_time:string; end_time:string}[], dur:number, gap:number){
    let cur = timeToMins("07:30");
    return list.map((z, i)=>{
      const s = i===0 ? "07:30" : minsToTime(cur+gap);
      const e = minsToTime(timeToMins(s)+dur);
      cur = timeToMins(e);
      return {...z, start_time: s, end_time: e, period: i+1};
    });
  }

  function addZang(){
    if(periodPreset==="custom"){
      const last = slotsDraft[slotsDraft.length-1];
      let nextStart = "07:30";
      if(last?.end_time) nextStart = minsToTime(timeToMins(last.end_time)+10);
      else if(last?.start_time) nextStart = minsToTime(timeToMins(last.start_time)+60);
      const nextEnd = minsToTime(timeToMins(nextStart)+45);
      setSlotsDraft([...slotsDraft, {period: slotsDraft.length+1, subject_name:"", start_time: nextStart, end_time: nextEnd}]);
    } else {
      const dur = periodPreset==="90" ? 90 : 45;
      const gap = breakMins;
      const next = applySequential([...slotsDraft, {period: slotsDraft.length+1, subject_name:"", start_time:"", end_time:""}], dur, gap);
      setSlotsDraft(next);
    }
  }

  function handlePresetChange(next: "45"|"90"|"custom"){
    setPeriodPreset(next);
    if(next!=="custom"){
      const dur = next==="90" ? 90 : 45;
      setSlotsDraft(cur => applySequential(cur, dur, breakMins));
    }
  }
  function handleBreakChange(gap:number){
    setBreakMins(gap);
    if(periodPreset!=="custom"){
      const dur = periodPreset==="90" ? 90 : 45;
      setSlotsDraft(cur => applySequential(cur, dur, gap));
    }
  }

  async function saveSlots(){
    if(!isSchool){ setError("ابتدا این روز را به روزهای مدرسه اضافه کنید."); return; }
    const filled = slotsDraft.filter(z=> z.subject_name.trim()).map(z=>({weekday:activeDay, period:z.period, subject_name:z.subject_name.trim(), start_time: z.start_time, end_time: z.end_time}));
    if(!filled.length){ setError("حداقل یک زنگ با نام درس پر کنید."); return; }
    // basic time validation for custom
    for(const f of filled){
      if(!f.start_time || !f.end_time){ setError("ساعت شروع و پایان هر زنگ را وارد کنید."); return; }
      if(timeToMins(f.end_time) <= timeToMins(f.start_time)){ setError(`ساعت پایان «${f.subject_name}» باید بعد از شروع باشد.`); return; }
    }
    setSaving(true); setError("");
    try{
      const toDelete = schoolSlots.filter(s=>s.weekday===activeDay);
      const keep = new Set(filled.map(f=>f.period));
      for(const s of toDelete) if(!keep.has(s.period)) await api<void>(`/planning/school-slots/${s.id}/`, token, "DELETE");
      await client.bulkSchoolSlots({student:sid, slots: filled as never});
      notify("زنگ‌ها ذخیره شد."); await onRefresh();
    }catch(e){ setError(apiErrorMessage(e)); } finally{ setSaving(false); }
  }

  async function doCopy(){
    if(copySource===null||!copyTargets.length) return;
    try{
      await api(`/planning/commitments/copy-school-day/`, token, "POST", {student:sid, source_weekday: copySource, target_weekdays: copyTargets});
      notify("کپی انجام شد."); setCopySource(null); setCopyTargets([]); await onRefresh();
    }catch(e){
      const msg = apiErrorMessage(e);
      if(msg.includes("تأیید")|| (e as Error).message.includes("NEEDS_CONFIRM")){
        if(confirm("مقصد برنامه دارد — جایگزین شود؟")){ try{ await api(`/planning/commitments/copy-school-day/`, token, "POST", {student:sid, source_weekday: copySource, target_weekdays: copyTargets, force:true}); notify("کپی شد."); setCopySource(null); setCopyTargets([]); await onRefresh(); }catch(e2){ setError(apiErrorMessage(e2)); }}
      } else setError(msg);
    }
  }

  async function submitEvent(){
    if(!evTitle.trim()){ setError("عنوان رویداد را وارد کنید."); return; }
    // map evDay to a date: use next occurrence of that weekday for recurring-like? Instead use picker hidden: we store as weekday-based? For dated events, spec says date-based but UI is day tabs; we pick next occurrence within current week window.
    // Simplify: create a dated event for next occurrence of evDay
    const today = new Date();
    const target = new Date(today);
    const diff = (evDay - target.getDay() + 7) % 7;
    target.setDate(today.getDate()+diff);
    const iso = `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,"0")}-${String(target.getDate()).padStart(2,"0")}`;
    try{ await api(`/planning/fixed-events/`, token, "POST", {student:sid, title:evTitle.trim(), date: iso, start_time: evStart, end_time: evEnd}); setEvTitle(""); notify("رویداد ثبت شد."); const raw= await api<FixedEvent[] | {results: FixedEvent[]}>(`/planning/fixed-events/?student=${sid}`, token).catch(async()=>{ const{allPages}=await import("@/lib/api"); return allPages<FixedEvent>(`/planning/fixed-events/?student=${sid}`, token);}); const r = Array.isArray(raw) ? raw : (raw as {results: FixedEvent[]}).results ?? []; setEvents(r); await onRefresh(); }catch(e){ setError(apiErrorMessage(e)); }
  }

  async function submitRecurring(){
    if(!title.trim()||!weekdays.length){ setError("عنوان و روزها الزامی است."); return; }
    try{
      if(weekdays.length===1) await client.createCommitment({student:sid, kind, title:title.trim(), weekday:weekdays[0], start_time:start, end_time:end});
      else await client.batchCommitment({student:sid, kind, title:title.trim(), weekdays, start_time:start, end_time:end});
      setTitle(""); setWeekdays([]); notify("فعالیت ثابت ثبت شد."); await onRefresh();
    }catch(e){ setError(apiErrorMessage(e)); }
  }

  const grouped = useMemo(()=>{
    const m=new Map<string, Commitment[]>();
    for(const c of otherCommits){ const k=c.group_id||`s:${c.id}`; if(!m.has(k)) m.set(k,[]); m.get(k)!.push(c); }
    return [...m.values()];
  },[otherCommits]);
  const dayEvents = (Array.isArray(events) ? events : []).filter(e=> new Date(e.date).getDay()===activeDay);

  return (
    <section style={{background:"white", border:"1px solid #e7e1ec", borderRadius:12, padding:12, display:"grid", gap:12}} dir="rtl">
      <ApplyFixedButton token={token} studentId={sid} planId={planId} onApplied={refreshSources} />
      <div style={{display:"flex", gap:8, alignItems:"center"}}>
        <button onClick={()=>setSection("school")} style={{padding:"6px 12px", borderRadius:8, border: section==="school"?"1px solid #5B0FAD":"1px solid #e7e1ec", background: section==="school"?"#f6f1fb":"white", color: section==="school"?"#5B0FAD":"#16041E"}}>برنامه مدرسه</button>
        <button onClick={()=>setSection("events")} style={{padding:"6px 12px", borderRadius:8, border: section==="events"?"1px solid #5B0FAD":"1px solid #e7e1ec", background: section==="events"?"#f6f1fb":"white", color: section==="events"?"#5B0FAD":"#16041E"}}>رویدادها و فعالیت‌ها</button>
      </div>
      {error && <p style={{color:"#a12626", background:"#fef2f2", border:"1px solid #fecaca", padding:"6px 10px", borderRadius:8, fontSize:12}} role="alert">{error}</p>}
      {notice && <p style={{color:"#065f46", background:"#ecfdf5", border:"1px solid #a7f3d0", padding:"6px 10px", borderRadius:8, fontSize:12}}>{notice}</p>}
      {resyncNote && <p style={{color:"#664400", background:"#fffbeb", border:"1px solid #fde68a", padding:"6px 10px", borderRadius:8, fontSize:11}} role="status">{resyncNote}</p>}

      {section==="school" ? (
        <>
          {/* Day tabs */}
          <div style={{display:"flex", gap:6, overflowX:"auto", paddingBottom:4}}>
            {DAY_TABS.map(wd=>(
              <button key={wd} onClick={()=>setActiveDay(wd)} style={{padding:"6px 10px", borderRadius:8, border: activeDay===wd?"1px solid #5B0FAD":"1px solid #e7e1ec", background: activeDay===wd?"#5B0FAD":"white", color: activeDay===wd?"white":"#16041E", fontSize:12, whiteSpace:"nowrap", opacity: schoolDays.has(wd)?1:0.7}}>
                {WEEKDAY_LABEL[wd]} {schoolDays.has(wd)?"· مدرسه":""}
              </button>
            ))}
          </div>

          {/* Active day header with icon actions */}
          <div style={{display:"flex", gap:8, alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", background:"#faf9fc", border:"1px solid #e7e1ec", borderRadius:8, padding:"8px 10px"}}>
            <strong style={{fontSize:13}}>{WEEKDAY_LABEL[activeDay]} {isSchool? "· مدرسه":"· بدون مدرسه"} {schoolCommitForDay? `· ${schoolCommitForDay.start_time.slice(0,5)} تا ${schoolCommitForDay.end_time.slice(0,5)}`: ""}</strong>
            <div style={{display:"flex", gap:4, alignItems:"center"}}>
              <IconButton icon="copy" label="کپی برنامه این روز" onClick={()=>{ setCopySource(activeDay); setCopyTargets([]);}} />
              <IconButton icon={isSchool?"trash":"plus"} label={isSchool?"حذف روز از مدرسه":"افزودن به روزهای مدرسه"} onClick={()=>toggleSchoolDay(activeDay)} variant={isSchool?"danger":undefined} />
            </div>
          </div>

          {copySource!==null && (
            <div style={{border:"1px solid #d9c6ec", background:"#fcfaff", borderRadius:8, padding:8, display:"grid", gap:6}}>
              <span style={{fontSize:11}}>کپی از {WEEKDAY_LABEL[copySource]} به:</span>
              <div style={{display:"flex", flexWrap:"wrap", gap:6}}>{DAY_TABS.filter(w=>w!==copySource).map(wd=> <button key={wd} onClick={()=> setCopyTargets(v=> v.includes(wd)? v.filter(x=>x!==wd): [...v, wd])} style={{padding:"4px 8px", borderRadius:6, border: copyTargets.includes(wd)?"1px solid #5B0FAD":"1px solid #e7e1ec", background: copyTargets.includes(wd)?"#f6f1fb":"white", fontSize:12}}>{WEEKDAY_LABEL[wd]}</button>)}</div>
              <div style={{display:"flex", gap:6}}><button onClick={doCopy} disabled={!copyTargets.length} style={{background:"#5B0FAD", color:"white", borderRadius:6, padding:"6px 12px", fontSize:12}}>تأیید کپی</button><button onClick={()=>{setCopySource(null); setCopyTargets([]);}} style={{border:"1px solid #e7e1ec", borderRadius:6, padding:"6px 12px", fontSize:12}}>لغو</button></div>
            </div>
          )}

          {/* Zang table - user-friendly: click-to-type, no edit button */}
          {isSchool ? (
            <div style={{display:"grid", gap:8}}>
              <div style={{display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", background:"#f6f1fb", border:"1px solid #e7e1ec", borderRadius:8, padding:"8px 10px"}}>
                <span style={{fontSize:11, fontWeight:700}}>طول هر زنگ:</span>
                <button type="button" onClick={()=>handlePresetChange("90")} style={{padding:"5px 10px", borderRadius:20, border: periodPreset==="90"?"1px solid #5B0FAD":"1px solid #e7e1ec", background: periodPreset==="90"?"#5B0FAD":"white", color: periodPreset==="90"?"white":"#16041E", fontSize:11, fontWeight:700}}>۱:۳۰ (۹۰ دقیقه)</button>
                <button type="button" onClick={()=>handlePresetChange("45")} style={{padding:"5px 10px", borderRadius:20, border: periodPreset==="45"?"1px solid #5B0FAD":"1px solid #e7e1ec", background: periodPreset==="45"?"#5B0FAD":"white", color: periodPreset==="45"?"white":"#16041E", fontSize:11, fontWeight:700}}>۴۵ دقیقه</button>
                <button type="button" onClick={()=>handlePresetChange("custom")} style={{padding:"5px 10px", borderRadius:20, border: periodPreset==="custom"?"1px solid #5B0FAD":"1px solid #e7e1ec", background: periodPreset==="custom"?"#5B0FAD":"white", color: periodPreset==="custom"?"white":"#16041E", fontSize:11}}>دلخواه</button>
                {periodPreset!=="custom" && (<><span style={{fontSize:11, color:"#706578"}}>· زنگ تفریح:</span><select value={breakMins} onChange={e=>handleBreakChange(Number(e.target.value))} style={{fontSize:11, border:"1px solid #e7e1ec", borderRadius:6, padding:"2px 6px"}}><option value={5}>۵ دقیقه</option><option value={10}>۱۰ دقیقه</option><option value={15}>۱۵ دقیقه</option></select></>)}
                <span style={{fontSize:11, color:"#706578"}}>{periodPreset==="custom" ? "زمان‌ها دستی — روی ساعت کلیک کنید" : `شروع ۰۷:۳۰ · ${periodPreset==="90"?"۹۰": "۴۵"} دقیقه هر زنگ`}</span>
              </div>
              <div style={{display:"grid", gridTemplateColumns:"32px 1fr 96px 96px 28px", gap:6, background:"#faf9fc", padding:"6px 8px", fontSize:11, fontWeight:700, borderRadius:8, border:"1px solid #e7e1ec"}}><span>#</span><span>درس / زنگ</span><span>شروع</span><span>پایان</span><span></span></div>
              {slotsDraft.map((z,i)=>(
                <div key={i} style={{display:"grid", gridTemplateColumns:"32px 1fr 96px 96px 28px", gap:6, alignItems:"center"}}>
                  <span style={{width:26, height:26, display:"grid", placeItems:"center", background:"#f6f1fb", border:"1px solid #e7e1ec", borderRadius:6, fontSize:11, fontWeight:700}}>{i+1}</span>
                  <input value={z.subject_name} onChange={e=> setSlotsDraft(v=> v.map((x,idx)=> idx===i? {...x, subject_name:e.target.value}:x))} placeholder="نام درس — کلیک و تایپ" style={{width:"100%", padding:"6px 8px", border:"1px solid #e7e1ec", borderRadius:8, fontSize:12, background:"white"}} />
                  {periodPreset==="custom" ? (
                    <>
                      <input type="time" value={z.start_time} onChange={e=> setSlotsDraft(v=> v.map((x,idx)=> idx===i? {...x, start_time:e.target.value}:x))} style={{padding:"4px 6px", border:"1px solid #e7e1ec", borderRadius:8, fontSize:11}} />
                      <input type="time" value={z.end_time} onChange={e=> setSlotsDraft(v=> v.map((x,idx)=> idx===i? {...x, end_time:e.target.value}:x))} style={{padding:"4px 6px", border:"1px solid #e7e1ec", borderRadius:8, fontSize:11}} />
                    </>
                  ) : (
                    <>
                      <span style={{fontSize:11, textAlign:"center", padding:"6px", border:"1px solid #f0e8f7", borderRadius:8, background:"#fcfaff"}}>{z.start_time}</span>
                      <span style={{fontSize:11, textAlign:"center", padding:"6px", border:"1px solid #f0e8f7", borderRadius:8, background:"#fcfaff"}}>{z.end_time} <small style={{color:"#706578"}}>· {durationLabel(timeToMins(z.end_time)-timeToMins(z.start_time))}</small></span>
                    </>
                  )}
                  <button type="button" aria-label="حذف زنگ" onClick={()=> setSlotsDraft(v=> { const next=v.filter((_,idx)=>idx!==i).map((x,idx)=>({...x, period: idx+1})); if(periodPreset!=="custom"){ const dur=periodPreset==="90"?90:45; return applySequential(next, dur, breakMins);} return next;})} style={{width:28, height:28, border:"1px solid #fecaca", background:"#fff", color:"#c0392b", borderRadius:6, fontSize:14, lineHeight:"1"}}>×</button>
                </div>
              ))}
              <div style={{display:"flex", gap:8, alignItems:"center"}}><button type="button" onClick={addZang} style={{background:"white", border:"1px dashed #c9b6e0", color:"#5B0FAD", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700}}>+ افزودن زنگ</button><span style={{fontSize:11, color:"#706578"}}>{periodPreset==="custom" ? "در حالت دلخواه زمان‌ها آزاد است" : `حالت ${periodPreset==="90"?"۹۰دقیقه‌ای":"۴۵دقیقه‌ای"} — افزایش خودکار زمان‌ها`}</span></div>
              <div style={{display:"flex", gap:8}}><button onClick={saveSlots} disabled={saving} style={{background:"#5B0FAD", color:"white", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:700}}>{saving?"در حال ذخیره…":"ذخیره زنگ‌ها"}</button><span style={{fontSize:11, color:"#706578", alignSelf:"center"}}>تغییر طول، زمان همه زنگ‌ها را مرتب می‌کند</span></div>
            </div>
          ) : (
            <p style={{fontSize:12, color:"#706578"}}>این روز مدرسه ندارد — برای افزودن زنگ، ابتدا آن را به روزهای مدرسه اضافه کنید.</p>
          )}
        </>
      ) : (
        <div style={{display:"grid", gap:12}}>
          {/* Day tabs for events */}
          <div style={{display:"flex", gap:6, overflowX:"auto", paddingBottom:4}}>
            {DAY_TABS.map(wd=> <button key={wd} onClick={()=>setEvDay(wd)} style={{padding:"6px 10px", borderRadius:8, border: evDay===wd?"1px solid #5B0FAD":"1px solid #e7e1ec", background: evDay===wd?"#5B0FAD":"white", color: evDay===wd?"white":"#16041E", fontSize:12}}>{WEEKDAY_LABEL[wd]}</button>)}
          </div>
          <div style={{display:"flex", gap:6, flexWrap:"wrap", alignItems:"end"}}>
            <label style={{display:"grid", gap:4, fontSize:11}}>عنوان<input value={evTitle} onChange={e=>setEvTitle(e.target.value)} placeholder="جلسه" style={{minWidth:120}} /></label>
            <label style={{display:"grid", gap:4, fontSize:11}}>شروع<input type="time" value={evStart} onChange={e=>setEvStart(e.target.value)} /></label>
            <label style={{display:"grid", gap:4, fontSize:11}}>پایان<input type="time" value={evEnd} onChange={e=>setEvEnd(e.target.value)} /></label>
            <button onClick={submitEvent} style={{background:"#5B0FAD", color:"white", borderRadius:8, padding:"6px 12px", fontSize:12}}>ثبت برای {WEEKDAY_LABEL[evDay]}</button>
          </div>
          {dayEvents.length>0 && <div style={{display:"grid", gap:6}}>{dayEvents.map(ev=> <div key={ev.id} style={{display:"flex", justifyContent:"space-between", gap:6, border:"1px solid #e7e1ec", borderRadius:6, padding:"6px 8px", fontSize:12}}><span>{ev.title} · {ev.start_time.slice(0,5)}-{ev.end_time.slice(0,5)}</span><IconButton icon="trash" label="حذف رویداد" variant="danger" onClick={async()=>{ if(confirm("حذف شود؟")){ await api(`/planning/fixed-events/${ev.id}/`, token, "DELETE"); setEvents(events.filter(x=>x.id!==ev.id)); await onRefresh();}}} /></div>)}</div>}

          <div style={{display:"grid", gap:6, background:"#faf9fc", border:"1px solid #e7e1ec", borderRadius:8, padding:8}}>
            <strong style={{fontSize:12}}>فعالیت تکرارشونده (مثل باشگاه)</strong>
            <div style={{display:"flex", gap:6, flexWrap:"wrap"}}><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="باشگاه" style={{flex:"1 1 120px"}} /><select value={kind} onChange={e=>setKind(e.target.value as Commitment["kind"])} style={{fontSize:12}}>{KIND_OPTIONS.map(o=> <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div style={{display:"flex", flexWrap:"wrap", gap:4}}>{DAY_TABS.map(wd=> <button key={wd} onClick={()=> setWeekdays(v=> v.includes(wd)? v.filter(x=>x!==wd): [...v, wd])} style={{padding:"4px 8px", borderRadius:6, border: weekdays.includes(wd)?"1px solid #5B0FAD":"1px solid #e7e1ec", background: weekdays.includes(wd)?"#f6f1fb":"white", fontSize:11}}>{WEEKDAY_LABEL[wd]}</button>)}</div>
            <div style={{display:"flex", gap:6}}><input type="time" value={start} onChange={e=>setStart(e.target.value)} /><input type="time" value={end} onChange={e=>setEnd(e.target.value)} /><button onClick={submitRecurring} style={{background:"#5B0FAD", color:"white", borderRadius:6, padding:"6px 12px", fontSize:12}}>ثبت</button></div>
          </div>
          {grouped.length>0 && <div style={{display:"grid", gap:6}}>{grouped.map(g=>{ const rep=g[0]; return <div key={rep.group_id||rep.id} style={{display:"flex", justifyContent:"space-between", gap:6, border:"1px solid #e7e1ec", borderRadius:6, padding:"6px 8px", fontSize:11, opacity: rep.active?1:0.6}}><span>{rep.title} · {g.map(c=>WEEKDAY_LABEL[c.weekday]).join("، ")} {rep.start_time.slice(0,5)}-{rep.end_time.slice(0,5)} · {commitmentLabel[rep.kind]}</span><IconButton icon="trash" label="حذف" variant="danger" onClick={async()=>{ if(confirm("حذف شود؟")){ if(rep.group_id) await client.groupDelete(rep.group_id); else await api<void>(`/planning/commitments/${rep.id}/`, token, "DELETE"); await onRefresh();}}} /></div>;})}</div>}
        </div>
      )}
    </section>
  );
}
