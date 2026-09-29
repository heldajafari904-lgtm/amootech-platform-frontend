"use client";
import { api } from "@/lib/api";

export type TreeSubject = { id: number; name: string; field: number };
export type TreeChapter = { id: number; name: string; subject: number };
export type TreeTopic = { id: number; name: string; chapter: number };
export type AcademicTree = { subjects: TreeSubject[]; chapters: TreeChapter[]; topics: TreeTopic[] };

const cache = new Map<string, AcademicTree>();

export async function fetchAcademicTree(token: string, params: Record<string, string>): Promise<AcademicTree> {
  const key = JSON.stringify(params);
  if (cache.has(key)) return cache.get(key)!;
  const q = new URLSearchParams(params).toString();
  const data = await api<AcademicTree>(`/academics/tree/?${q}`, token);
  cache.set(key, data);
  return data;
}
