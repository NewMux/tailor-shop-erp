type AuthUser = { id: number; name: string | null; email: string | null; role: "user" | "admin" };
type AuthResponse = { user: AuthUser; token: string };

type AuthErrorPayload = { error?: { message?: string; code?: string } };

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "erp_local_session";

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

function readToken() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // The HttpOnly cookie remains available for same-origin deployments.
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(apiUrl(path), { ...init, headers, credentials: "include" });
  const payload = (await response.json().catch(() => ({}))) as T & AuthErrorPayload;
  if (!response.ok) {
    throw new Error(payload.error?.message || "Authentication request failed.");
  }
  return payload as T;
}

function remember(response: AuthResponse) {
  writeToken(response.token);
  window.dispatchEvent(new Event("auth-changed"));
  return response;
}

export const authApi = {
  async session() {
    const response = await request<{ authenticated: boolean; user: AuthUser | null }>("/api/auth/session", { method: "GET" });
    return response.authenticated;
  },
  async register(name: string, email: string, password: string) {
    return remember(await request<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }));
  },
  async login(email: string, password: string) {
    return remember(await request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }));
  },
  async forgot(email: string) {
    return request<{ message: string; resetUrl?: string }>("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
  },
  async reset(token: string, password: string) {
    return remember(await request<AuthResponse>("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) }));
  },
  async logout() {
    try {
      await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } finally {
      writeToken(null);
      window.dispatchEvent(new Event("auth-changed"));
    }
  },
  getToken() {
    return readToken();
  },
  clearToken() {
    writeToken(null);
  },
};
