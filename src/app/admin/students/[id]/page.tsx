"use client";

import { useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { accessToken, onSessionExpired } from "@/lib/api";
import TelegramControl from "./TelegramControl";

const subscribe = (callback: () => void) => onSessionExpired("ADMIN", callback);
const snapshot = () => accessToken("ADMIN") || "";
const serverSnapshot = () => "";

export default function AdminStudentTelegram() {
  const { id } = useParams<{ id: string }>();
  const token = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (!token) return <main><p>ابتدا وارد شوید.</p></main>;
  return <main><h1>Telegram Control — Student #{id}</h1><TelegramControl studentId={id} token={token} /></main>;
}
