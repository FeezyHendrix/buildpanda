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
  pending ??= fetch(`${API_BASE_URL}/crypto/payload-key`)
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
