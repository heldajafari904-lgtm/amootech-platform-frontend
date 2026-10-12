"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { accessToken, api, clearSession, errorMessage, obtainTokenPair, onSessionExpired, saveSession, SESSION_EXPIRED, User } from "@/lib/api";

const navItems = [
  { href: "/admin", label: "داشبورد", exact: true, icon: "▦" },
  { href: "/admin/students", label: "دانش‌آموزان", icon: "◉" },
  { href: "/admin/counselors", label: "مشاوران", icon: "◎" },
  { href: "/admin/telegram", label: "تلگرام و بات", icon: "✈" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  if (!token || !user) return <main className="admin-login"><h1>ورود مدیر</h1><form onSubmit={signIn}><label>نام کاربری<input aria-label="Username" placeholder="نام کاربری" value={username} onChange={(e) => setUsername(e.target.value)} required/></label><label>رمز عبور<input aria-label="Password" type="password" placeholder="رمز عبور" value={password} onChange={(e) => setPassword(e.target.value)} required/></label><button>ورود</button></form><p role="alert">{error}</p></main>;
  if (user.role !== "ADMIN") return <main className="admin-login">دسترسی مدیر لازم است.</main>;
  const isActive = (href: string, exact?: boolean) => exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  const sidebar = (
    <nav className="admin-nav" aria-label="منوی اصلی">
      {navItems.map((item) => (
        <Link key={item.href} href={item.href} className={isActive(item.href, item.exact) ? "active" : ""} onClick={() => setDrawerOpen(false)}>
          <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
  return (
    <div className={`admin-shell ${collapsed ? "admin-collapsed" : ""}`} dir="rtl">
      <aside className="admin-sidebar" aria-label="نوار کناری">
        <div className="admin-sidebar-head">
          <Link href="/admin" className="admin-brand"><span className="admin-brand-mark">آ</span> آموتک <small>پنل مدیریت</small></Link>
          <button className="admin-collapse-btn" aria-label={collapsed ? "باز کردن منو" : "جمع کردن منو"} onClick={() => setCollapsed((v) => !v)}>{collapsed ? "»" : "«"}</button>
        </div>
        {sidebar}
        <div className="admin-sidebar-foot">
          <div className="admin-userbox"><strong>{user.first_name || user.username}</strong><small>مدیر</small></div>
          <button className="admin-signout" onClick={() => { clearSession("ADMIN"); setToken(null); setUser(null); }}>خروج</button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-drawer-toggle" aria-label="منو" onClick={() => setDrawerOpen((v) => !v)}>☰</button>
          <div className="admin-breadcrumb" aria-label="مسیر صفحه">
            <Link href="/admin">مدیریت</Link> <span>/</span> <span>{navItems.find((n) => isActive(n.href, n.exact))?.label || ""}</span>
          </div>
          <span className="admin-topbar-user">{user.first_name || user.username}</span>
        </header>
        {drawerOpen && <div className="admin-drawer"><div className="admin-drawer-backdrop" onClick={() => setDrawerOpen(false)} /><div className="admin-drawer-panel">{sidebar}</div></div>}
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
