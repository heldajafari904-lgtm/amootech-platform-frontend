"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accessToken, api, clearSession, errorMessage, obtainTokenPair, onSessionExpired, saveSession, SESSION_EXPIRED, User } from "@/lib/api";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const stored = accessToken("ADMIN");
    if (stored) {
      api<User>("/auth/me/", stored).then((me) => { setUser(me); setToken(accessToken("ADMIN") || stored); }).catch(() => clearSession("ADMIN"));
    }
  }, []);

  useEffect(() => onSessionExpired("ADMIN", () => { setUser(null); setToken(null); setError(SESSION_EXPIRED); }), []);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      clearSession("ADMIN");
      const tokens = await obtainTokenPair(username, password);
      const me = await api<User>("/auth/me/", tokens.access);
      if (me.role !== "ADMIN") throw new Error("An admin account is required");
      saveSession("ADMIN", tokens);
      setUser(me);
      setToken(tokens.access);
    } catch (reason) { setError(errorMessage(reason)); }
  }

  if (!token || !user) return <main className="admin"><h1>Admin sign in</h1><form onSubmit={signIn}><input aria-label="Username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required/><input aria-label="Password" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required/><button>Sign in</button></form><p role="alert">{error}</p></main>;
  if (user.role !== "ADMIN") return <main className="admin">Admin access required.</main>;
  return <div className="admin"><header><strong>Amootech Admin</strong><nav><Link href="/admin">Home</Link><Link href="/admin/students">Students</Link><Link href="/admin/counselors">Counselors</Link><Link href="/admin/academics">Academics</Link></nav><button onClick={() => { clearSession("ADMIN"); setToken(null); setUser(null); }}>Sign out</button></header>{children}</div>;
}
