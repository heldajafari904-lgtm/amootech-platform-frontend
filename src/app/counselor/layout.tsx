"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { api, baseUrl, User } from "@/lib/api";
import { planningError } from "@/lib/planning";

const CounselorContext = createContext<{ token: string; user: User } | null>(null);

export function useCounselor() {
  const value = useContext(CounselorContext);
  if (!value) throw new Error("Counselor context is unavailable");
  return value;
}

export default function CounselorLayout({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("amootech_counselor_access");
    if (!stored) { Promise.resolve().then(() => setLoading(false)); return; }
    api<User>("/auth/me/", stored).then((me) => {
      if (me.role !== "COUNSELOR") throw new Error("این حساب مشاور نیست.");
      setUser(me); setToken(stored);
    }).catch((reason) => { sessionStorage.removeItem("amootech_counselor_access"); setError(planningError(reason)); }).finally(() => setLoading(false));
  }, []);

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setError("");
    try {
      const response = await fetch(`${baseUrl}/auth/token/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      if (!response.ok) throw new Error("نام کاربری یا رمز عبور درست نیست.");
      const pair: { access: string } = await response.json();
      const me = await api<User>("/auth/me/", pair.access);
      if (me.role !== "COUNSELOR") throw new Error("این حساب مشاور نیست.");
      sessionStorage.setItem("amootech_counselor_access", pair.access);
      setToken(pair.access); setUser(me); setPassword("");
    } catch (reason) { setError(planningError(reason)); }
  }

  if (loading) return <main className="planning-shell" dir="rtl" lang="fa"><p>در حال بررسی ورود…</p></main>;
  if (!token || !user) return <main className="planning-shell planning-login" dir="rtl" lang="fa"><h1>ورود مشاور</h1><form onSubmit={signIn}><label>نام کاربری<input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)}/></label><label>رمز عبور<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}/></label><button>ورود</button></form><p className="planning-error" role="alert">{error}</p></main>;
  return <CounselorContext.Provider value={{ token, user }}><div className="planning-shell" dir="rtl" lang="fa"><header className="planning-header"><Link href="/counselor" className="planning-brand">آمو‌تک | مشاور</Link><nav><Link href="/counselor/students">دانش‌آموزان</Link></nav><span>{user.first_name || user.username}</span><button type="button" className="planning-subtle" onClick={() => { sessionStorage.removeItem("amootech_counselor_access"); setUser(null); setToken(""); }}>خروج</button></header>{children}</div></CounselorContext.Provider>;
}
