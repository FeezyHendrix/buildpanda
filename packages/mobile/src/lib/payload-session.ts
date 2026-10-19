import { getRandomBytes } from "expo-crypto";
import { API_BASE_URL } from "./api-base-url";
import { createSession, type PayloadSession } from "./payload-crypto";

// Hermes has no crypto.getRandomValues; expo-crypto reads the OS generator.
export const randomBytes = (length: number) => getRandomBytes(length);

let pending: Promise<PayloadSession | null> | null = null;

/**
 * This app session's payload key, or null where encryption is off (a local
 * server answers 404). A failed lookup — no signal, say — is retried on the
 * next request instead of leaving the session in plain text.
 */
export function payloadSession(): Promise<PayloadSession | null> {
  if (!pending) {
    // Bounded lookup: request() awaits this BEFORE arming its own timeout, so
    // a stalled connection here used to hang every API call — and every
    // loading spinner — in the app at once.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    pending = fetch(`${API_BASE_URL}/crypto/payload-key`, { signal: controller.signal })
      .finally(() => clearTimeout(timeout))
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`payload key ${response.status}`);
        const { publicKey } = (await response.json()) as { publicKey: string };
        return createSession(publicKey, randomBytes);
      })
      .catch(() => {
        pending = null;
        return null;
      });
  }
  return pending;
}

/** The server's answer when this session's key no longer matches its own. */
export const STALE_KEY_CODE = "payload_key_stale";

/**
 * Forget this app session's key so the next request fetches it again: the
 * server rotated it, or switched encryption on or off, while the app ran.
 */
export function resetPayloadSession(): void {
  pending = null;
}

export function isStaleKeyError(status: number | undefined, body: unknown): boolean {
  return status === 400 && (body as { code?: unknown } | null)?.code === STALE_KEY_CODE;
}
