"use client";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { commitmentLabel, type Commitment, type SchoolSlot, WEEKDAY_ORDER } from "@/lib/planning";
import { planningApi } from "./planningApi";
import { apiErrorMessage } from "./planningFeedback";

const WEEKDAY_LABEL: Record<number, string> = { 5: "شنبه", 6: "یکشنبه", 0: "دوشنبه", 1: "سه‌شنبه", 2: "چهارشنبه", 3: "پنج‌شنبه", 4: "جمعه" };
const KIND_OPTIONS: { value: Commitment["kind"]; label: string }[] = [
  { value: "CLASS", label: "کلاس" },
  { value: "SPORTS", label: "ورزش / باشگاه" },
  { value: "COMMUTE", label: "رفت‌وآمد" },
  { value: "OTHER", label: "سایر" },
];

function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {WEEKDAY_ORDER.map((wd) => {
        const active = value.includes(wd);
        return (
          <button key={wd} type="button" onClick={() => onChange(active ? value.filter((x) => x !== wd) : [...value, wd].sort((a, b) => WEEKDAY_ORDER.indexOf(a as never) - WEEKDAY_ORDER.indexOf(b as never)))} style={{ padding: "6px 10px", borderRadius: 8, border: active ? "1px solid #5B0FAD" : "1px solid #e7e1ec", background: active ? "#f6f1fb" : "white", color: active ? "#5B0FAD" : "#16041E", fontWeight: active ? 700 : 400 }}>
            {WEEKDAY_LABEL[wd]}
          </button>
        );
      })}
    </div>
  );
}

