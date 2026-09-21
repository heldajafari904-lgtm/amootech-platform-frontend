"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { api, baseUrl, User } from "@/lib/api";
import { planningError } from "@/lib/planning";

const StudentPlanContext = createContext<{ token: string; user: User } | null>(null);
export function useStudentPlanAuth() {
  const value = useContext(StudentPlanContext);
  if (!value) throw new Error("Student plan context is unavailable");
  return value;
}

export default function StudentPlansLayout({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("amootech_student_access");
    if (!stored) { Promise.resolve().then(() => setLoading(false)); return; }
    api<User>("/auth/me/", stored).then((me) => {
      if (me.role !== "STUDENT") throw new Error("این حساب دانش‌آموز نیست.");
      setUser(me); setToken(stored);
    }).catch((reason) => { sessionStorage.removeItem("amootech_student_access"); setError(planningError(reason)); }).finally(() => setLoading(false));
  }, []);

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setError("");
    try {
      const response = await fetch(`${baseUrl}/auth/token/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      if (!response.ok) throw new Error("نام کاربری یا رمز عبور درست نیست.");
      const pair: { access: string } = await response.json();
      const me = await api<User>("/auth/me/", pair.access);
      if (me.role !== "STUDENT") throw new Error("این حساب دانش‌آموز نیست.");
      sessionStorage.setItem("amootech_student_access", pair.access); setToken(pair.access); setUser(me); setPassword("");
    } catch (reason) { setError(planningError(reason)); }
  }

  if (loading) return <main className="planning-shell" dir="rtl" lang="fa"><p>در حال بررسی ورود…</p></main>;
  if (!token || !user) return <main className="planning-shell planning-login" dir="rtl" lang="fa"><h1>ورود دانش‌آموز</h1><form onSubmit={signIn}><label>نام کاربری<input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)}/></label><label>رمز عبور<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}/></label><button>ورود</button></form><p className="planning-error" role="alert">{error}</p><Link href="/register/student">ساخت حساب دانش‌آموز</Link></main>;
  return <StudentPlanContext.Provider value={{ token, user }}><div className="planning-shell" dir="rtl" lang="fa"><header className="planning-header"><Link href="/student/plans" className="planning-brand">آمو‌تک | برنامه من</Link><nav><Link href="/student/plans">برنامه‌ها</Link><Link href="/student/profile">پروفایل</Link></nav><span>{user.first_name || user.username}</span><button type="button" className="planning-subtle" onClick={() => { sessionStorage.removeItem("amootech_student_access"); setToken(""); setUser(null); }}>خروج</button></header>{children}</div></StudentPlanContext.Provider>;
}
