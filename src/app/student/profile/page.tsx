"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accessToken, api, clearSession, errorMessage, obtainTokenPair, onSessionExpired, Page, publicApi, saveSession, SESSION_EXPIRED, User } from "@/lib/api";

type Option = { id: number; name: string };
type Profile = { id: number; user: User; grade: number; field: number; school_name: string; counselor_user: User | null };

export default function StudentProfilePage() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", grade: "", field: "", school_name: "" });
  const [grades, setGrades] = useState<Option[]>([]);
  const [fields, setFields] = useState<Option[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => onSessionExpired("STUDENT", () => { setToken(""); setProfile(null); setError(SESSION_EXPIRED); }), []);
  useEffect(() => { const stored = accessToken("STUDENT"); if (stored) Promise.resolve().then(() => setToken(stored)); }, []);
  useEffect(() => {
    if (!token) return;
    api<Profile>("/auth/profile/student/", token).then((data) => { setProfile(data); setForm({ first_name: data.user.first_name, last_name: data.user.last_name, email: data.user.email, grade: String(data.grade || ""), field: String(data.field || ""), school_name: data.school_name }); }).catch((e) => { setError(errorMessage(e)); });
    publicApi<Page<Option>>("/academics/grades/").then((page) => setGrades(page.results)).catch((e) => setError(String(e)));
  }, [token]);
  useEffect(() => { if (form.grade) publicApi<Page<Option>>(`/academics/fields/?grade=${form.grade}`).then((page) => setFields(page.results)).catch((e) => setError(String(e))); }, [form.grade]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setError("");
    try {
      clearSession("STUDENT");
      const tokens = await obtainTokenPair(username, password);
      const me = await api<User>("/auth/me/", tokens.access);
      if (me.role !== "STUDENT") throw new Error("A student account is required");
      saveSession("STUDENT", tokens); setToken(tokens.access);
    } catch (reason) { setError(errorMessage(reason)); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    try {
      const data = await api<Profile>("/auth/profile/student/", token, "PATCH", { ...form, grade: Number(form.grade), field: Number(form.field) });
      setProfile(data); setMessage("Profile saved.");
    } catch (reason) { setError(errorMessage(reason)); }
  }

  if (!token || !profile) return <main className="student-page"><h1>Student sign in</h1><form onSubmit={signIn}><label>Username<input required value={username} onChange={(e) => setUsername(e.target.value)}/></label><label>Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)}/></label><button>Sign in</button></form><p role="alert">{error}</p><Link href="/register/student">Create an account</Link></main>;
  return <main className="student-page"><h1>My profile</h1><p>Username: {profile.user.username}</p><p>Counselor: {profile.counselor_user ? `${profile.counselor_user.first_name} ${profile.counselor_user.last_name}`.trim() || profile.counselor_user.username : "Not assigned"}</p><form onSubmit={save}>
    <label>First name<input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}/></label>
    <label>Last name<input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}/></label>
    <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/></label>
    <label>Grade<select required value={form.grade} onChange={(e) => { setFields([]); setForm({ ...form, grade: e.target.value, field: "" }); }}><option value="">Select grade</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label>
    <label>Field<select required value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}><option value="">Select field</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
    <label>School (optional)<input value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })}/></label><button>Save profile</button>
  </form><p role="status">{message}</p><p role="alert">{error}</p><Link href="/student/plans">برنامه‌های من</Link><button onClick={() => { clearSession("STUDENT"); setToken(""); setProfile(null); }}>Sign out</button></main>;
}
