"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, errorMessage, obtainTokenPair, Page, publicApi, saveSession } from "@/lib/api";

type Option = { id: number; name: string; grade?: number };
const empty = { username: "", password: "", email: "", first_name: "", last_name: "", grade: "", field: "", school_name: "" };

export default function StudentRegistration() {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [grades, setGrades] = useState<Option[]>([]);
  const [fields, setFields] = useState<Option[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { publicApi<Page<Option>>("/academics/grades/").then((page) => setGrades(page.results)).catch((e) => setError(String(e))); }, []);
  useEffect(() => {
    if (!form.grade) return;
    publicApi<Page<Option>>(`/academics/fields/?grade=${form.grade}`).then((page) => setFields(page.results)).catch((e) => setError(String(e)));
  }, [form.grade]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      await publicApi("/auth/register/student/", "POST", { ...form, grade: Number(form.grade), field: Number(form.field) });
      clearSession("STUDENT");
      const tokens = await obtainTokenPair(form.username, form.password);
      saveSession("STUDENT", tokens);
      router.push("/student/profile");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  return <main className="student-page"><h1>Create student account</h1><form onSubmit={submit}>
    <label>Username<input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}/></label>
    <label>Password<input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}/></label>
    <label>First name<input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}/></label>
    <label>Last name<input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}/></label>
    <label>Email (optional)<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/></label>
    <label>Grade<select required value={form.grade} onChange={(e) => { setFields([]); setForm({ ...form, grade: e.target.value, field: "" }); }}><option value="">Select grade</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label>
    <label>Field<select required value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}><option value="">Select field</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
    <label>School (optional)<input value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })}/></label>
    <button disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
  </form><p role="alert">{error}</p><Link href="/student/profile">Already registered? Sign in</Link></main>;
}
