"use client";

import { useEffect, useRef, useState } from "react";
import { allPages, api, errorMessage } from "@/lib/api";
import { useDialogFocus } from "@/components/counselor/PanelUI";
import { examDate } from "@/components/exams/ExamUI";
import { rememberManualExam, safePDFUrl } from "@/components/exams/manualFlow";
import type { CounselorExam as Exam } from "./workspace";

type Management = {
  exam: Exam; busy: boolean; can_publish: boolean; can_unpublish: boolean;
  can_edit_questions: boolean; edit_explanation: string; can_remote_delete: boolean;
  reset_explanation: string;
  operation: { kind: string; state: string; edit_session: string | null } | null;
};
type History = { id: number; actor: string | null; action: string; outcome: string; created_at: string; previous: Record<string, unknown>; current: Record<string, unknown> };
const labels: Record<string, string> = { SCHEDULE: "تغییر زمان‌بندی", rename: "ویرایش عنوان", archive: "بایگانی", unarchive: "خروج از بایگانی", trash: "انتقال به سطل زباله", restore: "بازیابی از سطل زباله", unpublish: "لغو انتشار", publish: "انتشار", EDIT_REQUEST: "درخواست ویرایش سوال", EDIT_READY: "آماده ویرایش", EDIT_RECONCILED: "تطبیق پس از ویرایش", SYNC_METADATA: "تطبیق مشخصات", REMOTE_DELETE_REQUEST: "درخواست حذف از سرویس", REMOTE_DELETE_OUTCOME: "نتیجه حذف از سرویس" };

