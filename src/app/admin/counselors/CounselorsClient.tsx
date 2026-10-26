"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, Page, errorMessage } from "@/lib/api";
import { formatTehranDate } from "@/lib/planning";

type Row = {
  id:number;
  user:{id:number; username:string; first_name:string; last_name:string; email:string; is_active:boolean; date_joined:string; last_login:string|null};
  students_count?:number;
  active_students_count?:number;
  plans_count?:number;
};

export default function CounselorsClient(){
  const token = typeof window==="undefined" ? "" : sessionStorage.getItem("amootech_access") || "";
  const [rows, setRows]=useState<Row[]>([]);
  const [count, setCount]=useState(0);
  const [next,setNext]=useState<string|null>(null);
  const [prev,setPrev]=useState<string|null>(null);
  const [q,setQ]=useState("");
  const [isActive,setIsActive]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const buildQuery=useCallback(()=>{
    const p=new URLSearchParams();
    if(q) p.set("q", q);
    if(isActive) p.set("is_active", isActive);
    const qs=p.toString();
    return qs ? `/counselors/?${qs}` : "/counselors/";
  },[q,isActive]);

  const load=useCallback(async(url?:string)=>{
    setLoading(true); setError("");
    try{ const page=await api<Page<Row>>(url||buildQuery(), token); setRows(page.results); setCount(page.count); setNext(page.next); setPrev(page.previous); }catch(e){ setError(errorMessage(e)); } finally{ setLoading(false); }
  },[token, buildQuery]);
  useEffect(()=>{ if(token) void Promise.resolve().then(() => load()); },[load, token]);

  return <div style={{display:"grid", gap:"1rem"}}>
    <div className="admin-page-title"><h1>مشاوران</h1><p>{count.toLocaleString("fa-IR")} مشاور</p></div>
    <div className="admin-filters">
      <label>جستجو<input placeholder="نام، نام‌کاربری" value={q} onChange={e=>setQ(e.target.value)} /></label>
      <label>وضعیت<select value={isActive} onChange={e=>setIsActive(e.target.value)}><option value="">همه</option><option value="true">فعال</option><option value="false">غیرفعال</option></select></label>
      <button onClick={()=>load()} style={{background:"var(--brand-purple)", color:"white", border:"1px solid var(--brand-purple)", borderRadius:".4rem", padding:".5rem .9rem"}}>اعمال</button>
    </div>
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>مشاور</th><th>وضعیت</th><th>تاریخ عضویت</th><th>دانش‌آموزان</th><th>فعال</th><th>اقدام</th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={6}><div className="admin-skeleton"/></td></tr> :
           rows.length===0 ? <tr><td colSpan={6}><div className="admin-empty">موردی یافت نشد</div></td></tr> :
           rows.map(r=><tr key={r.id}>
            <td><strong>{r.user.first_name} {r.user.last_name} <small style={{color:"#64748b"}}>@{r.user.username}</small></strong></td>
            <td><span className={`admin-badge ${r.user.is_active?"ok":"bad"}`}>{r.user.is_active?"فعال":"غیرفعال"}</span></td>
            <td>{r.user.date_joined ? formatTehranDate(r.user.date_joined) : "—"}</td>
            <td><span className="admin-badge purple">{(r.students_count??0).toLocaleString("fa-IR")} نفر</span></td>
            <td>{(r.active_students_count??0).toLocaleString("fa-IR")}</td>
            <td><Link href={`/admin/counselors/${r.id}`} style={{border:"1px solid #cbd5e1", padding:".25rem .5rem", borderRadius:".35rem", textDecoration:"none", color:"var(--brand-purple)"}}>جزئیات</Link></td>
           </tr>)}
        </tbody>
      </table>
    </div>
    <div className="admin-pagination"><span style={{fontSize:".85rem", color:"#475569"}}>{count} مورد</span><div style={{display:"flex", gap:".4rem"}}><button disabled={!prev} onClick={()=>prev&&load(prev)}>قبلی</button><button disabled={!next} onClick={()=>next&&load(next)}>بعدی</button></div></div>
    {error && <p style={{color:"#991b1b"}}>{error}</p>}
  </div>;
}
