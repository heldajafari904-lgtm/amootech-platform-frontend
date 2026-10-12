"use client";
import Link from "next/link";
import TelegramBroadcast from "@/components/TelegramBroadcast";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { gregorianToJalali, JALALI_MONTHS } from "@/lib/jalali";

type Summary = {
  students: { total:number; active:number; inactive:number; unassigned:number; new_7d:number; new_30d:number; without_current_plan:number };
  counselors: { total:number; active:number };
  plans: { total:number; drafts:number; published:number; this_week:number; current_published:number };
  reports: { today_count:number; today_rate:number; not_reported_today:number };
  telegram: { connected_groups:number; connected_students:number; disconnected:number; suspended:number; banned:number; disabled:number; recent_errors:number; bot_reachable:boolean };
  trends: { students_7d:{date:string;count:number}[]; plans_7d:{date:string;count:number}[]; reports_7d:{date:string;count:number}[] };
  workload_preview: { id:number; user__username:string; user__first_name:string; user__last_name:string; students_count:number; active_students:number }[];
  alerts: { type:string; severity:string; message:string; count:number }[];
};

function jalaliLabel(iso:string){
  const [y,m,d]=iso.split("-").map(Number);
  const j=gregorianToJalali(y,m,d);
  return `${j.jd} ${JALALI_MONTHS[j.jm-1]}`;
}
function Trend({ data, colorClass }: { data:{date:string;count:number}[]; colorClass:string }){
  const max=Math.max(1, ...data.map(d=>d.count));
  return <div>
    <div className="admin-trend">
      {data.map((d, i)=><span key={i} className={`admin-trend-bar ${colorClass}`} style={{height: `${Math.max(4, d.count*100/max)}%`}} title={`${d.date}: ${d.count}`} />)}
    </div>
    <div className="admin-trend-label"><span>{jalaliLabel(data[0].date)}</span><span>{jalaliLabel(data[data.length-1].date)}</span></div>
  </div>;
}
export default function DashboardClient(){
  const token = typeof window==="undefined" ? "" : sessionStorage.getItem("amootech_access") || "";
  const [data, setData]=useState<Summary|null>(null);
  const [error, setError]=useState("");
  useEffect(()=>{ if(!token) return; api<Summary>("/admin/dashboard/summary/", token).then(setData).catch(e=>setError(errorMessage(e))); },[token]);
  if(error) return <div className="admin-page-title"><h1>داشبورد</h1><p role="alert" style={{color:"#991b1b"}}>{error}</p></div>;
  if(!data) return <div className="admin-skeleton" style={{height:"20rem"}} />;
  const k=data;
  return <div style={{display:"grid", gap:"1rem"}}>
    <div className="admin-page-title"><h1>داشبورد مدیریت</h1><p>مرکز کنترل مجموعه آموتک — وضعیت لحظه‌ای</p></div>
    <div className="admin-kpi-grid">
      <div className="admin-kpi"><small>کل دانش‌آموزان</small><strong>{k.students.total.toLocaleString("fa-IR")}</strong><em>فعال: {k.students.active} · غیرفعال: {k.students.inactive}</em></div>
      <div className="admin-kpi"><small>بدون مشاور</small><strong style={{color:k.students.unassigned>0?"#92400e":""}}>{k.students.unassigned.toLocaleString("fa-IR")}</strong><em>نیاز به تخصیص</em></div>
      <div className="admin-kpi"><small>مشاوران فعال</small><strong>{k.counselors.active.toLocaleString("fa-IR")}</strong><em>از {k.counselors.total} مشاور</em></div>
      <div className="admin-kpi"><small>تلگرام متصل</small><strong>{k.telegram.connected_groups.toLocaleString("fa-IR")}</strong><em>قطع: {k.telegram.disconnected}</em></div>
      <div className="admin-kpi"><small>مشکلات تلگرام</small><strong style={{color:k.telegram.suspended+k.telegram.banned>0?"#991b1b":""}}>{(k.telegram.suspended+k.telegram.banned).toLocaleString("fa-IR")}</strong><em>تعلیق {k.telegram.suspended} · بن {k.telegram.banned}</em></div>
    </div>
    <TelegramBroadcast token={token} audience="admin" />
    {k.alerts.filter(a => !/plan|report/.test(a.type)).length>0 && <div className="admin-card"><h2>نیازمند توجه</h2>{k.alerts.filter(a => !/plan|report/.test(a.type)).map((a,i)=><div key={i} className={`admin-alert ${a.severity}` }><span>{a.message}</span><span>{a.count}</span></div>)}</div>}
    <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:".8rem"}}>
      <div className="admin-card"><h2>ثبت‌نام ۷ روز اخیر</h2><Trend data={k.trends.students_7d} colorClass="" /></div>
    </div>
    <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:".8rem"}}>
      <div className="admin-card"><h2>بات تلگرام</h2><p style={{display:"flex", gap:".5rem", alignItems:"center"}}><span className={`admin-badge ${k.telegram.bot_reachable?"ok":"bad"}`}>{k.telegram.bot_reachable?"متصل":"قطع"}</span><small style={{color:"#64748b"}}>خطاهای اخیر: {k.telegram.recent_errors}</small></p><p><small>اتصال گروه: {k.telegram.connected_groups} · اتصال کاربر: {k.telegram.connected_students}</small></p><Link href="/admin/telegram" style={{color:"var(--brand-purple)", fontWeight:700}}>مدیریت تلگرام ←</Link></div>
      <div className="admin-card"><h2>بار کاری مشاوران (۵ نفر اول)</h2>{k.workload_preview.length? k.workload_preview.map(w=><div key={w.id} style={{display:"flex", justifyContent:"space-between", padding:".4rem 0", borderBottom:"1px solid #f1f5f9"}}><span>{w.user__first_name || w.user__username} {w.user__last_name}</span><span style={{fontWeight:700}}>{w.students_count} دانش‌آموز ({w.active_students} فعال)</span></div>): <p className="admin-empty">مشاوری ثبت نشده</p>}<Link href="/admin/counselors" style={{color:"var(--brand-purple)", fontWeight:700}}>مشاهده مشاوران ←</Link></div>
    </div>
    <div style={{display:"flex", gap:".5rem", flexWrap:"wrap"}}><Link href="/admin/students" style={{background:"var(--brand-purple)", color:"white", padding:".6rem 1rem", borderRadius:".5rem", textDecoration:"none", fontWeight:700}}>مدیریت دانش‌آموزان</Link></div>
  </div>;
}
