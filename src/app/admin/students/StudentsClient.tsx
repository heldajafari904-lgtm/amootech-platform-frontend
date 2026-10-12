"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, Page, errorMessage } from "@/lib/api";
import { formatJalali } from "@/lib/planning";

type Row = {
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

export default function StudentsClient(){
  const token = typeof window==="undefined" ? "" : sessionStorage.getItem("amootech_access") || "";
  const [rows, setRows]=useState<Row[]>([]);
  const [count, setCount]=useState(0);
  const [next, setNext]=useState<string|null>(null);
  const [prev, setPrev]=useState<string|null>(null);
  const [loading, setLoading]=useState(true);
  const [error, setError]=useState("");
  // filters
  const [q, setQ]=useState("");
  const [isActive, setIsActive]=useState("");
  const [counselor, setCounselor]=useState("");
  const [telegram, setTelegram]=useState("");
  const [counselors, setCounselors]=useState<{id:number; user:{username:string; first_name:string; last_name:string}}[]>([]);
  const [selected, setSelected]=useState<Set<number>>(new Set());
  const [bulkCounselor, setBulkCounselor]=useState("");

  const buildQuery = useCallback(()=>{
    const p=new URLSearchParams();
    if(q) p.set("q", q);
    if(isActive) p.set("is_active", isActive);
    if(counselor) p.set("counselor", counselor);
    if(telegram) p.set("telegram", telegram);
    const qs=p.toString();
    return qs ? `/students/?${qs}` : "/students/";
  },[q,isActive,counselor,telegram]);

  const load = useCallback(async(url?:string)=>{
    setLoading(true); setError("");
    try{
      const target=url || buildQuery();
      const page=await api<Page<Row>>(target, token);
      setRows(page.results); setCount(page.count); setNext(page.next); setPrev(page.previous);
    }catch(e){ setError(errorMessage(e)); }
    finally{ setLoading(false); }
  },[token, buildQuery]);

  useEffect(()=>{ if(token) void Promise.resolve().then(() => load()); },[load, token]);
  useEffect(()=>{ if(token) api<Page<{id:number; user:{username:string; first_name:string; last_name:string}}>>("/counselors/", token).then(p=>setCounselors(p.results as unknown as typeof counselors)).catch(()=>{}); },[token]);

  async function doBulk(){
    if(selected.size===0) return;
    // when bulkCounselor==="none", we unassign (null)
    const payload={student_ids:[...selected], counselor_id: bulkCounselor==="none"? null : (bulkCounselor? Number(bulkCounselor): null)};
    if(!bulkCounselor) return;
    try{ await api("/admin/students/bulk-assign/", token, "POST", payload); setSelected(new Set()); load(); }catch(e){ setError(errorMessage(e)); }
  }

  return <div style={{display:"grid", gap:"1rem"}}>
    <div className="admin-page-title"><h1>دانش‌آموزان</h1><p>{count.toLocaleString("fa-IR")} دانش‌آموز</p></div>
    <div className="admin-filters">
      <label>جستجو<input placeholder="نام، نام‌خانوادگی، نام‌کاربری، مدرسه" value={q} onChange={e=>setQ(e.target.value)} /></label>
      <label>وضعیت<select value={isActive} onChange={e=>setIsActive(e.target.value)}><option value="">همه</option><option value="true">فعال</option><option value="false">غیرفعال</option></select></label>
      <label>مشاور<select value={counselor} onChange={e=>setCounselor(e.target.value)}><option value="">همه</option><option value="none">بدون مشاور</option>{counselors.map(c=><option key={c.id} value={String(c.id)}>{c.user.first_name || c.user.username} {c.user.last_name}</option>)}</select></label>
      <label>تلگرام<select value={telegram} onChange={e=>setTelegram(e.target.value)}><option value="">همه</option><option value="connected">متصل</option><option value="disconnected">قطع</option></select></label>
      <button onClick={()=>load()} style={{background:"var(--brand-purple)", color:"white", border:"1px solid var(--brand-purple)", borderRadius:".4rem", padding:".5rem .9rem"}}>اعمال</button>
    </div>
    <div className="admin-card" style={{padding:".6rem", flexDirection:"row", display:"flex", gap:".5rem", flexWrap:"wrap", alignItems:"center"}}>
      <span style={{fontSize:".82rem", color:"#475569"}}>{selected.size} انتخاب شده</span>
      <select value={bulkCounselor} onChange={e=>setBulkCounselor(e.target.value)} style={{border:"1px solid #cbd5e1", borderRadius:".35rem", padding:".35rem"}}><option value="">انتخاب مشاور برای تخصیص</option><option value="none">بدون مشاور (حذف تخصیص)</option>{counselors.map(c=><option key={c.id} value={String(c.id)}>{c.user.username}</option>)}</select>
      <button disabled={selected.size===0 || !bulkCounselor} onClick={doBulk} style={{background: selected.size && bulkCounselor ? "var(--brand-purple)":"#e2e8f0", color: selected.size && bulkCounselor? "white":"#64748b", border:"1px solid #cbd5e1", borderRadius:".35rem", padding:".4rem .7rem"}}>تخصیص گروهی</button>
      <Link href="/admin/students/new" style={{marginInlineStart:"auto", background:"white", border:"1px solid #cbd5e1", padding:".4rem .7rem", borderRadius:".4rem", textDecoration:"none"}}>افزودن دانش‌آموز</Link>
    </div>
    {error && <p role="alert" style={{color:"#991b1b"}}>{error}</p>}
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th><input type="checkbox" checked={rows.length>0 && selected.size===rows.length} onChange={e=> setSelected(e.target.checked? new Set(rows.map(r=>r.id)) : new Set())} /></th><th>دانش‌آموز</th><th>وضعیت</th><th>پایه/رشته</th><th>مشاور</th><th>تاریخ عضویت</th><th>تلگرام</th><th>اقدام</th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={8}><div className="admin-skeleton" /></td></tr> :
           rows.length===0 ? <tr><td colSpan={8}><div className="admin-empty">موردی یافت نشد</div></td></tr> :
           rows.map(r=>
            <tr key={r.id}>
              <td><input type="checkbox" checked={selected.has(r.id)} onChange={e=>{ const s=new Set(selected); if(e.target.checked) s.add(r.id); else s.delete(r.id); setSelected(s); }} /></td>
              <td><div style={{display:"grid"}}><strong>{r.user.first_name} {r.user.last_name} <small style={{color:"#64748b"}}>@{r.user.username}</small></strong><small style={{color:"#64748b"}}>{r.school_name || "—"}</small></div></td>
              <td><span className={`admin-badge ${r.user.is_active?"ok":"bad"}`}>{r.user.is_active?"فعال":"غیرفعال"}</span></td>
              <td>{r.grade_name || "—"} / {r.field_name || "—"}</td>
              <td>{r.counselor_user ? `${r.counselor_user.first_name || r.counselor_user.username} ${r.counselor_user.last_name||""}` : <span className="admin-badge warn">بدون مشاور</span>}</td>
              <td>{r.user.date_joined ? formatJalali(r.user.date_joined.slice(0,10), false) : "—"}</td>
              <td>
                <span className={`admin-badge ${r.telegram_status?.group_connected?"ok":"bad"}`}>{r.telegram_status?.group_connected?"متصل":"قطع"}</span>
                {r.telegram_status?.suspended && <span className="admin-badge bad" style={{marginInlineStart:".25rem"}}>تعلیق</span>}
                {r.telegram_status?.banned && <span className="admin-badge bad" style={{marginInlineStart:".25rem"}}>بن</span>}
                {!r.telegram_status?.enabled && <span className="admin-badge warn" style={{marginInlineStart:".25rem"}}>غیرفعال</span>}
              </td>
              <td style={{display:"flex", gap:".3rem", flexWrap:"wrap"}}>
                <Link href={`/admin/students/${r.id}`} style={{border:"1px solid #cbd5e1", padding:".25rem .5rem", borderRadius:".35rem", textDecoration:"none", color:"var(--brand-purple)"}}>جزئیات</Link>
                <Link href={`/admin/students/${r.id}?tab=telegram`} style={{border:"1px solid #e9d5ff", background:"#faf5ff", padding:".25rem .5rem", borderRadius:".35rem", textDecoration:"none"}}>تلگرام</Link>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    <div className="admin-pagination">
      <span style={{fontSize:".85rem", color:"#475569"}}>{count} مورد</span>
      <div style={{display:"flex", gap:".4rem"}}>
        <button disabled={!prev} onClick={()=> prev && load(prev)}>قبلی</button>
        <button disabled={!next} onClick={()=> next && load(next)}>بعدی</button>
      </div>
    </div>
  </div>;
}
