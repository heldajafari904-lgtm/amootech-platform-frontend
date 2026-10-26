'use client';
import {useEffect,useRef,useState} from 'react';
import {api,errorMessage} from '@/lib/api';
import JalaliDateInput from '@/components/JalaliDateInput';
import {courseDetail,envelope,field,options,topicNodes,type Option} from './taxonomy';
import {creationRequest,creationComplete} from './creation';
import {tehranISO,tehranInput,scheduleFields} from './schedule';
import {emptyBasket,newEntry,entryKey,editEntry,toggleNode,selected,total,filters,reportContext,countsValid,creationPayload,restoreBasket,difficultyLabels,type Basket,type Entry,type ScopeNode,type Inventory,type Reference,type Difficulty} from './selectionBasket';
import './basket.css';

type Group={grade_id:number;course_id:number;grade_label:string;course_label:string;topics:ScopeNode[];course_sources?:Reference[]};
type Mode='bank'|'report'|'counselor';
type Props<T>={token:string;mode:Mode;studentIds?:number[];onCreated?:(exam:T)=>void;onBusyChange?:(busy:boolean)=>void};
function actorKey(token:string){try{return String(JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).user_id)}catch{return 'session'}}
function catalogRows(value:unknown,kind:string){
 const rows=envelope(value),result=options(rows,kind);
 if(!Array.isArray(rows)||result.length!==rows.length||field(value,'status')!=null&&field(value,'status')!==100)throw Error('فهرست محلی معتبر نیست؛ دوباره دریافت کنید.');
 if(new Set(result.map(row=>kind==='course'?`${field(row.raw,'gradeid')}:${row.id}`:row.id)).size!==result.length)throw Error('شناسه‌های فهرست مبهم‌اند.');
 return result;
}
function TopicTree({nodes,chosen,onToggle,expandChapters=false}:{nodes:ScopeNode[];chosen:ScopeNode[];onToggle:(node:ScopeNode)=>void;expandChapters?:boolean}){
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 const [search,setSearch]=useState('');
 const matches=(node:ScopeNode)=>!search||node.label.includes(search);
 const open=(node:ScopeNode)=>expanded[`${node.level}:${node.id}`]??(expandChapters&&node.level==='chapter'||chosen.some(row=>row.level!==node.level&&row.path[node.level]===node.id));
 function row(node:ScopeNode,children:ScopeNode[]){
  return <div className={`basket-node basket-node-${node.level}`} key={`${node.level}:${node.id}`}>
   <div className="basket-node-line"><label><input type="checkbox" checked={chosen.some(item=>item.level===node.level&&item.id===node.id)} onChange={()=>onToggle(node)}/>{node.label}</label>
   {!!children.length&&<button type="button" aria-expanded={open(node)} onClick={()=>setExpanded(previous=>({...previous,[`${node.level}:${node.id}`]:!open(node)}))}>{open(node)?'بستن':'مباحث'}</button>}</div>
   {(open(node)||!!search)&&children.map(child=>row(child,visible.filter(candidate=>child.level==='subject'&&candidate.level==='object'&&candidate.path.subject===child.id)))}
  </div>;
 }
 const visible=nodes.filter(node=>matches(node)||nodes.some(child=>matches(child)&&child.path[node.level]===node.id));
 const roots=visible.filter(node=>node.level==='chapter'||!nodes.some(parent=>parent.level==='chapter'&&parent.id===node.path.chapter)&&node.level==='subject'||node.level==='object'&&!nodes.some(parent=>parent.level==='chapter'&&parent.id===node.path.chapter||parent.level==='subject'&&parent.id===node.path.subject));
 return <div className="basket-topic-tree">
  {nodes.length>40&&<label>جست‌وجوی مبحث<input type="search" value={search} onChange={event=>setSearch(event.target.value)}/></label>}
  {roots.map(node=><div key={`${node.level}:${node.id}`}>{node.level!=='chapter'&&node.chapter_label&&<p className="basket-scope">{node.chapter_label}</p>}{row(node,visible.filter(child=>node.level==='chapter'?child.level==='subject'&&child.path.chapter===node.id:node.level==='subject'&&child.level==='object'&&child.path.subject===node.id))}</div>)}
  {!nodes.length&&<p>مبحثی ثبت نشده است؛ کل درس را صریحاً انتخاب کنید.</p>}
 </div>;
}

