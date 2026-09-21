export const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export type User = { id: number; username: string; first_name: string; last_name: string; email: string; role: string; is_active?: boolean };
export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export async function api<T>(path: string, token: string, method = "GET", body?: object): Promise<T> {
  const response = await fetch(path.startsWith("http") ? path : `${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(JSON.stringify(detail));
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export async function allPages<T>(path: string, token: string): Promise<T[]> {
  const items: T[] = [];
  let next: string | null = path;
  while (next) {
    const page: Page<T> = await api<Page<T>>(next, token);
    items.push(...page.results);
    next = page.next;
  }
  return items;
}

export async function publicApi<T>(path: string, method = "GET", body?: object): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(JSON.stringify(await response.json().catch(() => ({}))));
  return response.json();
}