export default function ManagementPanel({ examId, token, userId, onChanged, onClose }: { examId: number; token: string; userId: number; onChanged: (exam: Exam) => void; onClose: () => void }) {
  const [data, setData] = useState<Management | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [confirmedTitle, setConfirmedTitle] = useState("");
  const [confirmedId, setConfirmedId] = useState("");
  const [consent, setConsent] = useState(false);
  const lock = useRef(false);
  useDialogFocus(true, () => { if (!lock.current) onClose(); });
  useEffect(() => {
    let live = true;
    Promise.all([api<Management>(`/exams/${examId}/management/`, token), allPages<History>(`/exams/${examId}/history/`, token)])
      .then(([value, events]) => { if (live) { setData(value); setTitle(value.exam.title); setHistory(events); } })
      .catch(reason => { if (live) setError(errorMessage(reason)); });
    return () => { live = false; };
  }, [examId, token]);

  async function mutate(action: string) {
    if (lock.current || !data) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const base = `/exams/${examId}`;
      if (action === "edit" || action === "resume") {
        const response = await api<{ edit_url: string; edit_session: string }>(`${base}/edit-questions/`, token, "POST", { expected_updated_at: data.exam.updated_at, request_key: action === "resume" ? data.operation?.edit_session : crypto.randomUUID() });
        const url = safePDFUrl(response.edit_url);
        if (!url) throw new Error("نشانی ویرایش معتبر نیست.");
        rememberManualExam(sessionStorage, userId, examId);
        sessionStorage.setItem(`amootech-edit-${userId}-${examId}`, response.edit_session);
        window.location.assign(url);
        return;
      }
      if (action === "remote") {
        await api(`${base}/remote-delete/`, token, "POST", { expected_updated_at: data.exam.updated_at, request_key: crypto.randomUUID(), confirm_remote_delete: consent, provider_exam_id: confirmedId, confirmed_title: confirmedTitle });
      } else if (action === "sync") {
        await api(`${base}/sync/`, token, "POST", { edit_session: data.operation?.edit_session });
      } else if (action === "publish") {
        await api(`${base}/publish/`, token, "POST", { expected_updated_at: data.exam.updated_at });
      } else {
        await api(`${base}/management/`, token, "POST", { action, expected_updated_at: data.exam.updated_at, ...(action === "rename" ? { title } : {}) });
      }
      setConfirm(null); setNotice("عملیات ثبت شد.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally {
      try {
        const value = await api<Management>(`/exams/${examId}/management/`, token);
        setData(value); setTitle(value.exam.title); onChanged(value.exam);
        setHistory(await allPages<History>(`/exams/${examId}/history/`, token));
      } catch (reason) { setError(errorMessage(reason)); }
      lock.current = false; setBusy(false);
    }
  }
  const exam = data?.exam;
  return <div className="exam-dialog-backdrop"><section className="exam-dialog exam-management-dialog" role="dialog" aria-modal="true" aria-labelledby="exam-management-title" dir="rtl" aria-busy={busy}>
    <div className="exam-section-heading"><h2 id="exam-management-title">مدیریت {exam?.title || "آزمون"}</h2><button type="button" className="exam-secondary" disabled={busy} onClick={onClose}>بستن</button></div>
    {error && <p role="alert" className="exam-feedback">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!data ? <p role="status">در حال دریافت اطلاعات…</p> : <>
      <form className="exam-form" onSubmit={event => { event.preventDefault(); void mutate("rename"); }}><label>عنوان محلی آزمون<input required maxLength={200} value={title} disabled={busy || data.busy || !!exam?.trashed_at} onChange={event => setTitle(event.target.value)}/></label><button className="exam-secondary" disabled={busy || data.busy || !!exam?.trashed_at || title.trim() === exam?.title}>ذخیره عنوان</button></form>
      <div className="exam-actions">
        <button className="exam-secondary" disabled={busy || !data.can_edit_questions} onClick={() => void mutate("edit")}>ویرایش سوال / ادامه ساخت ↗</button>
        <button className="exam-secondary" disabled={busy || !data.can_publish} onClick={() => void mutate("publish")}>انتشار</button>
        <button className="exam-secondary" disabled={busy || !data.can_unpublish} onClick={() => setConfirm("unpublish")}>لغو انتشار</button>
        {exam?.trashed_at ? <button className="exam-secondary" disabled={busy || data.busy} onClick={() => void mutate("restore")}>بازیابی از سطل زباله</button> : <>
          <button className="exam-secondary" disabled={busy || data.busy} onClick={() => void mutate(exam?.archived_at ? "unarchive" : "archive")}>{exam?.archived_at ? "خروج از بایگانی" : "بایگانی"}</button>
          <button className="exam-secondary" disabled={busy || data.busy} onClick={() => setConfirm("trash")}>انتقال به سطل زباله</button>
        </>}
        {data.can_remote_delete && <button className="exam-secondary" disabled={busy} onClick={() => setConfirm("remote")}>حذف دائمی از Quiz24</button>}
      </div>
      <p className="exam-muted">{data.edit_explanation}</p><p className="exam-muted">{data.reset_explanation}</p>
      <p className="exam-muted">بایگانی و سطل زباله، شروع جدید را متوقف می‌کنند و سوابق را نگه می‌دارند. لینک صادرشده قبلی در Quiz24 با این عملیات لغو نمی‌شود.</p>
      {data.operation && <p role="status">وضعیت عملیات سرویس: <bdi>{data.operation.state}</bdi>{data.operation.state === "UNKNOWN" && " — نتیجه نامطمئن است؛ پیش از بررسی، درخواست دوباره ارسال نکنید."}</p>}
      {data.operation?.kind === "EDIT" && data.operation.edit_session && data.operation.state === "EDITING" && <button className="exam-secondary" disabled={busy} onClick={() => void mutate("resume")}>ادامه همان جلسه ویرایش ↗</button>}
      {data.operation?.kind === "EDIT" && data.operation.edit_session && ["EDITING", "UNKNOWN"].includes(data.operation.state) && <button className="exam-secondary" disabled={busy} onClick={() => { if (window.confirm("ویرایش را در Quiz24 ذخیره و صفحه ویرایش را بسته‌اید؟")) void mutate("sync"); }}>بررسی و تطبیق پس از پایان ویرایش</button>}
      {confirm && <div className="exam-management-confirm" role="group" aria-label="تأیید عملیات"><p>{confirm === "remote" ? "حذف سرویس برگشت‌پذیر نیست. عنوان و شناسه دقیق آزمون را وارد کنید." : `${labels[confirm]} انجام شود؟ تلاش‌ها و نتایج حفظ می‌شوند.`}</p>
        {confirm === "remote" && <><p>شناسه مرتبط: <bdi>{exam?.provider_exam_id}</bdi></p><label>عنوان دقیق<input value={confirmedTitle} onChange={event => setConfirmedTitle(event.target.value)}/></label><label>شناسه Quiz24<input dir="ltr" value={confirmedId} onChange={event => setConfirmedId(event.target.value)}/></label><label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/>حذف دائمی همین آزمون از سرویس را تأیید می‌کنم</label></>}
        <button className="exam-primary" disabled={busy || (confirm === "remote" && (!consent || confirmedTitle !== exam?.title || confirmedId !== exam?.provider_exam_id))} onClick={() => void mutate(confirm)}>تأیید {confirm === "remote" ? "حذف دائمی" : labels[confirm]}</button><button className="exam-secondary" disabled={busy} onClick={() => setConfirm(null)}>انصراف</button>
      </div>}
      <h3>تاریخچه مدیریت</h3>{!history.length ? <p>رویدادی ثبت نشده است.</p> : <ol className="exam-management-history">{history.map(row => <li key={row.id}><strong>{labels[row.action] || labels[row.action.toLowerCase()] || row.action}</strong> · {row.actor || "سامانه"} · <time dateTime={row.created_at}>{examDate(row.created_at)}</time> · <bdi>{row.outcome}</bdi><details><summary>تغییرات</summary><pre dir="ltr">{JSON.stringify({ previous: row.previous, current: row.current }, null, 2)}</pre></details></li>)}</ol>}
    </>}
  </section></div>;
}
