import { ENCRYPTED_CONTENT_TYPE, fitsSealLimit, isEnvelope, KEY_HEADER, open, seal } from "./payload-crypto";
import { payloadSession, randomBytes } from "./payload-session";

/**
 * fetch for Better Auth's client, which does not go through api/client.ts.
 * Same rules as the axios interceptors: where encryption is on, a JSON body
 * is sealed and a sealed JSON reply is opened before the client reads it.
 * Anything else (redirects, files, plain replies) passes through untouched.
 */
export async function payloadFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const session = await payloadSession();
  if (!session) return fetch(input, init);

  const headers = new Headers(init.headers);
  headers.set(KEY_HEADER, session.publicKey);
  let body = init.body;
  if (typeof body === "string" && body && fitsSealLimit(body)) {
    body = JSON.stringify(seal(session, body, randomBytes));
    headers.set("Content-Type", ENCRYPTED_CONTENT_TYPE);
  }

  const response = await fetch(input, { ...init, headers, body });
  if (!(response.headers.get("content-type") ?? "").includes("json")) return response;
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON after all; hand back what came.
  }
  const plain = isEnvelope(parsed) ? open(session, parsed) : text;
  return new Response(plain, { status: response.status, statusText: response.statusText, headers: response.headers });
}
