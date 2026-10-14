import { gcm } from "@noble/ciphers/aes";
import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";

/**
 * Client half of encrypted API payloads (the server half is
 * packages/backend/src/lib/payload-crypto.ts; keep the two in step).
 *
 * Not a security boundary: TLS protects the wire, and this page holds the
 * session key. It keeps request and response bodies out of plain sight in the
 * network panel on test and app.
 */

export const KEY_HEADER = "x-bp-key";
export const ENCRYPTED_CONTENT_TYPE = "application/vnd.buildpanda.enc+json";
const VERSION = 1;

/**
 * Bodies up to this size are sealed. Sealing adds about a third, and the
 * server's default body limit is 1 MiB; the few larger bodies (PDF takeoff
 * editor batches) go as they are rather than tripping a 413.
 */
export const MAX_SEALED_BODY = 700 * 1024;

/** Whether a JSON body is small enough to seal, measured in UTF-8 bytes. */
export function fitsSealLimit(json: string): boolean {
  return json.length <= MAX_SEALED_BODY && utf8(json).length <= MAX_SEALED_BODY;
}
const INFO = utf8("buildpanda-payload-v1");
const AAD = { request: utf8("bp-req-v1"), response: utf8("bp-res-v1") } as const;

export interface Envelope {
  v: number;
  iv: string;
  ct: string;
}

export interface PayloadSession {
  /** Sent with every request so the server can derive the same key. */
  publicKey: string;
  key: Uint8Array;
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function fromUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
  // Hermes without TextDecoder: decode by hand
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++]!;
    let code = b;
    if (b >= 0xf0) code = ((b & 0x07) << 18) | ((bytes[i++]! & 0x3f) << 12) | ((bytes[i++]! & 0x3f) << 6) | (bytes[i++]! & 0x3f);
    else if (b >= 0xe0) code = ((b & 0x0f) << 12) | ((bytes[i++]! & 0x3f) << 6) | (bytes[i++]! & 0x3f);
    else if (b >= 0xc0) code = ((b & 0x1f) << 6) | (bytes[i++]! & 0x3f);
    out += String.fromCodePoint(code);
  }
  return out;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!;
    if (i + 1 < bytes.length) out += ALPHABET[(n >> 6) & 63]!;
    if (i + 2 < bytes.length) out += ALPHABET[n & 63]!;
  }
  return out;
}

function fromBase64Url(text: string): Uint8Array {
  const clean = text.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    const value = ALPHABET.indexOf(char === "+" ? "-" : char === "/" ? "_" : char);
    if (value < 0) throw new Error("Invalid base64");
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, index);
}

/** A fresh key pair for this session, agreed against the server's public key. */
export function createSession(serverPublicKey: string, random: (length: number) => Uint8Array): PayloadSession {
  const secret = random(32);
  const publicKey = x25519.getPublicKey(secret);
  const shared = x25519.getSharedSecret(secret, fromBase64Url(serverPublicKey));
  return { publicKey: toBase64Url(publicKey), key: hkdf(sha256, shared, publicKey, INFO, 32) };
}

export function seal(session: PayloadSession, plaintext: string, random: (length: number) => Uint8Array): Envelope {
  const iv = random(12);
  const ct = gcm(session.key, iv, AAD.request).encrypt(utf8(plaintext));
  return { v: VERSION, iv: toBase64Url(iv), ct: toBase64Url(ct) };
}

export function open(session: PayloadSession, envelope: Envelope): string {
  return fromUtf8(gcm(session.key, fromBase64Url(envelope.iv), AAD.response).decrypt(fromBase64Url(envelope.ct)));
}

export function isEnvelope(value: unknown): value is Envelope {
  const v = value as Partial<Envelope> | null;
  return Boolean(v && typeof v === "object" && v.v === VERSION && typeof v.iv === "string" && typeof v.ct === "string");
}
