import { env } from "../config/env";

type Json = Record<string, unknown> | unknown[];

export interface ApiResult<T> {
  status: number;
  ok: boolean;
  body: T;
}

// Thin HTTP client against the Fastify backend for seeding and teardown — never
// drives the UI. Carries a session cookie so requests pass auth/project guards.
export class ApiClient {
  private cookie: string | null = null;

  constructor(private readonly baseUrl: string = env.apiUrl) {}

  setCookie(cookie: string | null): void {
    this.cookie = cookie;
  }

  getCookie(): string | null {
    return this.cookie;
  }

  private headers(hasBody: boolean): Record<string, string> {
    const h: Record<string, string> = {};
    if (hasBody) h["Content-Type"] = "application/json";
    if (this.cookie) h["Cookie"] = this.cookie;
    // Better Auth enforces an Origin check against trustedOrigins (the app's
    // CORS origins). Direct fetch() sends no Origin, so we supply the SPA's
    // origin — a trusted value — to pass sign-up/sign-in.
    h["Origin"] = env.baseUrl;
    return h;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: Json,
  ): Promise<ApiResult<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    // Capture any Set-Cookie so auth flows can persist the session.
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const token = setCookie.split(";")[0];
      if (token) this.cookie = this.cookie ? mergeCookie(this.cookie, token) : token;
    }
    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return { status: res.status, ok: res.ok, body: parsed as T };
  }

  get<T = unknown>(path: string): Promise<ApiResult<T>> {
    return this.request<T>("GET", path);
  }
  post<T = unknown>(path: string, body?: Json): Promise<ApiResult<T>> {
    return this.request<T>("POST", path, body);
  }
  patch<T = unknown>(path: string, body?: Json): Promise<ApiResult<T>> {
    return this.request<T>("PATCH", path, body);
  }
  put<T = unknown>(path: string, body?: Json): Promise<ApiResult<T>> {
    return this.request<T>("PUT", path, body);
  }
  delete<T = unknown>(path: string): Promise<ApiResult<T>> {
    return this.request<T>("DELETE", path);
  }

  // Like post(), but throws with context on a non-2xx — for seeding steps that
  // must succeed (a failed seed should fail the test loudly, not silently).
  async postOrThrow<T = unknown>(path: string, body?: Json): Promise<T> {
    const r = await this.post<T>(path, body);
    if (!r.ok) {
      throw new Error(`POST ${path} -> ${r.status}: ${JSON.stringify(r.body)}`);
    }
    return r.body;
  }
}

function mergeCookie(existing: string, incoming: string): string {
  const name = incoming.split("=")[0];
  const kept = existing
    .split("; ")
    .filter((c) => c.split("=")[0] !== name)
    .join("; ");
  return kept ? `${kept}; ${incoming}` : incoming;
}
