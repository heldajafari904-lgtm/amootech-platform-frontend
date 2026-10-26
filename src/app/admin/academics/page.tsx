'use client';
import {useEffect,useState,useRef} from 'react';
import {accessToken,api,errorMessage} from '@/lib/api';
import {formatJalaliDateTime} from '@/lib/planning';
type Status = {status:string;last_success:string|null;counts:Record<string,number>;error:string;revision:number|null;quarantine?:{reason:string;course:{courseId:number;courseName:string;gradeId:number}}[]};
export default function AcademicCatalogAdmin() {
  const [status,setStatus]=useState<Status|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const lock=useRef(false);
  useEffect(()=>{const token=accessToken('ADMIN');if(token) api<Status>('/academics/provider-sync/',token).then(setStatus).catch(e=>setError(errorMessage(e)));},[]);
  useEffect(()=>{const timer=setInterval(()=>{const token=accessToken('ADMIN');if(token) void api<Status>('/academics/provider-sync/',token).then(setStatus).catch(()=>{});},5000);return ()=>clearInterval(timer);},[]);
  async function sync(){
    const token=accessToken('ADMIN'); if(!token || lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try {setStatus(await api<Status>('/academics/provider-sync/',token,'POST',{}));}
    catch(e){setError(errorMessage(e));setStatus(await api<Status>('/academics/provider-sync/',token));}
    finally{lock.current=false;setBusy(false);}
  }
  const labels:Record<string,string>={NEVER:'هنوز اجرا نشده',PENDING:'در صف همگام‌سازی',RUNNING:'در حال اجرا',SUCCESS:'موفق',FAILED:'ناموفق'};
  return <main dir="rtl"><h1>دسته‌بندی آموزشی Quiz24</h1><p>وضعیت: {busy?'در حال اجرا':labels[status?.status || 'NEVER']}</p><p>آخرین همگام‌سازی موفق: {status?.last_success ? formatJalaliDateTime(status.last_success) : 'ندارد'}</p><p>پایه‌ها: {(status?.counts.grade || 0).toLocaleString('fa-IR')} · درس‌ها: {(status?.counts.course || 0).toLocaleString('fa-IR')} · مباحث: {(['chapter','subject','object'].reduce((n,k)=>n+(status?.counts[k]||0),0)).toLocaleString('fa-IR')}</p><button disabled={busy || ['RUNNING','PENDING'].includes(status?.status || '')} onClick={sync}>به‌روزرسانی دسته‌بندی Quiz24</button><p role="alert">{error || status?.error}</p>{!!status?.quarantine?.length && <div role="alert"><p>برخی درس‌ها پایه معتبر در پاسخ تأمین‌کننده ندارند و برای انتخاب جدید در دسترس نیستند؛ اصلاح اطلاعات Quiz24 لازم است.</p><ul>{status.quarantine.map(row=><li key={`${row.course.gradeId}:${row.course.courseId}`}>{row.course.courseName} · پایه تأمین‌کننده: {row.course.gradeId.toLocaleString('fa-IR')}</li>)}</ul></div>}</main>;
}