export default function FixedSchedulePanel({ token, studentId, commitments, schoolSlots, onRefresh }: { token: string; studentId: string; commitments: Commitment[]; schoolSlots: SchoolSlot[]; onRefresh: () => void }) {
  const [tab, setTab] = useState<"school" | "other">("school");
  const client = useMemo(() => planningApi(token), [token]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const sid = Number(studentId);

  // School hours form
  const schoolCommitments = commitments.filter((c) => c.kind === "SCHOOL");
  const otherCommitments = commitments.filter((c) => c.kind !== "SCHOOL");
  const [schoolWeekdays, setSchoolWeekdays] = useState<number[]>(() => [...new Set(schoolCommitments.filter((c) => c.active).map((c) => c.weekday))].sort((a, b) => WEEKDAY_ORDER.indexOf(a as never) - WEEKDAY_ORDER.indexOf(b as never)));
  const [schoolStart, setSchoolStart] = useState("07:30");
  const [schoolEnd, setSchoolEnd] = useState("13:30");
  const [schoolValidFrom, setSchoolValidFrom] = useState("");
  const [schoolValidUntil, setSchoolValidUntil] = useState("");
  const [schoolBusy, setSchoolBusy] = useState(false);

  // Per-day override editing for school
  const [editSchoolId, setEditSchoolId] = useState<number | null>(null);
  const [editSchoolStart, setEditSchoolStart] = useState("");
  const [editSchoolEnd, setEditSchoolEnd] = useState("");

  // Other activity form
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Commitment["kind"]>("CLASS");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("20:00");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Commitment | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editKind, setEditKind] = useState<Commitment["kind"]>("CLASS");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  // School slots (periods)
  const [slotWeekday, setSlotWeekday] = useState<number>(5);
  const [slotPeriods, setSlotPeriods] = useState<{ period: number; subject_name: string }[]>(() => Array.from({ length: 4 }, (_, i) => ({ period: i + 1, subject_name: "" })));
  const [slotsBusy, setSlotsBusy] = useState(false);

  function notify(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 2500);
  }

  async function submitSchool() {
    if (!schoolWeekdays.length) { setError("حداقل یک روز را انتخاب کنید."); return; }
    setSchoolBusy(true); setError("");
    try {
      await client.schoolHours({ student: sid, weekdays: schoolWeekdays, start_time: schoolStart, end_time: schoolEnd, title: "مدرسه", valid_from: schoolValidFrom || null, valid_until: schoolValidUntil || null });
      notify("برنامه مدرسه ذخیره شد.");
      onRefresh();
    } catch (e) { setError(apiErrorMessage(e)); } finally { setSchoolBusy(false); }
  }

  async function saveSchoolEdit(c: Commitment) {
    setError("");
    try {
      await client.updateCommitment(c.id, { start_time: editSchoolStart, end_time: editSchoolEnd });
      setEditSchoolId(null); notify("ساعت مدرسه ویرایش شد."); onRefresh();
    } catch (e) { setError(apiErrorMessage(e)); }
  }

  async function submitOther() {
    if (!title.trim()) { setError("عنوان را وارد کنید."); return; }
    if (!weekdays.length) { setError("حداقل یک روز انتخاب کنید."); return; }
    setBusy(true); setError("");
    try {
      if (weekdays.length === 1) {
        await client.createCommitment({ student: sid, kind, title: title.trim(), weekday: weekdays[0], start_time: start, end_time: end, valid_from: validFrom || null, valid_until: validUntil || null });
      } else {
        await client.batchCommitment({ student: sid, kind, title: title.trim(), weekdays, start_time: start, end_time: end, valid_from: validFrom || null, valid_until: validUntil || null });
      }
      setTitle(""); setWeekdays([]); notify("فعالیت ثابت ثبت شد."); onRefresh();
    } catch (e) { setError(apiErrorMessage(e)); } finally { setBusy(false); }
  }

  async function saveEdit() {
    if (!editing) return;
    setError("");
    try {
      if (editing.group_id) {
        await client.groupUpdate({ group_id: editing.group_id, title: editTitle.trim(), kind: editKind, start_time: editStart, end_time: editEnd });
      } else {
        await client.updateCommitment(editing.id, { title: editTitle.trim(), kind: editKind, start_time: editStart, end_time: editEnd });
      }
      setEditing(null); notify("ویرایش ذخیره شد."); onRefresh();
    } catch (e) { setError(apiErrorMessage(e)); }
  }

  async function removeCommitment(c: Commitment) {
    if (!confirm(`«${c.title}» حذف شود؟`)) return;
    setError("");
    try {
      if (c.group_id) await client.groupDelete(c.group_id);
      else await client.deleteCommitment(c.id);
      notify("حذف شد."); onRefresh();
    } catch (e) { setError(apiErrorMessage(e)); }
  }

  async function toggleActive(c: Commitment) {
    setError("");
    try {
      if (c.group_id) await client.groupUpdate({ group_id: c.group_id, active: !c.active });
      else await client.toggleCommitment(c.id);
      onRefresh();
    } catch (e) { setError(apiErrorMessage(e)); }
  }

  async function saveSlots() {
    const filled = slotPeriods.filter((s) => s.subject_name.trim()).map((s) => ({ weekday: slotWeekday, period: s.period, subject_name: s.subject_name.trim() }));
    // We upsert only filled; but to allow clearing, we delete existing for that weekday then bulk
    setSlotsBusy(true); setError("");
    try {
      // Clear existing for this weekday then re-create
      const toDelete = schoolSlots.filter((s) => s.weekday === slotWeekday);
      // Instead of clear+bulk, we use bulk which upserts; we need to delete removed ones
      const keepPeriods = new Set(filled.map((f) => f.period));
      for (const s of toDelete) if (!keepPeriods.has(s.period)) await api<void>(`/planning/school-slots/${s.id}/`, token, "DELETE");
      if (filled.length) await client.bulkSchoolSlots({ student: sid, slots: filled });
      notify("جدول درس‌ها ذخیره شد."); onRefresh();
    } catch (e) { setError(apiErrorMessage(e)); } finally { setSlotsBusy(false); }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Commitment[]>();
    for (const c of otherCommitments) {
      const key = c.group_id || `single:${c.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return [...map.values()].sort((a, b) => WEEKDAY_ORDER.indexOf(a[0].weekday as never) - WEEKDAY_ORDER.indexOf(b[0].weekday as never));
  }, [otherCommitments]);

  return (
    <section style={{ background: "white", border: "1px solid #e7e1ec", borderRadius: 12, padding: 16, display: "grid", gap: 16 }} dir="rtl">
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>برنامه‌های ثابت</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setTab("school")} style={{ padding: "6px 14px", borderRadius: 8, border: tab === "school" ? "1px solid #5B0FAD" : "1px solid #e7e1ec", background: tab === "school" ? "#f6f1fb" : "white", color: tab === "school" ? "#5B0FAD" : "#16041E", fontWeight: tab === "school" ? 700 : 400 }}>برنامه مدرسه</button>
          <button onClick={() => setTab("other")} style={{ padding: "6px 14px", borderRadius: 8, border: tab === "other" ? "1px solid #5B0FAD" : "1px solid #e7e1ec", background: tab === "other" ? "#f6f1fb" : "white", color: tab === "other" ? "#5B0FAD" : "#16041E", fontWeight: tab === "other" ? 700 : 400 }}>کلاس‌ها و فعالیت‌ها</button>
        </div>
      </div>
      {error && <p style={{ color: "#a12626", background: "#fef2f2", border: "1px solid #fecaca", padding: "8px 12px", borderRadius: 8 }} role="alert">{error}</p>}
      {notice && <p style={{ color: "#065f46", background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "8px 12px", borderRadius: 8 }}>{notice}</p>}

      {tab === "school" ? (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 8, background: "#faf9fc", border: "1px solid #e7e1ec", borderRadius: 10, padding: 12 }}>
            <strong style={{ fontSize: 13 }}>ساعات مدرسه</strong>
            <p style={{ fontSize: 12, color: "#706578" }}>روزهای حضور و ساعت مدرسه را انتخاب کنید. با یک عملیات برای چند روز ذخیره می‌شود. در صورت نیاز ساعت هر روز را جداگانه ویرایش کنید.</p>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>روزهای مدرسه
              <WeekdayPicker value={schoolWeekdays} onChange={setSchoolWeekdays} />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>شروع<input type="time" value={schoolStart} onChange={(e) => setSchoolStart(e.target.value)} /></label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>پایان<input type="time" value={schoolEnd} onChange={(e) => setSchoolEnd(e.target.value)} /></label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>از تاریخ<input type="date" value={schoolValidFrom} onChange={(e) => setSchoolValidFrom(e.target.value)} /></label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>تا تاریخ<input type="date" value={schoolValidUntil} onChange={(e) => setSchoolValidUntil(e.target.value)} /></label>
            </div>
            <button onClick={submitSchool} disabled={schoolBusy} style={{ justifySelf: "start", background: "#5B0FAD", color: "white", border: "1px solid #5B0FAD", borderRadius: 8, padding: "8px 16px" }}>{schoolBusy ? "در حال ذخیره…" : "ذخیره ساعات مدرسه"}</button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <strong style={{ fontSize: 13 }}>ساعات ثبت‌شده ({schoolCommitments.length})</strong>
            {schoolCommitments.length === 0 ? <p style={{ fontSize: 12, color: "#706578" }}>هنوز ساعتی ثبت نشده.</p> : (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 }}>
                  {WEEKDAY_ORDER.map((wd) => {
                    const c = schoolCommitments.find((x) => x.weekday === wd);
                    if (!c) return <div key={wd} style={{ border: "1px dashed #e7e1ec", borderRadius: 8, padding: 10, color: "#706578", fontSize: 12 }}>{WEEKDAY_LABEL[wd]} — بدون مدرسه</div>;
                    const isEditing = editSchoolId === c.id;
                    return (
                      <div key={wd} style={{ border: "1px solid #e7e1ec", borderRadius: 8, padding: 10, display: "grid", gap: 6, opacity: c.active ? 1 : 0.6 }}>
                        <strong style={{ fontSize: 12 }}>{WEEKDAY_LABEL[wd]} {c.active ? "" : "· غیرفعال"}</strong>
                        {isEditing ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <input type="time" value={editSchoolStart} onChange={(e) => setEditSchoolStart(e.target.value)} />
                            <input type="time" value={editSchoolEnd} onChange={(e) => setEditSchoolEnd(e.target.value)} />
                            <button onClick={() => saveSchoolEdit(c)} style={{ background: "#5B0FAD", color: "white", borderRadius: 6, padding: "4px 8px" }}>ذخیره</button>
                            <button onClick={() => setEditSchoolId(null)} style={{ border: "1px solid #e7e1ec", borderRadius: 6, padding: "4px 8px" }}>لغو</button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12 }}>{c.start_time.slice(0, 5)} تا {c.end_time.slice(0, 5)}</span>
                        )}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {!isEditing && <button onClick={() => { setEditSchoolId(c.id); setEditSchoolStart(c.start_time.slice(0, 5)); setEditSchoolEnd(c.end_time.slice(0, 5)); }} style={{ fontSize: 12, border: "1px solid #e7e1ec", borderRadius: 6, padding: "4px 8px" }}>ویرایش ساعت</button>}
                          <button onClick={() => toggleActive(c)} style={{ fontSize: 12, border: "1px solid #e7e1ec", borderRadius: 6, padding: "4px 8px" }}>{c.active ? "غیرفعال" : "فعال‌سازی"}</button>
                          <button onClick={() => removeCommitment(c)} style={{ fontSize: 12, color: "#a12626", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 8px" }}>حذف</button>
                        </div>
                        {(c.valid_from || c.valid_until) && <small style={{ fontSize: 11, color: "#706578" }}>{c.valid_from || "…"} تا {c.valid_until || "…"} </small>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 8, borderTop: "1px solid #e7e1ec", paddingTop: 12 }}>
            <strong style={{ fontSize: 13 }}>جدول درس‌های مدرسه (اختیاری)</strong>
            <p style={{ fontSize: 12, color: "#706578" }}>برای هر روز، نام درس هر زنگ را وارد کنید. خالی بگذارید اگر فقط ساعات کافی است.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ fontSize: 12 }}>روز
                <select value={slotWeekday} onChange={(e) => setSlotWeekday(Number(e.target.value))} style={{ marginInlineStart: 6 }}>
                  {WEEKDAY_ORDER.map((wd) => <option key={wd} value={wd}>{WEEKDAY_LABEL[wd]}</option>)}
                </select>
              </label>
              <span style={{ fontSize: 11, color: "#706578" }}>{schoolSlots.filter((s) => s.weekday === slotWeekday).length} زنگ ثبت‌شده</span>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {slotPeriods.map((row) => (
                <label key={row.period} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>زنگ {row.period}
                  <input value={row.subject_name} onChange={(e) => setSlotPeriods((cur) => cur.map((r) => r.period === row.period ? { ...r, subject_name: e.target.value } : r))} placeholder="نام درس" style={{ flex: 1 }} />
                </label>
              ))}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setSlotPeriods((cur) => [...cur, { period: cur.length + 1, subject_name: "" }].slice(0, 12))} style={{ fontSize: 12, border: "1px solid #e7e1ec", borderRadius: 6, padding: "6px 10px" }}>＋ افزودن زنگ</button>
                {slotPeriods.length > 1 && <button onClick={() => setSlotPeriods((cur) => cur.slice(0, -1))} style={{ fontSize: 12, border: "1px solid #e7e1ec", borderRadius: 6, padding: "6px 10px" }}>حذف آخرین زنگ</button>}
              </div>
              <button onClick={saveSlots} disabled={slotsBusy} style={{ justifySelf: "start", background: "#5B0FAD", color: "white", borderRadius: 8, padding: "8px 16px" }}>{slotsBusy ? "در حال ذخیره…" : "ذخیره جدول درس‌ها"}</button>
              {schoolSlots.filter((s) => s.weekday === slotWeekday).length > 0 && (
                <div style={{ fontSize: 12, background: "#f6f1fb", border: "1px solid #e7e1ec", borderRadius: 8, padding: 8 }}>
                  {schoolSlots.filter((s) => s.weekday === slotWeekday).sort((a, b) => a.period - b.period).map((s) => <div key={s.id}>زنگ {s.period}: {s.subject_name}</div>)}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 8, background: "#faf9fc", border: "1px solid #e7e1ec", borderRadius: 10, padding: 12 }}>
            <strong style={{ fontSize: 13 }}>افزودن فعالیت ثابت</strong>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>عنوان<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: کلاس زبان" /></label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>نوع
              <select value={kind} onChange={(e) => setKind(e.target.value as Commitment["kind"])}>
                {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12 }}>روزها
              <WeekdayPicker value={weekdays} onChange={setWeekdays} />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>شروع<input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>پایان<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>از تاریخ<input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>تا تاریخ<input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></label>
            </div>
            <button onClick={submitOther} disabled={busy} style={{ justifySelf: "start", background: "#5B0FAD", color: "white", borderRadius: 8, padding: "8px 16px" }}>{busy ? "در حال ذخیره…" : "ثبت فعالیت"}</button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <strong style={{ fontSize: 13 }}>فهرست فعالیت‌ها ({otherCommitments.length})</strong>
            {grouped.length === 0 ? <p style={{ fontSize: 12, color: "#706578" }}>هنوز فعالیتی ثبت نشده.</p> : (
              <div style={{ display: "grid", gap: 8 }}>
                {grouped.map((group) => {
                  const rep = group[0];
                  const isEditing = editing?.group_id ? editing.group_id === rep.group_id : editing?.id === rep.id;
                  return (
                    <div key={rep.group_id || rep.id} style={{ border: "1px solid #e7e1ec", borderRadius: 10, padding: 12, display: "grid", gap: 8, opacity: rep.active ? 1 : 0.6 }}>
                      {isEditing ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                          <select value={editKind} onChange={(e) => setEditKind(e.target.value as Commitment["kind"])}>
                            {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <div style={{ display: "flex", gap: 8 }}><input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} /><input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} /></div>
                          <div style={{ display: "flex", gap: 8 }}><button onClick={saveEdit} style={{ background: "#5B0FAD", color: "white", borderRadius: 6, padding: "6px 10px" }}>ذخیره</button><button onClick={() => setEditing(null)} style={{ border: "1px solid #e7e1ec", borderRadius: 6, padding: "6px 10px" }}>انصراف</button></div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 13 }}>{rep.title} <small style={{ fontWeight: 400, color: "#706578" }}>· {commitmentLabel[rep.kind]}</small></strong>
                            <span style={{ fontSize: 12, background: rep.active ? "#ecfdf5" : "#f3f4f6", border: "1px solid #e7e1ec", borderRadius: 20, padding: "2px 8px" }}>{rep.active ? "فعال" : "غیرفعال"}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "#16041E" }}>{group.map((c) => WEEKDAY_LABEL[c.weekday]).join("، ")} · {rep.start_time.slice(0, 5)} تا {rep.end_time.slice(0, 5)}</div>
                          {(rep.valid_from || rep.valid_until) && <small style={{ fontSize: 11, color: "#706578" }}>{rep.valid_from || "…"} تا {rep.valid_until || "…"}</small>}
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button onClick={() => { setEditing(rep); setEditTitle(rep.title); setEditKind(rep.kind); setEditStart(rep.start_time.slice(0, 5)); setEditEnd(rep.end_time.slice(0, 5)); }} style={{ fontSize: 12, border: "1px solid #e7e1ec", borderRadius: 6, padding: "6px 10px" }}>ویرایش</button>
                            <button onClick={() => toggleActive(rep)} style={{ fontSize: 12, border: "1px solid #e7e1ec", borderRadius: 6, padding: "6px 10px" }}>{rep.active ? "غیرفعال‌سازی" : "فعال‌سازی"}</button>
                            <button onClick={() => removeCommitment(rep)} style={{ fontSize: 12, color: "#a12626", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 10px" }}>حذف</button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
