"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, errorMessage } from "@/lib/api";
import { formatJalali } from "@/lib/planning";

type Summary = {
  counselor:{id:number; username:string; first_name:string; last_name:string; is_active:boolean; date_joined:string|null};
  students_count:number;
  active_students:number;
  plans:{total:number; drafts:number; published:number};
  reports_today:number;
  recent_plans:{id:number; student__user__username:string; title:string; status:string; start_date:string; end_date:string; created_at:string}[];
  students:{id:number; user__username:string; user__first_name:string; user__last_name:string; user__is_active:boolean; grade__name:string|null; field__name:string|null; school_name:string; user__date_joined:string}[];
};

export default function CounselorDetail(){
  const { id } = useParams<{id:string}>();
  const token = typeof window==="undefined" ? "" : sessionStorage.getItem("amootech_access") || "";
  const [data, setData]=useState<Summary|null>(null);
  const [error, setError]=useState("");
  const load=useCallback(async()=>{ if(!token||!id) return; try{ const s=await api<Summary>(`/admin/counselors/${id}/summary/`, token); setData(s);}catch(e){ setError(errorMessage(e)); } },[token,id]);
  useEffect(()=>{ void Promise.resolve().then(() => load()); },[load]);
  if(error) return <p style={{color:"#991b1b"}}>{error}</p>;
  if(!data) return <div className="admin-skeleton" style={{height:"20rem"}} />;
  return <div style={{display:"grid", gap:"1rem"}}>
    <div className="admin-card">
      <h1 style={{fontSize:"1.2rem", fontWeight:800}}>{data.counselor.first_name} {data.counselor.last_name} <small style={{color:"#64748b"}}>@{data.counselor.username}</small></h1>
      <p style={{color:"#64748b", fontSize:".85rem"}}>عضویت: {data.counselor.date_joined ? formatJalali(data.counselor.date_joined.slice(0,10), false) : "—"} · {data.counselor.is_active ? <span className="admin-badge ok">فعال</span> : <span className="admin-badge bad">غیرفعال</span>}</p>
      <div style={{display:"flex", gap:".5rem", flexWrap:"wrap", marginTop:".5rem"}}>
        <span className="admin-badge purple">{data.students_count} دانش‌آموز</span>
        <span className="admin-badge ok">{data.active_students} فعال</span>
      </div>
    </div>
    <div className="admin-card">
      <h2>دانش‌آموزان ({data.students.length})</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>دانش‌آموز</th><th>پایه/رشته</th><th>وضعیت</th><th>مدرسه</th><th>اقدام</th></tr></thead>
          <tbody>{data.students.map(s=><tr key={s.id}><td>{s.user__first_name} {s.user__last_name} <small style={{color:"#64748b"}}>@{s.user__username}</small></td><td>{s.grade__name||"—"} / {s.field__name||"—"}</td><td><span className={`admin-badge ${s.user__is_active?"ok":"bad"}`}>{s.user__is_active?"فعال":"غیرفعال"}</span></td><td>{s.school_name||"—"}</td><td><Link href={`/admin/students/${s.id}`} style={{color:"var(--brand-purple)"}}>جزئیات</Link></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  </div>;
}