function CourseSettings<T extends {id:number;title:string}>({entry,token,studentIds,storageScope,busy,onStart,onEnd,onChange,onCreate}:{entry:Entry;token:string;studentIds:number[];storageScope:string;busy:boolean;onStart:()=>boolean;onEnd:()=>void;onChange:(change:Partial<Entry>)=>void;onCreate:(exam:T)=>void}){
 const [response,setResponse]=useState<{signature:string;data?:Inventory;error?:string}|null>(null);
 const [retry,setRetry]=useState(0),[error,setError]=useState('');
 const submitting=useRef(false);
 let signature='',scopeError='';
 try {signature=JSON.stringify(entry.report?reportContext(entry):{...filters(entry),...(studentIds.length?{student_ids:studentIds}:{})})}catch(reason){scopeError=errorMessage(reason)}
 useEffect(()=>{
  if(!signature)return;
  let live=true;
  const timer=setTimeout(()=>{
   api<Inventory|{availability:Inventory}>(entry.report?'/exams/study-sources/topics/preview/':'/exams/provider/question-count/',token,'POST',JSON.parse(signature)).then(data=>{
    const inventory='availability' in data?data.availability:data;
    if(!Object.keys(difficultyLabels).every(key=>Number.isSafeInteger(inventory[key as Difficulty])&&inventory[key as Difficulty]>=0&&inventory[key as Difficulty]<=2147483647))throw Error('موجودی معتبر نیست.');
    if(live)setResponse({signature,data:inventory});
   }).catch(reason=>{if(live)setResponse({signature,error:errorMessage(reason)})});
  },300);
  return()=>{live=false;clearTimeout(timer)};
 },[token,signature,entry.report,retry]);
 const current=response?.signature===signature?response:null;
 const available=current?.data??null;
 let scheduleError='';
 try{for(const draft of Object.values(entry.scheduleDraft??{}))tehranISO(draft)}catch(reason){scheduleError=errorMessage(reason)}
 const valid=!scheduleError&&!!signature&&countsValid(entry,available)&&/^\d+$/.test(entry.duration)&&Number(entry.duration)>0&&Number(entry.duration)<=2147483647;
 async function create(){
  if(!valid||busy||submitting.current||entry.created||!onStart())return;
  submitting.current=true;setError('');
  try {
   const payload=creationRequest(creationPayload(entry,studentIds),sessionStorage,`${storageScope}:${entryKey(entry)}`);
   const exam=await api<T>('/exams/automatic/',token,'POST',payload);
   creationComplete(sessionStorage,`${storageScope}:${entryKey(entry)}`);
   onCreate(exam);
  }catch(reason){setError(errorMessage(reason))}finally{submitting.current=false;onEnd()}
 }
 return <section className="basket-course-settings" aria-label={`تنظیمات ${entry.courseLabel}`}>
  <h3>{entry.courseLabel} · {entry.gradeLabel}</h3>
  <p className="basket-scope">{entry.wholeCourse?'کل درس':entry.topics.map(node=>node.label).join('، ')}</p>
  <fieldset disabled={busy||!!entry.created}>
   <div className="basket-options">{[1,2].map(type=><button type="button" key={type} aria-pressed={entry.questionType===type} onClick={()=>onChange({questionType:type})}>{type===1?'تستی':'تشریحی'}</button>)}
    <label><input type="checkbox" checked={entry.negative} onChange={event=>onChange({negative:event.target.checked})}/>نمره منفی</label>
    <label><input type="checkbox" checked={entry.considerUsed} onChange={event=>onChange({considerUsed:event.target.checked})}/>سؤال‌های استفاده‌شده</label>
   </div>
   {scopeError&&<p role="alert">{scopeError}</p>}
   {current?.error&&<p role="alert">{current.error} <button type="button" onClick={()=>setRetry(value=>value+1)}>تلاش دوباره</button></p>}
   {!!signature&&!current&&<p role="status">در حال بررسی موجودی…</p>}
   <div className="basket-counts">{(Object.entries(difficultyLabels) as [Difficulty,string][]).map(([key,label])=><label key={key}>{label}<input aria-label={`تعداد سؤال ${label} ${entry.courseLabel}`} type="number" min="0" step="1" value={entry.counts[key]} onChange={event=>onChange({counts:{...entry.counts,[key]:event.target.value}})}/><small>{available?`${available[key].toLocaleString('fa-IR')} موجود`:'—'}</small></label>)}</div>
   {available&&!countsValid(entry,available)&&<p role="status">{Object.values(available).some(Boolean)?'حداقل یک سؤال انتخاب کنید؛ درخواست نباید بیشتر از موجودی باشد.':'برای محدوده انتخاب‌شده سؤالی موجود نیست.'}</p>}
   <div className="basket-options"><label>مدت (دقیقه)<input type="number" min="1" value={entry.duration} onChange={event=>onChange({duration:event.target.value})}/></label><label>عنوان آزمون<input maxLength={200} value={entry.title} placeholder={`آزمون ${entry.courseLabel}`} onChange={event=>onChange({title:event.target.value})}/></label></div>
   {!!studentIds.length&&<details><summary>زمان‌بندی آزمون</summary>{scheduleFields.map(key=>{
    const draft=entry.scheduleDraft?.[key]??tehranInput(entry.schedule?.[key]);
    return <ScheduleInput key={key} label={key==='scheduled_start_at'?'شروع':key==='participation_deadline_at'?'مهلت شرکت':'انتشار نتیجه'} value={draft} onChange={value=>{
     const scheduleDraft={...entry.scheduleDraft,[key]:value};
     let iso=entry.schedule?.[key]??null;try{iso=tehranISO(value)}catch{/* Keep partial input; block creation until complete. */}
     onChange({scheduleDraft,schedule:{...entry.schedule,[key]:iso}});
    }}/>;
   })}</details>}
  </fieldset>
  {(error||scheduleError)&&<p role="alert">{error||scheduleError}</p>}
  {entry.created?<p role="status">آزمون «{entry.created.title}» در تاریخچه ثبت شد.</p>:<button type="button" className="exam-primary basket-create-course" disabled={busy||!valid} onClick={()=>void create()}>ساخت آزمون این درس</button>}
 </section>;
}
function ScheduleInput({label,value,onChange}:{label:string;value:{date:string;time:string};onChange:(value:{date:string;time:string})=>void}){
 return <div className="basket-options"><label>{label} (شمسی)<JalaliDateInput value={value.date} onChange={event=>onChange({...value,date:event.target.value})}/></label><label>ساعت تهران<input type="time" value={value.time} onChange={event=>onChange({...value,time:event.target.value})}/></label><button type="button" onClick={()=>onChange({date:'',time:''})}>پاک‌کردن زمان</button></div>;
}

