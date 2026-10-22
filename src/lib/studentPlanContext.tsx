"use client";

import { createContext, useContext } from "react";
import type { User } from "@/lib/api";

export const StudentPlanContext = createContext<{ token: string; user: User } | null>(null);
export function useStudentPlanAuth() {
  const value = useContext(StudentPlanContext);
  if (!value) throw new Error("Student plan context is unavailable");
  return value;
}

