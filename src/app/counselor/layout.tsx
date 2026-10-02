"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelSkeleton } from "@/components/counselor/PanelUI";
import "./counselor.css";
import { useEffect, useState } from "react";
import { accessToken, api, clearSession, errorMessage, obtainTokenPair, onSessionExpired, saveSession, SESSION_EXPIRED, User } from "@/lib/api";
import { CounselorContext } from "@/lib/counselorContext";

export default function CounselorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const section = pathname.endsWith("/planning") ? "برنامه‌ریزی هفتگی" : pathname === "/counselor" ? "داشبورد" : pathname === "/counselor/students" ? "دانش‌آموزان" : "فضای دانش‌آموز";
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = accessToken("COUNSELOR");
    if (!stored) { Promise.resolve().then(() => setLoading(false)); return; }
    api<User>("/auth/me/", stored).then((me) => {
      if (me.role !== "COUNSELOR") throw new Error("این حساب مشاور نیست.");
      setUser(me); setToken(accessToken("COUNSELOR") || stored);
    }).catch((reason) => { clearSession("COUNSELOR"); setError(errorMessage(reason)); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => onSessionExpired("COUNSELOR", () => { setUser(null); setToken(""); setError(SESSION_EXPIRED); }), []);

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setError("");
    try {
      clearSession("COUNSELOR");
      const pair = await obtainTokenPair(username, password);
      const me = await api<User>("/auth/me/", pair.access);
      if (me.role !== "COUNSELOR") throw new Error("این حساب مشاور نیست.");
      saveSession("COUNSELOR", pair);
      setToken(pair.access); setUser(me); setPassword("");
    } catch (reason) { setError(errorMessage(reason)); }
  }

  if (loading) return <main className="planning-shell counselor-panel" dir="rtl" lang="fa"><PanelSkeleton/></main>;
  if (!token || !user) return <main className="planning-shell counselor-panel planning-login" dir="rtl" lang="fa"><h1>ورود مشاور</h1><form onSubmit={signIn}><label>نام کاربری<input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)}/></label><label>رمز عبور<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}/></label><button>ورود</button></form><p className="planning-error" role="alert">{error}</p></main>;
  return <CounselorContext.Provider value={{ token, user }}><div className="planning-shell counselor-panel" dir="rtl" lang="fa"><a className="panel-skip" href="#counselor-content">رفتن به محتوای اصلی</a><header className="planning-header"><Link href="/counselor" className="planning-brand"><span className="panel-brand-mark">آ</span> آمو‌تک <small>پنل مشاور</small></Link><nav aria-label="منوی اصلی"><Link href="/counselor" aria-current={pathname === "/counselor" ? "page" : undefined}>داشبورد</Link><Link href="/counselor/students" aria-current={pathname.startsWith("/counselor/students") ? "page" : undefined}>دانش‌آموزان</Link></nav><span className="panel-identity">{user.first_name || user.username}</span><button type="button" className="planning-subtle" onClick={() => { clearSession("COUNSELOR"); setUser(null); setToken(""); }}>خروج</button></header><div className="panel-breadcrumb" aria-label="بخش فعلی">پنل مشاور <span aria-hidden="true">/</span> <strong>{section}</strong></div><div id="counselor-content">{children}</div></div></CounselorContext.Provider>;
}