export default function ExamBasketBuilder<T extends {id:number;title:string}>({token,mode,studentIds=[],onCreated,onBusyChange}:Props<T>){
 const targets=[...new Set(studentIds)].sort((a,b)=>a-b),targetKey=targets.join(',');
 const storageKey=`amootech-exam-basket:v1:${actorKey(token)}:${mode}:${targetKey}`;
 const [stored,setStored]=useState<{key:string;basket:Basket}>({key:'',basket:emptyBasket()});
 const basket=stored.key===storageKey?stored.basket:emptyBasket();
 const stateRef=useRef(stored);
 const [storageError,setStorageError]=useState('');
 useEffect(()=>{
  let live=true;
  queueMicrotask(()=>{
   if(!live)return;
   let restored=emptyBasket();try{restored=restoreBasket(sessionStorage.getItem(storageKey))}catch(reason){setStorageError(errorMessage(reason))}
   const state={key:storageKey,basket:restored};stateRef.current=state;setStored(state);
  });
  return()=>{live=false};
 },[storageKey]);
 function commit(update:(previous:Basket)=>Basket){
  const current=stateRef.current.key===storageKey?stateRef.current.basket:emptyBasket();
  const next={key:storageKey,basket:update(current)};
  stateRef.current=next;setStored(next);
  try{sessionStorage.setItem(storageKey,JSON.stringify(next.basket))}catch{setStorageError('ذخیره پیش‌نویس در این مرورگر ممکن نیست؛ انتخاب فعلی حفظ شده است.')}
 }
 const [catalog,setCatalog]=useState<{key:string;grades:Option[];courses:Option[]}|null>(null),[catalogError,setCatalogError]=useState(''),[retry,setRetry]=useState(0);
 const [detail,setDetail]=useState<{key:string;nodes:ScopeNode[];error?:string}|null>(null);
 const [period,setPeriod]=useState('today'),[start,setStart]=useState(''),[end,setEnd]=useState('');
 const [report,setReport]=useState<{key:string;groups:Group[];unresolved:Reference[]}|null>(null),[reportError,setReportError]=useState('');
 const [reselect,setReselect]=useState(false),[search,setSearch]=useState(''),[busy,setBusy]=useState(false);
 const busyLock=useRef(false);
 const query=new URLSearchParams(period==='custom'?{period,start_date:start,end_date:end}:{period}).toString();
 const reportKey=`${token}:${query}`,catalogKey=`${token}:${targetKey}`;
 const active=basket.entries[basket.active];
 const detailKey=active?`${catalogKey}:${entryKey(active)}`:'';
 useEffect(()=>{
  if(mode==='report'&&!reselect||mode==='counselor'&&!targetKey)return;
  let live=true;
  Promise.all((targetKey?targetKey.split(','):['']).map(async student=>{
   const suffix=student?`?student=${student}`:'';
   const [grades,courses]=await Promise.all([api<unknown>(`/exams/provider/grades/${suffix}`,token),api<unknown>(`/exams/provider/courses/${suffix}`,token)]);
   return {grades:catalogRows(grades,'grade'),courses:catalogRows(courses,'course')};
  })).then(lists=>{
   const grades=lists[0].grades.filter(row=>lists.every(list=>list.grades.some(other=>other.id===row.id)));
   const courses=lists[0].courses.filter(row=>lists.every(list=>list.courses.some(other=>other.id===row.id&&field(other.raw,'gradeid')===field(row.raw,'gradeid'))));
   if(live){setCatalog({key:catalogKey,grades,courses});setCatalogError('')}
  }).catch(reason=>{if(live)setCatalogError(errorMessage(reason))});
  return()=>{live=false};
 },[token,targetKey,catalogKey,mode,reselect,retry]);
 useEffect(()=>{
  if(!active||mode==='report'&&!reselect)return;
  let live=true;
  api<unknown>('/exams/provider/course-detail/',token,'POST',{grade_id:active.gradeId,course_id:active.courseId,...(targetKey?{student:Number(targetKey.split(',')[0])}:{})}).then(data=>{
   const nodes=topicNodes(courseDetail(data,active.courseId)).map(node=>({level:node.level,id:node.id,label:node.name,path:{course:active.courseId,chapter:node.chapter,...(node.subject?{subject:node.subject}:{}),...(node.level==='object'?{object:node.id}:{})}}));
   if(live)setDetail({key:detailKey,nodes});
  }).catch(reason=>{if(live)setDetail({key:detailKey,nodes:[],error:errorMessage(reason)})});
  return()=>{live=false};
  // Browsing does not depend on mutable counts/title/topics.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[token,detailKey,mode,reselect,retry]);
 useEffect(()=>{
  if(mode!=='report'||period==='custom'&&!(start&&end&&start<=end))return;
  let live=true;
  api<{groups:Group[];unresolved_sources?:Reference[] }>(`/exams/study-sources/topics/?${query}`,token).then(data=>{if(live){setReport({key:reportKey,groups:data.groups,unresolved:data.unresolved_sources??[]});setReportError('')}}).catch(reason=>{if(live)setReportError(errorMessage(reason))});
  return()=>{live=false};
 },[token,mode,query,reportKey,period,start,end,retry]);
 function patch(key:string,change:Partial<Entry>){commit(previous=>editEntry(previous,key,change))}
 function groupEntry(group:Group):Entry{return newEntry(group.grade_id,group.course_id,group.grade_label,group.course_label,true)}
 function changeGroup(group:Group,transform:(entry:Entry)=>Entry){const key=`${group.grade_id}:${group.course_id}`;commit(previous=>({...previous,entries:{...previous.entries,[key]:transform(previous.entries[key]??groupEntry(group))}}))}
 const chosen=Object.entries(basket.entries).filter(([,entry])=>selected(entry));
 const catalogData=catalog?.key===catalogKey?catalog:null;
 const reportData=report?.key===reportKey?report:null;
 if(stored.key!==storageKey)return <p role="status">در حال بازیابی سبد…</p>;
 return <section className="exam-basket-builder" dir="rtl" aria-label={mode==='report'?'آزمون از گزارش کار':'سبد ساخت آزمون'}>
  <aside className="basket-summary" aria-label="درس‌های انتخاب‌شده"><h3>سبد آزمون</h3>
   {!chosen.length&&<p>درس یا مبحثی انتخاب نشده است.</p>}
   {chosen.map(([key,entry])=><div className="basket-summary-row" key={key}><button type="button" onClick={()=>{commit(previous=>({...previous,grade:String(entry.gradeId),active:key}));document.getElementById(`basket-topics-${key}`)?.scrollIntoView({block:'center'})}}>{entry.courseLabel} · {entry.gradeLabel} — {entry.wholeCourse?'کل درس':entry.topics.map(node=>node.label).join('، ')} — {total(entry).toLocaleString('fa-IR')} سؤال</button><button type="button" aria-label={`حذف ${entry.courseLabel} از سبد`} disabled={busy} onClick={()=>commit(previous=>{const entries={...previous.entries};delete entries[key];return {...previous,entries,active:previous.active===key?'':previous.active}})}>حذف</button></div>)}
   <strong>مجموع: {chosen.reduce((sum,[,entry])=>sum+total(entry),0).toLocaleString('fa-IR')} سؤال</strong>
   {chosen.length>1&&<div className="basket-combined-gate" role="status"><p>ساخت یک آزمون ترکیبی چنددرسی با API رسمی هنوز تأیید نشده است. سبد حفظ می‌شود؛ هر درس را می‌توانید صریحاً جدا بسازید.</p><button type="button" disabled>ساخت آزمون ترکیبی — در دسترس نیست</button></div>}
  </aside>
  {storageError&&<p role="alert">{storageError}</p>}
  <fieldset disabled={busy} className="basket-selection">
   {mode==='counselor'&&!targets.length&&<p>ابتدا دانش‌آموزان مجاز را انتخاب کنید.</p>}
   {mode==='report'&&<>
    <div className="basket-options" aria-label="بازه گزارش">{[['today','امروز'],['week','این هفته'],['custom','بازه دلخواه']].map(([value,label])=><button type="button" key={value} aria-pressed={period===value} onClick={()=>setPeriod(value)}>{label}</button>)}</div>
    {period==='custom'&&<div className="basket-options"><label>از تاریخ<JalaliDateInput value={start} onChange={event=>setStart(event.target.value)}/></label><label>تا تاریخ<JalaliDateInput value={end} onChange={event=>setEnd(event.target.value)}/></label></div>}
    {reportError&&<p role="alert">{reportError} <button type="button" onClick={()=>setRetry(value=>value+1)}>تلاش دوباره</button></p>}
    {!reportData&&!reportError&&(period!=='custom'||start&&end)&&<p role="status">در حال دریافت مباحث گزارش…</p>}
    {reportData&&!reportData.groups.length&&!reportData.unresolved.length&&<p>در این بازه گزارش انجام‌شده یا نیمه‌انجام‌شده‌ای موجود نیست.</p>}
    {reportData?.groups.map(group=>{
     const key=`${group.grade_id}:${group.course_id}`,entry=basket.entries[key];
     return <section className="basket-report-course" id={`basket-topics-${key}`} key={key}><h3>{group.course_label} · {group.grade_label}</h3>
      {!!group.course_sources?.length&&<button type="button" aria-pressed={entry?.wholeCourse??false} onClick={()=>changeGroup(group,current=>({...current,wholeCourse:!current.wholeCourse,topics:[],reportSources:group.course_sources??[],created:undefined}))}>انتخاب کل درس</button>}
      <TopicTree expandChapters nodes={group.topics} chosen={entry?.topics??[]} onToggle={node=>changeGroup(group,current=>toggleNode(current,node))}/>
     </section>;
    })}
    {!!reportData?.unresolved.length&&<button type="button" onClick={()=>setReselect(value=>!value)} aria-pressed={reselect}>انتخاب صریح مباحث برای گزارش‌های فاقد مسیر تأییدشده</button>}
   </>}
   {(mode!=='report'||reselect)&&<>
    {catalogError&&<p role="alert">{catalogError} <button type="button" onClick={()=>setRetry(value=>value+1)}>تلاش دوباره</button></p>}
    {!catalogData&&!catalogError&&(mode!=='counselor'||!!targetKey)&&<p role="status">در حال دریافت فهرست محلی…</p>}
    {catalogData&&!catalogData.grades.length&&<p role="alert">پایه مشترک مجاز موجود نیست؛ پروفایل تحصیلی دانش‌آموزان را بررسی کنید.</p>}
    <div className="basket-tiles" role="group" aria-label="پایه">{catalogData?.grades.map(grade=><button type="button" key={grade.id} aria-pressed={basket.grade===String(grade.id)} onClick={()=>{commit(previous=>({...previous,grade:String(grade.id),active:''}));setSearch('')}}>{grade.name}</button>)}</div>
    {(catalogData?.courses.length??0)>12&&basket.grade&&<label>جست‌وجوی درس<input type="search" value={search} onChange={event=>setSearch(event.target.value)}/></label>}
    <div className="basket-tiles" role="group" aria-label="درس">{catalogData?.courses.filter(course=>String(field(course.raw,'gradeid'))===basket.grade&&course.name.includes(search)).map(course=>{
     const key=`${basket.grade}:${course.id}`;
     return <button type="button" key={key} aria-pressed={basket.active===key} onClick={()=>commit(previous=>({...previous,active:key,entries:{...previous.entries,[key]:previous.entries[key]??{...newEntry(Number(basket.grade),course.id,catalogData.grades.find(grade=>String(grade.id)===basket.grade)?.name??'',course.name,mode==='report'),reselected:mode==='report',reportSources:mode==='report'?reportData?.unresolved??[]:[]}}}))}>{course.name}</button>;
    })}</div>
    {active&&<section id={`basket-topics-${entryKey(active)}`}><h3>{active.gradeLabel} {' > '} {active.courseLabel}</h3>
     <button type="button" aria-pressed={active.wholeCourse} onClick={()=>patch(entryKey(active),{wholeCourse:!active.wholeCourse,topics:[]})}>انتخاب کل درس</button>
     {detail?.key!==detailKey?<p role="status">در حال دریافت مباحث محلی…</p>:detail.error?<p role="alert">{detail.error} <button type="button" onClick={()=>setRetry(value=>value+1)}>تلاش دوباره</button></p>:<TopicTree key={detailKey} nodes={detail.nodes} chosen={active.topics} onToggle={node=>patch(entryKey(active),toggleNode(active,node))}/>}
    </section>}
   </>}
  </fieldset>
  <div className="basket-settings">{chosen.map(([key,entry])=><CourseSettings<T> key={key} entry={entry} token={token} studentIds={targets} storageScope={storageKey} busy={busy} onStart={()=>{if(busyLock.current)return false;busyLock.current=true;setBusy(true);onBusyChange?.(true);return true}} onEnd={()=>{busyLock.current=false;setBusy(false);onBusyChange?.(false)}} onChange={change=>patch(key,change)} onCreate={exam=>{
   commit(previous=>({...previous,entries:{...previous.entries,[key]:{...previous.entries[key],created:{id:exam.id,title:exam.title}}}}));onCreated?.(exam);
  }}/>)}</div>
 </section>;
}
