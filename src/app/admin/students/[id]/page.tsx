"use client";

import StudentMobileStatus from "@/components/accounts/StudentMobileStatus";

import { useSyncExternalStore, useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { accessToken, api, onSessionExpired, errorMessage } from "@/lib/api";
import TelegramControl from "./TelegramControl";
import { formatTehranDate, formatJalaliDateTime } from "@/lib/planning";

const subscribe = (callback: () => void) => onSessionExpired("ADMIN", callback);
const snapshot = () => accessToken("ADMIN") || "";
const serverSnapshot = () => "";

type StudentDetail = {
  id:number;
  user:{id:number; username:string; first_name:string; last_name:string; email:string; is_active:boolean; date_joined:string; last_login:string|null};
  counselor:number|null;
  counselor_user:{username:string; first_name:string; last_name:string}|null;
  grade:number|null; grade_name:string|null;
  field:number|null; field_name:string|null;
  school_name:string;
  current_plan:{id:number; title:string; status:string; start_date:string; end_date:string}|null;
  telegram_status:{group_connected:boolean; student_connected:boolean; chat_title:string|null; telegram_username:string|null; enabled:boolean; suspended:boolean; banned:boolean};
  reports_today:boolean;
};

const tabs = [
  { id:"overview", label:"خلاصه" },
  { id:"progress", label:"عملکرد" },
  { id:"counselor", label:"مشاور" },
  { id:"telegram", label:"تلگرام" },
  { id:"profile", label:"پروفایل" },
];

export default function AdminStudentDetail() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const token = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const initialTab = searchParams.get("tab") && tabs.some(t=>t.id===searchParams.get("tab")) ? searchParams.get("tab")! : "overview";
  const [tab, setTab] = useState(initialTab);
  const [student, setStudent]=useState<StudentDetail|null>(null);
  const [error, setError]=useState("");
  const [assignOpen, setAssignOpen]=useState(false);
  const [counselors, setCounselors]=useState<{id:number; user:{username:string; first_name:string; last_name:string}}[]>([]);
  const [selectedCounselor, setSelectedCounselor]=useState("");
  const [progress, setProgress]=useState<unknown>(null);

  const loadStudent = useCallback(async()=>{
    if(!token || !id) return;
    try{ const s=await api<StudentDetail>(`/students/${id}/`, token); setStudent(s); }catch(e){ setError(errorMessage(e)); }
  },[token, id]);
  useEffect(()=>{ void Promise.resolve().then(() => loadStudent()); },[loadStudent]);
  useEffect(()=>{ if(token) api<{results:{id:number; user:{username:string;first_name:string;last_name:string}}[]}>("/counselors/", token).then(p=>setCounselors(p.results as unknown as typeof counselors)).catch(()=>{}); },[token]);
  useEffect(()=>{
    if(!token || !id) return;
    if(tab==="progress") {
      api<unknown>(`/counselor/students/${id}/progress/`, token).then(setProgress).catch(()=>{});
    }
  },[tab, token, id]);

  if (!token) return <main><p>ابتدا وارد شوید.</p></main>;
  if (!student) return <div className="admin-skeleton" style={{height:"20rem"}} />;

  async function doAssign(){
    const cid = selectedCounselor===""? null : selectedCounselor==="none"? null : Number(selectedCounselor);
    try{ await api(`/students/${id}/`, token, "PATCH", {counselor: cid}); setAssignOpen(false); loadStudent(); }catch(e){ setError(errorMessage(e)); }
  }

  return <div style={{display:"grid", gap:"1rem"}}>
    <div className="admin-card" style={{display:"flex", flexWrap:"wrap", justifyContent:"space-between", gap:"1rem"}}>
      <div>
        <h1 style={{fontSize:"1.3rem", fontWeight:800}}>{student.user.first_name} {student.user.last_name} <small style={{color:"#64748b"}}>@{student.user.username}</small></h1>
        <p style={{color:"#64748b", fontSize:".85rem"}}>عضویت: {student.user.date_joined ? formatTehranDate(student.user.date_joined) : "—"} · {student.user.is_active ? <span className="admin-badge ok">فعال</span> : <span className="admin-badge bad">غیرفعال</span>} · آخرین ورود: {student.user.last_login ? formatJalaliDateTime(student.user.last_login) : "—"}</p>
        <p style={{fontSize:".85rem"}}>{student.grade_name || "—"} / {student.field_name || "—"} {student.school_name ? `· ${student.school_name}` : ""}</p>
        <p style={{fontSize:".85rem"}}>مشاور: {student.counselor_user ? `${student.counselor_user.first_name || student.counselor_user.username} ${student.counselor_user.last_name||""}` : <span className="admin-badge warn">بدون مشاور</span>} · تلگرام: <span className={`admin-badge ${student.telegram_status?.group_connected?"ok":"bad"}`}>{student.telegram_status?.group_connected?"متصل":"قطع"}</span></p>
      </div>
      <div style={{display:"flex", gap:".5rem", alignItems:"start", flexWrap:"wrap"}}>
        <button onClick={()=>setAssignOpen(true)} style={{background:"var(--brand-purple)", color:"white", border:"1px solid var(--brand-purple)", borderRadius:".4rem", padding:".45rem .8rem"}}>تغییر مشاور</button>
      </div>
    </div>
    {error && <p style={{color:"#991b1b"}}>{error}</p>}
    <div className="admin-tabs">
      {tabs.map(t=><button key={t.id} className={tab===t.id?"active":""} onClick={()=>setTab(t.id)}>{t.label}</button>)}
    </div>
    {tab==="overview" && <div className="admin-card">
      <h2>خلاصه</h2>
      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:".7rem", fontSize:".85rem"}}>
        <div>تلگرام: گروه {student.telegram_status?.group_connected?"متصل":"قطع"} · کاربر {student.telegram_status?.student_connected?"متصل":"قطع"}</div>
      </div>
    </div>}
    {tab==="progress" && <div className="admin-card"><h2>عملکرد</h2>{progress ? <pre style={{fontSize:".75rem", overflow:"auto", maxHeight:"30rem", background:"#f8fafc", padding:".6rem", borderRadius:".4rem"}}>{JSON.stringify(progress,null,2)}</pre> : <p>در حال بارگذاری...</p>}</div>}
    {tab==="counselor" && <div className="admin-card">
      <h2>مشاور</h2>
      {student.counselor ? <p>شناسه مشاور: {student.counselor} — {student.counselor_user?.username}</p> : <p>بدون مشاور — از «تغییر مشاور» استفاده کنید.</p>}
      <button onClick={()=>setAssignOpen(true)} style={{border:"1px solid #cbd5e1", background:"white", padding:".4rem .7rem", borderRadius:".4rem"}}>تغییر مشاور</button>
    </div>}
    {tab==="telegram" && <div className="admin-card"><TelegramControl studentId={String(id)} token={token} /></div>}
    {tab==="profile" && <div className="admin-card">
      <h2>پروفایل</h2><StudentMobileStatus token={token} studentId={id}/>
      <div style={{display:"grid", gap:".4rem", fontSize:".85rem"}}>
        <div>نام کاربری: {student.user.username}</div>
        <div>ایمیل: {student.user.email || "—"}</div>
        <div>نام: {student.user.first_name} {student.user.last_name}</div>
        <div>مدرسه: {student.school_name || "—"}</div>
      </div>
    </div>}
    {assignOpen && <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,.35)", display:"grid", placeItems:"center", zIndex:50, padding:"1rem"}}>
      <div style={{background:"white", padding:"1rem", borderRadius:".7rem", width:"100%", maxWidth:"26rem", display:"grid", gap:".7rem"}}>
        <h3>تغییر مشاور — {student.user.username}</h3>
        <select value={selectedCounselor} onChange={e=>setSelectedCounselor(e.target.value)} style={{border:"1px solid #cbd5e1", borderRadius:".4rem", padding:".5rem"}}>
          <option value="">انتخاب کنید</option>
          <option value="none">بدون مشاور</option>
          {counselors.map(c=><option key={c.id} value={String(c.id)}>{c.user.username} — {c.user.first_name} {c.user.last_name}</option>)}
        </select>
        <div style={{display:"flex", gap:".5rem"}}>
          <button onClick={doAssign} style={{flex:1, background:"var(--brand-purple)", color:"white", border:"1px solid var(--brand-purple)", borderRadius:".4rem", padding:".5rem"}}>تأیید</button>
          <button onClick={()=>setAssignOpen(false)} style={{flex:1, background:"white", border:"1px solid #cbd5e1", borderRadius:".4rem", padding:".5rem"}}>انصراف</button>
        </div>
      </div>
    </div>}
  </div>;
}
