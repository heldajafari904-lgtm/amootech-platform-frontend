"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";

type DeliveryResult = { sent: number; failed: number; total: number };

export default function TelegramBroadcast({ token, audience }: { token: string; audience: "admin" | "counselor" }) {
  const [message, setMessage] = useState("");
  const [total, setTotal] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const scope = audience === "admin" ? "همهٔ دانش‌آموزان" : "دانش‌آموزان خودتان";

  useEffect(() => {
    let active = true;
    api<{ total: number }>("/counselor/telegram/broadcast/", token).then(data => { if (active) setTotal(data.total); }).catch(reason => { if (active) setError(errorMessage(reason)); });
    return () => { active = false; };
  }, [token]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || !message.trim()) return;
    submitting.current = true; setSending(true); setError(""); setResult(null);
    try {
      const delivered = await api<DeliveryResult>("/counselor/telegram/broadcast/", token, "POST", { message: message.trim() });
      setResult(delivered);
      if (!delivered.failed) setMessage("");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { submitting.current = false; setSending(false); }
  }

  return <section className={audience === "admin" ? "admin-card" : "workspace-panel"} style={{ marginTop: "1rem" }} aria-label="پیام دسته‌جمعی تلگرام">
    <h2>پیام دسته‌جمعی تلگرام</h2>
    <p>ارسال به گروه‌های متصل {scope}{total !== null ? ` · ${total.toLocaleString("fa-IR")} گروه` : ""}</p>
    <form onSubmit={send}>
      <label style={{ display: "grid", gap: ".5rem" }}>متن پیام
        <textarea value={message} onChange={event => setMessage(event.target.value)} rows={4} maxLength={4000} required disabled={sending} placeholder="پیام خود را بنویسید…" style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: ".5rem", padding: ".75rem" }}/>
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginTop: ".75rem" }}>
        <button type="submit" disabled={sending || !message.trim() || total === 0} style={{ background: "#5B0FAD", color: "white", borderRadius: ".5rem", padding: ".6rem 1rem", opacity: sending || !message.trim() || total === 0 ? .5 : 1 }}>{sending ? "در حال ارسال…" : "ارسال پیام دسته‌جمعی"}</button>
        <small>{message.length.toLocaleString("fa-IR")} / ۴۰۰۰ نویسه</small>
      </div>
      {total === 0 && <p role="status">هنوز گروه تلگرام متصلی برای ارسال پیام وجود ندارد.</p>}
      {result && <p role="status">{result.sent.toLocaleString("fa-IR")} ارسال موفق، {result.failed.toLocaleString("fa-IR")} ناموفق از {result.total.toLocaleString("fa-IR")} گروه.{result.failed > 0 && " پیش از ارسال دوباره، وضعیت گروه‌های ناموفق را بررسی کنید؛ ارسال دوباره به همه انجام می‌شود."}</p>}
      {error && <p role="alert" style={{ color: "#991b1b" }}>{error}</p>}
    </form>
  </section>;
}
