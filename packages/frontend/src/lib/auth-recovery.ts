import { safeReturnPath } from "./return-path";

type RecoveryKind = "verification" | "password";
interface RecoveryContext { email: string; redirectTo: string | null; expiresAt: number }
const keyFor = (kind: RecoveryKind) => `auth-recovery:v1:${kind}`;

/** Email and destination only. Shared across tabs for links opened from email. */
export function rememberAuthRecovery(kind: RecoveryKind, email: string, redirectTo: string | null) {
  try {
    localStorage.setItem(keyFor(kind), JSON.stringify({
      email, redirectTo: safeReturnPath(redirectTo), expiresAt: Date.now() + 60 * 60 * 1000,
    }));
  } catch { /* The current page and return URL still work without storage. */ }
}

export function readAuthRecovery(kind: RecoveryKind): RecoveryContext | null {
  try {
    const value = JSON.parse(localStorage.getItem(keyFor(kind)) ?? "null") as RecoveryContext | null;
    if (!value || typeof value.email !== "string" || !(value.expiresAt > Date.now())) return null;
    return { ...value, redirectTo: safeReturnPath(value.redirectTo) };
  } catch { return null; }
}

export function clearAuthRecovery(kind: RecoveryKind) {
  try { localStorage.removeItem(keyFor(kind)); } catch { /* Storage unavailable. */ }
}

export function authRecoveryPath(page: "verify-email" | "forgot-password" | "reset-password", target: string | null) {
  const redirect = safeReturnPath(target);
  return `/auth/${page}${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`;
}
