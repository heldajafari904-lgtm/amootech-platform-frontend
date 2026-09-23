export const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export type User = { id: number; username: string; first_name: string; last_name: string; email: string; role: string; is_active?: boolean };
export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] };
export type AuthRole = "ADMIN" | "COUNSELOR" | "STUDENT";
type TokenPair = { access: string; refresh: string };
export const SESSION_EXPIRED = "نشست شما به پایان رسیده است. لطفاً دوباره وارد شوید.";

const keys: Record<AuthRole, { access: string; refresh: string }> = {
  ADMIN: { access: "amootech_access", refresh: "amootech_refresh" },
  COUNSELOR: { access: "amootech_counselor_access", refresh: "amootech_counselor_refresh" },
  STUDENT: { access: "amootech_student_access", refresh: "amootech_student_refresh" },
};
const roles = Object.keys(keys) as AuthRole[];
const tokenRoles = new Map<string, AuthRole>();
const refreshes = new Map<AuthRole, Promise<string>>();

export function accessToken(role: AuthRole): string | null {
  return typeof window === "undefined" ? null : sessionStorage.getItem(keys[role].access);
}

export function saveSession(role: AuthRole, pair: TokenPair) {
  const previous = accessToken(role);
  if (previous) tokenRoles.set(previous, role);
  sessionStorage.setItem(keys[role].access, pair.access);
  sessionStorage.setItem(keys[role].refresh, pair.refresh);
  tokenRoles.set(pair.access, role);
}

export function clearSession(role: AuthRole, expired = false) {
  sessionStorage.removeItem(keys[role].access);
  sessionStorage.removeItem(keys[role].refresh);
  for (const [token, owner] of tokenRoles) if (owner === role) tokenRoles.delete(token);
  if (expired) window.dispatchEvent(new CustomEvent("amootech:session-expired", { detail: role }));
}

export function onSessionExpired(role: AuthRole, callback: () => void): () => void {
  const listener = (event: Event) => { if ((event as CustomEvent<AuthRole>).detail === role) callback(); };
  window.addEventListener("amootech:session-expired", listener);
  return () => window.removeEventListener("amootech:session-expired", listener);
}

function roleFor(token: string): AuthRole | undefined {
  return tokenRoles.get(token) || roles.find((role) => accessToken(role) === token);
}

function readable(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(readable);
  if (value && typeof value === "object") return Object.entries(value).filter(([key]) => key !== "code" && key !== "messages" && key !== "active_item").flatMap(([key, item]) => {
    const values = readable(item);
    return key === "detail" || key === "non_field_errors" ? values : values.map((message) => `${key}: ${message}`);
  });
  return [];
}

export function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  const messages = readable(reason);
  return messages.length ? messages.join(" | ") : "درخواست انجام نشد. لطفاً دوباره تلاش کنید.";
}

async function responseError(response: Response): Promise<Error> {
  const data: unknown = await response.json().catch(() => null);
  if (response.status === 401 || (data && typeof data === "object" && "code" in data && data.code === "token_not_valid")) return new Error(SESSION_EXPIRED);
  return new Error(errorMessage(data));
}

export async function obtainTokenPair(username: string, password: string): Promise<TokenPair> {
  const response = await fetch(`${baseUrl}/auth/token/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }), cache: "no-store" });
  if (!response.ok) throw new Error("نام کاربری یا رمز عبور درست نیست.");
  return response.json();
}

async function refreshAccess(role: AuthRole): Promise<string> {
  const pending = refreshes.get(role);
  if (pending) return pending;
  const task = (async () => {
    const refresh = sessionStorage.getItem(keys[role].refresh);
    if (!refresh) throw new Error(SESSION_EXPIRED);
    const response = await fetch(`${baseUrl}/auth/token/refresh/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh }), cache: "no-store" });
    if (!response.ok) throw new Error(SESSION_EXPIRED);
    const pair: { access?: string; refresh?: string } = await response.json();
    if (!pair.access) throw new Error(SESSION_EXPIRED);
    saveSession(role, { access: pair.access, refresh: pair.refresh || refresh });
    return pair.access;
  })().catch(() => {
    clearSession(role, true);
    throw new Error(SESSION_EXPIRED);
  }).finally(() => { refreshes.delete(role); });
  refreshes.set(role, task);
  return task;
}

async function authorizedResponse(path: string, token: string, method = "GET", body?: object): Promise<Response> {
  const role = roleFor(token);
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const send = (access: string) => fetch(url, {
    method,
    headers: { Authorization: `Bearer ${access}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const current = role ? accessToken(role) || token : token;
  let response = await send(current);
  if (response.status === 401 && role) {
    const latest = accessToken(role);
    const renewed = latest && latest !== current ? latest : await refreshAccess(role);
    response = await send(renewed); // Exactly one retry; no recursive refresh.
    if (response.status === 401) clearSession(role, true);
  }
  if (!response.ok) throw await responseError(response);
  return response;
}

export async function api<T>(path: string, token: string, method = "GET", body?: object): Promise<T> {
  const response = await authorizedResponse(path, token, method, body);
  return response.status === 204 ? (undefined as T) : response.json();
}

export async function apiBlob(path: string, token: string): Promise<Blob> {
  return (await authorizedResponse(path, token)).blob();
}

export async function allPages<T>(path: string, token: string): Promise<T[]> {
  const items: T[] = [];
  let next: string | null = path;
  const visited = new Set<string>();
  while (next) {
    if (visited.has(next)) throw new Error("پاسخ صفحه‌بندی سرویس نامعتبر است.");
    visited.add(next);
    const page: Page<T> = normalizePage<T>(await api<unknown>(next, token));
    items.push(...page.results);
    next = page.next;
  }
  return items;
}

export function normalizePage<T>(value: unknown): Page<T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ساختار پاسخ فهرست از سرویس معتبر نیست.");
  const page = value as Partial<Page<T>>;
  if (!Array.isArray(page.results) || typeof page.count !== "number" || !(page.next === null || typeof page.next === "string") || !(page.previous === null || typeof page.previous === "string")) {
    throw new Error("ساختار پاسخ فهرست از سرویس معتبر نیست.");
  }
  return page as Page<T>;
}

export async function publicApi<T>(path: string, method = "GET", body?: object): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) throw await responseError(response);
  return response.json();
}
