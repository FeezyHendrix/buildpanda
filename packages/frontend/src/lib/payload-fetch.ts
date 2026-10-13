import { ENCRYPTED_CONTENT_TYPE, fitsSealLimit, isEnvelope, KEY_HEADER, open, seal } from "./payload-crypto";
import { isStaleKeyError, payloadSession, randomBytes, resetPayloadSession } from "./payload-session";

/**
 * fetch for Better Auth's client, which does not go through api/client.ts.
 * Same rules as the axios interceptors: where encryption is on, a JSON body
 * is sealed and a sealed JSON reply is opened before the client reads it.
 * Anything else (redirects, files, plain replies) passes through untouched.
 */
export async function payloadFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  try {
    const response = await attempt(input, init);
    if (!response.stale) return response.response;
  } catch (error) {
    if (!(error instanceof StaleKey)) throw error;
  }
  // The key changed while this tab was open: fetch it again, try once more.
  resetPayloadSession();
  return (await attempt(input, init)).response;
}

class StaleKey extends Error {}

async function attempt(input: RequestInfo | URL, init: RequestInit): Promise<{ response: Response; stale: boolean }> {
  const session = await payloadSession();
  if (!session) return { response: await fetch(input, init), stale: false };

  const headers = new Headers(init.headers);
  headers.set(KEY_HEADER, session.publicKey);
  let body = init.body;
  if (typeof body === "string" && body && fitsSealLimit(body)) {
    body = JSON.stringify(seal(session, body, randomBytes));
    headers.set("Content-Type", ENCRYPTED_CONTENT_TYPE);
  }

  const response = await fetch(input, { ...init, headers, body });
  if (!(response.headers.get("content-type") ?? "").includes("json")) return { response, stale: false };
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON after all; hand back what came.
  }
  let plain = text;
  if (isEnvelope(parsed)) {
    try {
      plain = open(session, parsed);
    } catch {
      // Sealed with a key this session does not hold.
      throw new StaleKey();
    }
  }
  const rebuilt = new Response(plain, { status: response.status, statusText: response.statusText, headers: response.headers });
  const stale = isStaleKeyError(response.status, isEnvelope(parsed) ? safeJson(plain) : parsed);
  return { response: rebuilt, stale };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * One event from a stream answered to an encrypting client (Panda AI):
 * the server seals each event's data like any other reply.
 */
export async function openStreamEvent(data: unknown): Promise<unknown> {
  if (!isEnvelope(data)) return data;
  const session = await payloadSession();
  if (!session) throw new StaleKey();
  return JSON.parse(open(session, data));
}
