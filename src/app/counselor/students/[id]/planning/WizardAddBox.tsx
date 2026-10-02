"use client";
import { useRef, useState } from "react";
import { planningApi, type ItemInput } from "./planningApi";
import { persianDate, type PlanItem } from "@/lib/planning";
import type { AcademicTree } from "@/lib/academicTree";
import { PanelIcon, useDialogFocus } from "@/components/counselor/PanelUI";
import { apiErrorMessage } from "./planningFeedback";

function toFa(s: string) { return s.replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]); }

export default function WizardAddBox({ token, dayId, ordering, tree, onCreated, onError, onCancel, date }: { date: string; token: string; dayId: number; ordering: number; tree: AcademicTree; onCreated: (item: PlanItem) => Promise<void>; onError:(m:string)=>void; onCancel:()=>void }) {
  const submitting = useRef(false);
  function cancel() { if (!submitting.current) onCancel(); }
  useDialogFocus(true, cancel);
  const [stepKey, setStepKey] = useState("kind");
  const [localError, setLocalError] = useState("");
  const [kind, setKind] = useState<PlanItem["kind"] | null>(null);
  const [subject, setSubject] = useState<string>("");
  const [chapter, setChapter] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
  const [duration, setDuration] = useState<string>("60");
  const [testCount, setTestCount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [activityTitle, setActivityTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const chapters = subject ? tree.chapters.filter(c=> String(c.subject)===subject) : [];
  const topics = chapter ? tree.topics.filter(t=> String(t.chapter)===chapter) : [];
  // Dynamic steps: kind -> subject (if academic) -> chapter/topic -> duration -> testCount (if TEST) -> confirm
  // Build step list
  const steps: {key:string; optional?:boolean}[] = [];
  steps.push({key:"kind"});
  if (kind && kind!=="EVENT") steps.push({key:"subject"});
  if (kind && kind!=="EVENT" && subject && chapters.length>0) steps.push({key:"chapter", optional: true});
  if (kind && kind!=="EVENT" && chapter && topics.length>0) steps.push({key:"topic", optional: true});
  steps.push({key:"duration"});
  if (kind==="TEST") steps.push({key:"testCount"});
  steps.push({key:"confirm"});
  const step = Math.max(0, steps.findIndex(item => item.key === stepKey));
  const cur = steps[step]?.key;
  const total = steps.length;
  const progress = ((step+1)/total)*100;

  function next(){ if(step < total-1) setStepKey(steps[step+1].key); }
  function prev(){ if(step>0) setStepKey(steps[step-1].key); }

  async function create(){
    if(submitting.current) return;
    submitting.current = true; setBusy(true); setLocalError("");
    const payload: ItemInput = {
      plan_day: dayId, kind: kind!, ordering, title: activityTitle.trim(), planned_duration_minutes: duration ? Number(duration):null, start_time: null, end_time: null, note: note || "",
      subject: subject ? Number(subject):null, chapter: chapter ? Number(chapter):null, topic: topic ? Number(topic):null,
      test_count: kind==="TEST" ? (testCount ? Number(testCount):null) : null,
    };
    try { const item = await planningApi(token).createItem(payload); await onCreated(item); } catch(reason){ const message = apiErrorMessage(reason); setLocalError(message); onError(message); } finally { submitting.current = false; setBusy(false); }
  }

  // Keyboard support
  function handleKey(e: React.KeyboardEvent){ if(e.key==="Escape") cancel(); }

  return (
    <div className="ws-wizard" role="dialog" aria-modal="true" aria-label={`افزودن فعالیت · ${persianDate(date)}`} onKeyDown={handleKey} onClick={cancel}>
      <div className="ws-wizard-card" onClick={e=>e.stopPropagation()}>
        <div className="ws-wizard-head">
          <div><p className="workspace-eyebrow">{persianDate(date)} · افزودن فعالیت</p><span className="ws-wizard-step">مرحله {toFa(String(step+1))} از {toFa(String(total))}</span></div>
          <button type="button" className="ws-subtle" aria-label="بستن افزودن فعالیت" onClick={cancel}><PanelIcon name="close"/></button>
        </div>
        {localError && <p className="ws-error" role="alert">{localError}</p>}
        <div className="ws-wizard-progress"><span style={{width: `${progress}%`}} /></div>

        {cur==="kind" && (
          <div className="ws-wizard-options" aria-label="نوع باکس">
            <p className="ws-wizard-title">نوع باکس را انتخاب کن</p>
            {(["STUDY","TEST","REVIEW","EXAM","EVENT"] as const).map(k=> (
              <button key={k} type="button" className={`ws-wizard-option ${kind===k?"is-selected":""}`} onClick={()=>{ setKind(k); setSubject(""); setChapter(""); setTopic(""); setStepKey(k === "EVENT" ? "duration" : "subject"); }}>{k==="STUDY"?"مطالعه":k==="TEST"?"تست":k==="REVIEW"?"مرور":k==="EXAM"?"آزمون":"سایر"}</button>
            ))}
          </div>
        )}

        {cur==="subject" && (
          <div className="ws-wizard-options">
            <p className="ws-wizard-title">درس را انتخاب کن</p>
            {tree.subjects.length===0 ? <p className="ws-empty-text">درسی یافت نشد</p> : tree.subjects.map(s=> (
              <button key={s.id} type="button" className={`ws-wizard-option ${subject===String(s.id)?"is-selected":""}`} onClick={()=>{ setSubject(String(s.id)); setChapter(""); setTopic(""); setStepKey(tree.chapters.some(c=>c.subject === s.id) ? "chapter" : "duration"); }}>{s.name}</button>
            ))}
            {kind === "EXAM" && <button type="button" className="ws-wizard-skip" onClick={next}>رد شدن</button>}
          </div>
        )}

        {cur==="chapter" && (
          <div className="ws-wizard-options">
            <p className="ws-wizard-title">فصل / مبحث</p>
            {chapters.map(c=> (
              <button key={c.id} type="button" className={`ws-wizard-option ${chapter===String(c.id)?"is-selected":""}`} onClick={()=>{ setChapter(String(c.id)); setTopic(""); setStepKey(tree.topics.some(t=>t.chapter === c.id) ? "topic" : "duration"); }}>{c.name}</button>
            ))}
            <button type="button" className="ws-wizard-skip" onClick={()=>{ setChapter(""); setTopic(""); setStepKey("duration"); }}>رد شدن</button>
          </div>
        )}

        {cur==="topic" && (
          <div className="ws-wizard-options">
            <p className="ws-wizard-title">ریز مبحث</p>
            {topics.map(topicItem=> (
              <button key={topicItem.id} type="button" className={`ws-wizard-option ${topic===String(topicItem.id)?"is-selected":""}`} onClick={()=>{ setTopic(String(topicItem.id)); setStepKey("duration"); }}>{topicItem.name}</button>
            ))}
            <button type="button" className="ws-wizard-skip" onClick={()=>{ setTopic(""); setStepKey("duration"); }}>رد شدن</button>
          </div>
        )}

        {cur==="duration" && (
          <div className="ws-wizard-options">
            <p className="ws-wizard-title">مدت زمان</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:".4rem"}}>
              {["30","45","60","90","120"].map(v=> (
                <button key={v} type="button" className={`ws-wizard-option ${duration===v?"is-selected":""}`} style={{flex:"1 1 4rem"}} onClick={()=>{ setDuration(v); setStepKey(kind === "TEST" ? "testCount" : "confirm"); }}>{v} دقیقه</button>
              ))}
            </div>
            <label style={{display:"grid",gap:".25rem",fontSize:".78rem"}}>دلخواه<input type="number" min={5} value={duration} onChange={e=>setDuration(e.target.value)} /></label>
            <button type="button" className="ws-link" onClick={next}>ادامه</button>
          </div>
        )}

        {cur==="testCount" && (
          <div className="ws-wizard-options">
            <p className="ws-wizard-title">تعداد تست</p>
            {["5","10","20","30","50"].map(v=> (
              <button key={v} type="button" className={`ws-wizard-option ${testCount===v?"is-selected":""}`} onClick={()=>{ setTestCount(v); setStepKey("confirm"); }}>{v} تست</button>
            ))}
            <label style={{display:"grid",gap:".25rem"}}>دلخواه<input type="number" min={1} value={testCount} onChange={e=>setTestCount(e.target.value)} /></label>
            <button type="button" className="ws-link" disabled={!testCount || Number(testCount) < 1} onClick={next}>ادامه</button>
          </div>
        )}

        {cur==="confirm" && (
          <div className="ws-wizard-options">
            <p className="ws-wizard-title">بازبینی کوتاه</p>
            {(kind === "EXAM" || kind === "EVENT") && <label>عنوان فعالیت<input value={activityTitle} onChange={event => setActivityTitle(event.target.value)} required placeholder={kind === "EXAM" ? "مثلاً آزمون آزمایشی" : "مثلاً باشگاه"}/></label>}
            <div className="ws-wizard-preview">
              <span>{kind==="STUDY"?"مطالعه":kind==="TEST"?"تست":kind==="REVIEW"?"مرور":kind==="EXAM"?"آزمون":"رویداد"} {subject ? `— ${tree.subjects.find(s=>String(s.id)===subject)?.name || ""}` : ""}</span>
              {chapter && <span>فصل: {chapters.find(c=>String(c.id)===chapter)?.name}</span>}
              <span>{duration} دقیقه {testCount ? `· ${testCount} تست` : ""}</span>
            </div>
            <label style={{display:"grid",gap:".2rem",fontSize:".78rem"}}>توضیحات (اختیاری، بعداً هم قابل افزودن است)<textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="مثلاً صفحات یا نکته" /></label>
            <div className="ws-wizard-actions">
              <button type="button" disabled={busy || !kind || ((kind === "STUDY" || kind === "TEST" || kind === "REVIEW") && !subject) || ((kind === "EVENT" || kind === "EXAM") && !activityTitle.trim()) || (kind === "TEST" && Number(testCount) < 1) || Number(duration) < 1} onClick={create} className="ws-primary">{busy ? "در حال ثبت…" : "ثبت باکس"}</button>
              <button type="button" disabled={busy} className="ws-wizard-skip" onClick={prev}>بازگشت</button>
            </div>
          </div>
        )}

        {cur!=="kind" && cur!=="confirm" && (
          <div className="ws-wizard-actions">
            <button type="button" disabled={busy} className="ws-wizard-skip" onClick={prev}>بازگشت</button>
            
          </div>
        )}
      </div>
    </div>
  );
}

