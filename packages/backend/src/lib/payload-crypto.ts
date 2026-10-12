import { createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, diffieHellman, hkdfSync, randomBytes, type KeyObject } from "node:crypto";

/**
 * Encrypted API payloads. Not a security boundary: TLS protects the wire, and
 * the browser holding the session key can always read what it decrypts. This
 * keeps request and response bodies out of plain sight in the network panel
 * on test and app.
 *
 * Each client session makes an X25519 key pair and sends its public key with
 * every request. Both sides derive the same AES-256-GCM key with HKDF-SHA256,
 * salted with the client's public key. Bodies are sealed with a fresh 12-byte
 * nonce, the tag appended, and the direction bound in as associated data so a
 * response cannot be replayed as a request.
 */

export const PAYLOAD_VERSION = 1;
export const KEY_HEADER = "x-bp-key";
export const ENCRYPTED_CONTENT_TYPE = "application/vnd.buildpanda.enc+json";
const INFO = Buffer.from("buildpanda-payload-v1");
const AAD = { request: Buffer.from("bp-req-v1"), response: Buffer.from("bp-res-v1") } as const;

// DER wrappers for a raw 32-byte X25519 key.
const PKCS8_PREFIX = Buffer.from("302e020100300506032b656e04220420", "hex");
const SPKI_PREFIX = Buffer.from("302a300506032b656e032100", "hex");

export interface Envelope {
  v: number;
  iv: string;
  ct: string;
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const unb64 = (text: string) => Buffer.from(text, "base64url");

export interface ServerKey {
  privateKey: KeyObject;
  publicKey: string;
}

export function loadServerKey(secret: string): ServerKey | null {
  if (!secret) return null;
  const raw = unb64(secret);
  if (raw.length !== 32) throw new Error("API_PAYLOAD_KEY must be 32 bytes, base64url encoded");
  const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, raw]), format: "der", type: "pkcs8" });
  const spki = createPublicKey(privateKey).export({ format: "der", type: "spki" });
  return { privateKey, publicKey: b64(spki.subarray(SPKI_PREFIX.length)) };
}

export function generateServerSecret(): string {
  return b64(randomBytes(32));
}

/** The session key for one client public key. */
export function deriveKey(server: ServerKey, clientPublicKey: string): Buffer {
  const raw = unb64(clientPublicKey);
  if (raw.length !== 32) throw new Error("Invalid client key");
  const publicKey = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: "der", type: "spki" });
  const shared = diffieHellman({ privateKey: server.privateKey, publicKey });
  return Buffer.from(hkdfSync("sha256", shared, raw, INFO, 32));
}

export function seal(key: Buffer, plaintext: string, direction: keyof typeof AAD): Envelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD[direction]);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return { v: PAYLOAD_VERSION, iv: b64(iv), ct: b64(ct) };
}

export function open(key: Buffer, envelope: Envelope, direction: keyof typeof AAD): string {
  const iv = unb64(envelope.iv);
  const data = unb64(envelope.ct);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(AAD[direction]);
  decipher.setAuthTag(data.subarray(data.length - 16));
  return Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]).toString("utf8");
}

export function isEnvelope(value: unknown): value is Envelope {
  const v = value as Partial<Envelope> | null;
  return Boolean(v && v.v === PAYLOAD_VERSION && typeof v.iv === "string" && typeof v.ct === "string");
}
