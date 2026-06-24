// Env access for the E2E harness — mirrors the backend `config/index.ts` shape
// (single access point, dev-friendly defaults matching the repo's ports).
// ASSUMPTION (A2): credentials & base URLs come from env; CI overrides these.

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export const env = {
  baseUrl: optional("E2E_BASE_URL", "http://localhost:5173"),
  apiUrl: optional("E2E_API_URL", "http://localhost:3000"),
  // Same DATABASE_URL the backend uses; needed to flip `emailVerified` after
  // sign-up since Better Auth gates sign-in on it (see fixtures/auth.ts).
  databaseUrl: optional("DATABASE_URL", ""),
  password: optional("E2E_PASSWORD", "E2ePlaywright!2026"),
  noWebServer: optionalBool("E2E_NO_WEBSERVER", false),
  isCi: optionalBool("CI", false),
};

export type Env = typeof env;
