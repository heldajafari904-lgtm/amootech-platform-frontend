"use client";

import { useCallback, useEffect, useState } from "react";
import { api, allPages, Page, User } from "@/lib/api";

type Profile = { id: number; user: User; counselor: number | null; grade: number | null; field: number | null };
type Option = { id: number; name?: string; user?: User; grade?: number };
const blank = { username: "", password: "", email: "", first_name: "", last_name: "", is_active: true, counselor: "", grade: "", field: "" };

export default function ProfileManager({ kind }: { kind: "students" | "counselors" }) {
  const token = typeof window === "undefined" ? "" : sessionStorage.getItem("amootech_access") || "";
  const [rows, setRows] = useState<Profile[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [selected, setSelected] = useState<number | null>(null);
  const [grades, setGrades] = useState<Option[]>([]);
  const [fields, setFields] = useState<Option[]>([]);
  const [counselors, setCounselors] = useState<Option[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async (url = `/` + kind + `/`) => {
    try { const page = await api<Page<Profile>>(url, token); setRows(page.results); setNext(page.next); setPrevious(page.previous); } catch (e) { setError(String(e)); }
  }, [kind, token]);
  useEffect(() => { if (token) { Promise.resolve().then(() => load()); if (kind === "students") { allPages<Option>("/academics/grades/", token).then(setGrades).catch((e) => setError(String(e))); allPages<Option>("/counselors/", token).then(setCounselors).catch((e) => setError(String(e))); } } }, [kind, token, load]);
  useEffect(() => { if (kind === "students" && form.grade && token) allPages<Option>(`/academics/fields/?grade=${form.grade}`, token).then(setFields).catch((e) => setError(String(e))); }, [kind, form.grade, token]);
  function edit(row: Profile) { setSelected(row.id); setForm({ username: row.user.username, password: "", email: row.user.email, first_name: row.user.first_name, last_name: row.user.last_name, is_active: row.user.is_active ?? true, counselor: row.counselor?.toString() || "", grade: row.grade?.toString() || "", field: row.field?.toString() || "" }); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError("");
    const payload: Record<string, string | number | boolean | null> = { username: form.username, email: form.email, first_name: form.first_name, last_name: form.last_name, is_active: form.is_active };
    if (form.password) payload.password = form.password;
    if (kind === "students") { payload.counselor = form.counselor ? Number(form.counselor) : null; payload.grade = form.grade ? Number(form.grade) : null; payload.field = form.field ? Number(form.field) : null; }
    try { await api(`/${kind}/${selected ? `${selected}/` : ""}`, token, selected ? "PATCH" : "POST", payload); setForm(blank); setSelected(null); load(); } catch (e) { setError(String(e)); }
  }
  const title = kind === "students" ? "Students" : "Counselors";
  return <main><h1>{title}</h1><form onSubmit={save}><h2>{selected ? "Edit" : "Create"} {kind === "students" ? "student" : "counselor"}</h2><input placeholder="Username" aria-label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required/><input placeholder={selected ? "New password (optional)" : "Password"} aria-label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!selected}/><input placeholder="Email" aria-label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/><input placeholder="First name" aria-label="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}/><input placeholder="Last name" aria-label="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}/><label><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}/> Active</label>{kind === "students" && <><select aria-label="Grade" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value, field: "" })}><option value="">No grade</option>{grades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><select aria-label="Field" value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}><option value="">No field</option>{fields.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><select aria-label="Counselor" value={form.counselor} onChange={(e) => setForm({ ...form, counselor: e.target.value })}><option value="">Unassigned</option>{counselors.map((x) => <option key={x.id} value={x.id}>{x.user?.username}</option>)}</select></>}<button>{selected ? "Save changes" : "Create"}</button>{selected && <button type="button" onClick={() => { setSelected(null); setForm(blank); }}>Cancel</button>}</form><p role="alert">{error}</p><h2>Accounts</h2><ul>{rows.map((row) => <li key={row.id}><button onClick={() => edit(row)}>{row.user.username} — {row.user.first_name} {row.user.last_name}</button></li>)}</ul><div><button disabled={!previous} onClick={() => previous && load(previous)}>Previous</button><button disabled={!next} onClick={() => next && load(next)}>Next</button></div></main>;
}
