import { createSession, type PayloadSession } from "./payload-crypto";

export const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

let pending: Promise<PayloadSession | null> | null = null;

/**
 * This tab's payload session, or null where encryption is off (local
 * development answers 404 for the key). A failed lookup is retried on the
 * next request rather than leaving the whole session in plain text.
 */
export function payloadSession(): Promise<PayloadSession | null> {
  pending ??= fetch(`${import.meta.env.VITE_API_BASE_URL || "/api"}/crypto/payload-key`, { credentials: "include" })
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
  return pending;
}
