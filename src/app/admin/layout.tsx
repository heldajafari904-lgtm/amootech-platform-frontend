"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, baseUrl, User } from "@/lib/api";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("amootech_access");
    if (stored) {
      api<User>("/auth/me/", stored).then((me) => { setUser(me); setToken(stored); }).catch(() => sessionStorage.removeItem("amootech_access"));
    }
  }, []);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch(`${baseUrl}/auth/token/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      if (!response.ok) throw new Error("Invalid credentials");
      const tokens: { access: string } = await response.json();
      const me = await api<User>("/auth/me/", tokens.access);
      if (me.role !== "ADMIN") throw new Error("An admin account is required");
      sessionStorage.setItem("amootech_access", tokens.access);
      setUser(me);
      setToken(tokens.access);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Sign in failed"); }
  }

  if (!token || !user) return <main className="admin"><h1>Admin sign in</h1><form onSubmit={signIn}><input aria-label="Username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required/><input aria-label="Password" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required/><button>Sign in</button></form><p role="alert">{error}</p></main>;
  if (user.role !== "ADMIN") return <main className="admin">Admin access required.</main>;
  return <div className="admin"><header><strong>Amootech Admin</strong><nav><Link href="/admin">Home</Link><Link href="/admin/students">Students</Link><Link href="/admin/counselors">Counselors</Link><Link href="/admin/academics">Academics</Link></nav><button onClick={() => { sessionStorage.removeItem("amootech_access"); setToken(null); setUser(null); }}>Sign out</button></header>{children}</div>;
}
