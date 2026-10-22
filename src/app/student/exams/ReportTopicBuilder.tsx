"use client";
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { creationRequest, creationComplete } from '@/components/exams/creation';
import { difficulties, validCounts, practicePayload, type Difficulty, type StudentExam } from './studentExam';
import { type ConfirmedTopic, type ReportPreview, validPreview } from './reportTopics';
import { reportContext, reportGroupKey, selectReportTopic, safeExamLink, type ReportGroup } from './reportBuilder';

type Draft={topics:ConfirmedTopic[];counts:Record<Difficulty,string>;duration:string};
const emptyDraft=():Draft=>({topics:[],counts:{easy:'0',medium:'0',hard:'0',very_hard:'0'},duration:'30'});
export default function ReportTopicBuilder({token,onCreated,onBusyChange}:{token:string;onCreated?:(exam:StudentExam)=>void;onBusyChange?:(busy:boolean)=>void}) {
  const [period,setPeriod]=useState('today'),[start,setStart]=useState(''),[end,setEnd]=useState('');
  const [loaded,setLoaded]=useState<{key:string;groups:ReportGroup[];unavailable:number;eligible:number}|null>(null);
  const [drafts,setDrafts]=useState<Record<string,Draft>>({});
  const [previews,setPreviews]=useState<Record<string,{signature:string;data?:ReportPreview;error?:string}>>({});
  const [created,setCreated]=useState<Record<string,{exam:StudentExam;url?:string;error?:string}>>({});
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
  const lock=useRef(false);
  const query=new URLSearchParams(period==='custom'?{period,start_date:start,end_date:end}:{period}).toString();
  const validDates=period!=='custom'||!!(start&&end&&start<=end);
  const loadKey=query;
  const groups=loaded?.key===loadKey?loaded.groups:[];
  const selections=groups.map(group=>({group,context:reportContext(group,drafts[reportGroupKey(group)]?.topics??[])})).filter(row=>row.context.topics.length);
  const selectionKey=JSON.stringify(selections);
  useEffect(()=>{
    if(!validDates)return;
    let live=true;
    api<{groups:ReportGroup[];unavailable_sources:number;eligible_sources?:number}>(`/exams/study-sources/topics/?${query}`,token).then(data=>{
      if(live){setLoaded({key:loadKey,groups:data.groups,unavailable:data.unavailable_sources,eligible:data.eligible_sources??data.unavailable_sources});setError('')}
    }).catch(reason=>{if(live)setError(errorMessage(reason))});
    return()=>{live=false};
  },[token,query,loadKey,validDates,retry]);
  useEffect(()=>{
    let live=true;
    const rows:typeof selections=JSON.parse(selectionKey);
    const timer=setTimeout(()=>{for(const {group,context} of rows){
      const key=reportGroupKey(group),signature=JSON.stringify(context);
      api<ReportPreview>('/exams/study-sources/topics/preview/',token,'POST',context).then(data=>{
        if(!validPreview(data))throw Error('موجودی سؤال معتبر نیست.');
        if(live)setPreviews(previous=>({...previous,[key]:{signature,data}}));
      }).catch(reason=>{if(live)setPreviews(previous=>({...previous,[key]:{signature,error:errorMessage(reason)}}))});
    }},250);
    return()=>{live=false;clearTimeout(timer)};
  },[token,selectionKey,retry]);
  function update(key:string,change:Partial<Draft>){setDrafts(previous=>({...previous,[key]:{...(previous[key]??emptyDraft()),...change}}));setError('')}
  function resetRange(){setDrafts({});setPreviews({});setCreated({});setError('')}
  async function access(key:string,exam:StudentExam){
    try{
      const response=await api<{participation_url:string}>(`/exams/${exam.id}/start/`,token,'POST',{});
      setCreated(previous=>({...previous,[key]:{exam,url:safeExamLink(response.participation_url)}}));
    }catch(reason){setCreated(previous=>({...previous,[key]:{exam,error:errorMessage(reason)}}))}
  }
  const ready=selections.length>0&&selections.every(({group,context})=>{
    const key=reportGroupKey(group),draft=drafts[key],preview=previews[key];
    return !!created[key] || (preview?.signature===JSON.stringify(context)&&!!preview.data&&validCounts(draft.counts,preview.data.availability)&&/^\d+$/.test(draft.duration)&&Number(draft.duration)>0&&Number(draft.duration)<=2147483647);
  })&&selections.some(({group})=>!created[reportGroupKey(group)]);
  async function create(){
    if(lock.current||!ready)return;
    lock.current=true;setBusy(true);onBusyChange?.(true);setError('');
    try{
      for(const {group,context} of selections){
        const key=reportGroupKey(group);if(created[key])continue;
        const preview=previews[key].data!,draft=drafts[key];
        const scope=`report:${key}`;
        const payload={...practicePayload({...preview.provider_filters,question_type:1},draft.counts,`آزمون ${group.course_label}`,Number(draft.duration)),report_context:context};
        const exam=await api<StudentExam>('/exams/automatic/',token,'POST',creationRequest(payload,sessionStorage,scope));
        setCreated(previous=>({...previous,[key]:{exam}}));creationComplete(sessionStorage,scope);onCreated?.(exam);
        await access(key,exam);
      }
    }catch(reason){setError(errorMessage(reason))}
    finally{lock.current=false;setBusy(false);onBusyChange?.(false)}
  }
  return <section className="student-practice-form report-topic-builder" dir="rtl" aria-label="آزمون از گزارش کار">
    <fieldset disabled={busy}>
      <div className="exam-actions" aria-label="بازه مطالعه">{[['today','امروز'],['week','این هفته'],['custom','بازه دلخواه']].map(([value,label])=><button type="button" key={value} aria-pressed={period===value} onClick={()=>{resetRange();setPeriod(value)}}>{label}</button>)}</div>
      {period==='custom'&&<div className="report-filter"><label>از تاریخ<input type="date" value={start} onChange={e=>{resetRange();setStart(e.target.value)}}/></label><label>تا تاریخ<input type="date" value={end} onChange={e=>{resetRange();setEnd(e.target.value)}}/></label></div>}
      {error&&<p role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>تلاش دوباره</button></p>}
      {validDates&&loaded?.key!==loadKey&&!error&&<p role="status">در حال دریافت مباحث…</p>}
      {loaded?.key===loadKey&&!groups.length&&<p role="status">{loaded.eligible>0?'گزارش ثبت شده است، اما مباحث آن تطبیق معتبر و یکتا در Quiz24 ندارند.':'در این بازه گزارش انجام‌شده یا نیمه‌انجام‌شده‌ای ثبت نشده است.'}</p>}
      {loaded?.key===loadKey&&loaded.unavailable>0&&<p className="exam-muted">زمینه آموزشی بعضی گزارش‌ها معتبر نیست و نمایش داده نمی‌شود.</p>}
      {groups.length>0&&<p className="exam-muted">مباحث مطالعه‌شده را علامت بزنید؛ برای هر درس انتخاب‌شده یک آزمون جدا ساخته می‌شود.</p>}
      {groups.map(group=>{
        const key=reportGroupKey(group),draft=drafts[key]??emptyDraft(),context=reportContext(group,draft.topics);
        const preview=previews[key]?.signature===JSON.stringify(context)?previews[key]:null;
        const chapters=[...new Set(group.topics.map(node=>node.path.chapter))];
        return <section className="report-course-group" key={key} aria-label={group.course_label}>
          <h3>{group.course_label} <small>{group.grade_label}</small></h3>
          <fieldset disabled={!!created[key]}>{chapters.map(chapter=>{
            const nodes=group.topics.filter(n=>n.path.chapter===chapter);
            return <section key={chapter}><h4>{nodes[0].chapter_label}</h4>{nodes.filter(node=>node.level!=='chapter'||!nodes.some(n=>n.level!=='chapter')).map(node=><label key={`${node.level}:${node.id}`} className={`question-bank-check report-node-${node.level}`}>
              <input type="checkbox" checked={draft.topics.some(t=>t.level===node.level&&t.id===node.id)} onChange={()=>update(key,{topics:selectReportTopic(draft.topics,node,group.topics)})}/>{node.label}
            </label>)}</section>;
          })}
          {draft.topics.length>0&&<div className="report-question-settings">
            {preview?.error&&<p role="alert">{preview.error} <button type="button" onClick={()=>setRetry(n=>n+1)}>تلاش دوباره</button></p>}
            {!preview&&<p role="status">در حال بررسی موجودی…</p>}
            <div className="exam-difficulties">{difficulties.map(({key:difficulty,label})=><label key={difficulty}>{label}<input type="number" min="0" max={preview?.data?.availability[difficulty]} value={draft.counts[difficulty]} onChange={e=>update(key,{counts:{...draft.counts,[difficulty]:e.target.value}})}/>{preview?.data&&<small>موجود: {preview.data.availability[difficulty].toLocaleString('fa-IR')}</small>}</label>)}</div>
            <label>مدت آزمون (دقیقه)<input type="number" min="1" value={draft.duration} onChange={e=>update(key,{duration:e.target.value})}/></label>
            {preview?.data&&!validCounts(draft.counts,preview.data.availability)&&<small>حداقل یک سؤال، در محدوده موجودی انتخاب کنید.</small>}
          </div>}</fieldset>
          {created[key]&&<p role="status">آزمون ساخته شد. {created[key].url?<a href={created[key].url}>ورود به آزمون</a>:<button type="button" onClick={()=>void access(key,created[key].exam)}>دریافت لینک آزمون</button>}{created[key].error&&<span role="alert">{created[key].error}</span>}</p>}
        </section>;
      })}
      <button type="button" className="exam-primary" disabled={busy||!ready} onClick={()=>void create()}>{busy?'در حال ساخت…':'ساخت آزمون'}</button>
    </fieldset>
  </section>;
}
