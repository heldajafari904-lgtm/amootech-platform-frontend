type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
// Keep the same intent across a network error/reload; a successful creation clears it.
export function creationRequest<T extends object>(payload: T, storage: Storage, scope: string, uuid = () => crypto.randomUUID()) {
  const signature = JSON.stringify(payload);
  const key = `amootech-exam-creation:${scope}`;
  let previous: { signature: string; id: string } | null = null;
  try { previous = JSON.parse(storage.getItem(key) || "null"); } catch { /* replace malformed storage */ }
  const id = previous?.signature === signature ? previous.id : uuid();
  storage.setItem(key, JSON.stringify({ signature, id }));
  return { ...payload, creation_key: id };
}
export function creationComplete(storage: Storage, scope: string) {
  storage.removeItem(`amootech-exam-creation:${scope}`);
}
