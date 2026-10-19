type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
const pendingKey = "amootech-manual-exam";
export function examId(value: string | null) {
  const id = Number(value);
  return value !== null && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(id) ? id : null;
}
export function rememberManualExam(storage: Storage, userId: number, id: number) {
  storage.setItem(pendingKey, JSON.stringify({ userId, examId: id }));
}
export function pendingManualExam(storage: Storage, userId: number) {
  try {
    const value = JSON.parse(storage.getItem(pendingKey) || "null");
    return value?.userId === userId ? examId(String(value.examId)) : null;
  } catch { return null; }
}
export function clearManualExam(storage: Storage, userId: number, id: number) {
  if (pendingManualExam(storage, userId) === id) storage.removeItem(pendingKey);
}
export function returnedManualExam(search: string, storage: Storage, userId: number) {
  const params = new URLSearchParams(search);
  return params.has("manual_exam") ? examId(params.get("manual_exam")) : pendingManualExam(storage, userId);
}
// Login destinations are restricted to the existing exam workspace, never an
// external URL or provider URL. All query input is untrusted.
export function safeExamReturn(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, "https://amootech.invalid");
    if (url.origin !== "https://amootech.invalid" || url.pathname !== "/counselor/exams") return null;
    const id = examId(url.searchParams.get("manual_exam"));
    const session = url.searchParams.get("edit_session");
    const edit = session && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session) ? `&edit_session=${session}` : "";
    return id ? `/counselor/exams?manual_exam=${id}${edit}` : "/counselor/exams";
  } catch { return null; }
}

export function safePDFUrl(value: string | null | undefined) {
  try { const url = new URL(value || ""); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
