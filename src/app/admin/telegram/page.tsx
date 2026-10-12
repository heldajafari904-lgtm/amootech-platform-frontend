"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, Page, errorMessage } from "@/lib/api";
import { formatJalaliDateTime } from "@/lib/planning";

type TelegramSummary = {
  total_students:number;
  connected_groups:number;
  connected_students:number;
  disconnected:number;
  suspended:number;
  banned:number;
  disabled:number;
  bot_reachable:boolean;
  recent_logs:{id:number; action:string; success:boolean; reason:string; created_at:string; actor__username:string|null; student__user__username:string}[];
};
type Row = {
  id:number;
  user:{username:string; first_name:string; last_name:string};
  telegram_status:{group_connected:boolean; student_connected:boolean; chat_title:string|null; telegram_username:string|null; enabled:boolean; suspended:boolean; banned:boolean};
};

export default function TelegramDashboard(){
  const token = typeof window==="undefined" ? "" : sessionStorage.getItem("amootech_access") || "";
  const [summary, setSummary]=useState<TelegramSummary|null>(null);
  const [rows, setRows]=useState<Row[]>([]);
  const [q, setQ]=useState("");
  const [filter, setFilter]=useState("");
  const [loading, setLoading]=useState(true);
  const [error, setError]=useState("");

  const loadSummary=useCallback(async()=>{ if(!token) return; try{ const s=await api<TelegramSummary>("/admin/telegram/summary/", token); setSummary(s);}catch(e){ setError(errorMessage(e)); } },[token]);
  const loadStudents=useCallback(async()=>{
    if(!token) return;
    setLoading(true);
    try{
      const params=new URLSearchParams();
      if(q) params.set("q", q);
      if(filter==="connected") params.set("telegram","connected");
      if(filter==="disconnected") params.set("telegram","disconnected");
      const qs=params.toString();
      const page=await api<Page<Row>>(qs? `/students/?${qs}` : "/students/", token);
      let filtered=page.results;
      if(filter==="suspended") filtered=filtered.filter(r=>r.telegram_status?.suspended);
      if(filter==="banned") filtered=filtered.filter(r=>r.telegram_status?.banned);
      if(filter==="disabled") filtered=filtered.filter(r=>r.telegram_status && !r.telegram_status.enabled);
      setRows(filtered);
    }catch(e){ setError(errorMessage(e)); } finally{ setLoading(false); }
  },[token, q, filter]);
  useEffect(()=>{ void Promise.resolve().then(() => loadSummary()); },[loadSummary]);
  useEffect(()=>{ void Promise.resolve().then(() => loadStudents()); },[loadStudents]);

  return <div style={{display:"grid", gap:"1rem"}}>
    <div className="admin-page-title"><h1>تلگرام و بات</h1><p>وضعیت اتصال و کنترل بات</p></div>
    {error && <p style={{color:"#991b1b"}}>{error}</p>}
    {summary ? <div className="admin-kpi-grid">
      <div className="admin-kpi"><small>متصل (گروه)</small><strong>{summary.connected_groups.toLocaleString("fa-IR")}</strong><em>از {summary.total_students}</em></div>
      <div className="admin-kpi"><small>قطع</small><strong>{summary.disconnected.toLocaleString("fa-IR")}</strong><em>بدون گروه</em></div>
      <div className="admin-kpi"><small>تعلیق</small><strong style={{color: summary.suspended?"#991b1b":""}}>{summary.suspended.toLocaleString("fa-IR")}</strong></div>
      <div className="admin-kpi"><small>بن</small><strong style={{color: summary.banned?"#991b1b":""}}>{summary.banned.toLocaleString("fa-IR")}</strong></div>
      <div className="admin-kpi"><small>بات</small><strong>{summary.bot_reachable ? "متصل" : "قطع"}</strong><em className={`admin-badge ${summary.bot_reachable?"ok":"bad"}`}>{summary.bot_reachable?"Online":"Unavailable"}</em></div>
    </div> : <div className="admin-skeleton" />}
    <div className="admin-filters">
      <label>جستجو<input value={q} onChange={e=>setQ(e.target.value)} placeholder="نام، نام‌کاربری" /></label>
      <label>فیلتر<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">همه</option><option value="connected">متصل</option><option value="disconnected">قطع</option><option value="suspended">تعلیق</option><option value="banned">بن</option><option value="disabled">غیرفعال</option></select></label>
      <button onClick={()=>{loadStudents(); loadSummary();}} style={{background:"var(--brand-purple)", color:"white", border:"1px solid var(--brand-purple)", borderRadius:".4rem", padding:".5rem .9rem"}}>اعمال</button>
    </div>
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>دانش‌آموز</th><th>گروه</th><th>کاربر</th><th>وضعیت</th><th>اقدام</th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={5}><div className="admin-skeleton"/></td></tr> :
           rows.length===0 ? <tr><td colSpan={5}><div className="admin-empty">موردی یافت نشد</div></td></tr> :
           rows.map(r=><tr key={r.id}>
            <td>{r.user.first_name} {r.user.last_name} <small style={{color:"#64748b"}}>@{r.user.username}</small></td>
            <td>{r.telegram_status?.group_connected ? <span className="admin-badge ok">متصل</span> : <span className="admin-badge bad">قطع</span>} {r.telegram_status?.chat_title && <small> {r.telegram_status.chat_title}</small>}</td>
            <td>{r.telegram_status?.student_connected ? <span className="admin-badge ok">متصل</span> : <span className="admin-badge neutral">قطع</span>} {r.telegram_status?.telegram_username && <small>@{r.telegram_status.telegram_username}</small>}</td>
            <td>
              {r.telegram_status?.suspended && <span className="admin-badge bad" style={{marginInlineEnd:".25rem"}}>تعلیق</span>}
              {r.telegram_status?.banned && <span className="admin-badge bad" style={{marginInlineEnd:".25rem"}}>بن</span>}
              {r.telegram_status && !r.telegram_status.enabled && <span className="admin-badge warn">غیرفعال</span>}
              {!r.telegram_status?.suspended && !r.telegram_status?.banned && r.telegram_status?.enabled && r.telegram_status?.group_connected && <span className="admin-badge ok">عادی</span>}
            </td>
            <td><Link href={`/admin/students/${r.id}?tab=telegram`} style={{color:"var(--brand-purple)", fontWeight:700}}>کنترل ←</Link></td>
           </tr>)}
        </tbody>
      </table>
    </div>
    <div className="admin-card">
      <h2>تاریخچه اخیر عملیات</h2>
      {summary?.recent_logs.length ? <table className="admin-table"><thead><tr><th>زمان</th><th>دانش‌آموز</th><th>اقدام</th><th>نتیجه</th></tr></thead><tbody>{summary.recent_logs.map(l=><tr key={l.id}><td>{formatJalaliDateTime(l.created_at)}</td><td>{l.student__user__username}</td><td>{l.action}</td><td><span className={`admin-badge ${l.success?"ok":"bad"}`}>{l.success?"موفق":"ناموفق"}</span></td></tr>)}</tbody></table> : <p className="admin-empty">تاریخچه‌ای وجود ندارد</p>}
    </div>
  </div>;
}
