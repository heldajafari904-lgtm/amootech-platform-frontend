"use client";

import { createContext, useContext } from "react";
import type { User } from "@/lib/api";

export const CounselorContext = createContext<{ token: string; user: User } | null>(null);

export function useCounselor() {
  const value = useContext(CounselorContext);
  if (!value) throw new Error("Counselor context is unavailable");
  return value;
}
