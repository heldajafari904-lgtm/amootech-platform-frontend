"use client";

import { useState, useEffect } from "react";
import TelegramControl from "./TelegramControl";

export default function AdminStudentTelegram({ params }: { params: { id: string } }) {
  const [token, setToken] = useState("");
  useEffect(() => {
    setToken(sessionStorage.getItem("amootech_access") || "");
  }, []);
  if (!token) return <main><p>ابتدا وارد شوید.</p></main>;
  return <main><h1>Telegram Control — Student #{params.id}</h1><TelegramControl studentId={params.id} token={token} /></main>;
}
