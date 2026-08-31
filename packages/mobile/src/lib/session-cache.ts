import { storage } from "./storage";

/**
 * Last known-good identity, so the app boots signed-in with no network.
 *
 * better-auth's `useSession()` resolves to `null` both when the user is signed
 * out AND when the session fetch simply fails — which, on a site with no
 * signal, is most of the time. Gating on that alone would sign a crew member
 * out mid-shift and lose whatever they hadn't synced.
 *
 * So this cache is the source of truth for "is someone signed in", and it is
 * cleared on exactly two events: an explicit sign-out, or a server response
 * that actually says the session is gone (401). Never on a transport error.
 */
const KEY = "buildpanda_session_user";

export interface CachedUser {
  id: string;
  name: string;
  email: string;
}

function isCachedUser(value: unknown): value is CachedUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    typeof user.name === "string" &&
    typeof user.email === "string"
  );
}

export function readCachedUser(): CachedUser | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCachedUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCachedUser(user: CachedUser | null): void {
  try {
    if (user) storage.setItem(KEY, JSON.stringify(user));
    else storage.removeItem(KEY);
  } catch {
    // Keychain unavailable — session still works for this app session.
  }
}
