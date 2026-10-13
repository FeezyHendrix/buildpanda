import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";
import { config } from "../config/index.ts";
import { AppError } from "../lib/errors.ts";
import {
  deriveKey,
  ENCRYPTED_CONTENT_TYPE,
  isEnvelope,
  KEY_HEADER,
  loadServerKey,
  open,
  seal,
  type ServerKey,
} from "../lib/payload-crypto.ts";

declare module "fastify" {
  interface FastifyRequest {
    payloadKey?: Buffer;
  }
}

/** Public path that tells a client whether, and with what key, to encrypt. */
export const PAYLOAD_KEY_PATH = "/crypto/payload-key";

const CACHE_LIMIT = 2000;

/**
 * The client's session no longer matches the server: the key was rotated,
 * or encryption was switched off, while a tab or app stayed open. Clients
 * answer this code by fetching the key again and retrying once, so a key
 * change never strands an open session (or fails a queued offline write).
 */
export const STALE_KEY_CODE = "payload_key_stale";

function staleKey(message: string): AppError {
  return new AppError(message, { statusCode: 400, code: STALE_KEY_CODE });
}

/**
 * Encrypted JSON payloads, on when API_PAYLOAD_KEY is set (test and app).
 * A client that fetched the public key sends its own in `x-bp-key`; its JSON
 * bodies arrive sealed, and every JSON response to it goes back sealed.
 * Requests without the header (webhooks, sign-in, older clients, streams and
 * file transfers) are served exactly as before.
 */
export default fp(async (fastify) => {
  let server: ServerKey | null;
  try {
    server = loadServerKey(config.http.payloadKey);
  } catch (error) {
    fastify.log.error({ err: error }, "payload encryption: API_PAYLOAD_KEY is invalid; payloads stay plain");
    server = null;
  }

  fastify.get(PAYLOAD_KEY_PATH, async (_request, reply) => {
    if (!server) return reply.status(404).send({ error: "Payload encryption is off" });
    return { version: 1, publicKey: server.publicKey };
  });
  if (!server) {
    // Off, but a client that started while it was on still sends sealed
    // bodies: say so in a way it acts on, rather than a bare 415.
    fastify.addContentTypeParser(ENCRYPTED_CONTENT_TYPE, { parseAs: "string" }, (_request, _body, done) => {
      done(staleKey("Payload encryption is off; fetch the key again"), undefined);
    });
    return;
  }
  const key = server;

  // Session keys are reused across a client's requests; deriving one is an
  // X25519 exchange, so keep the most recent ones.
  const cache = new Map<string, Buffer>();
  function sessionKey(request: FastifyRequest): Buffer | undefined {
    const header = request.headers[KEY_HEADER];
    if (typeof header !== "string" || !header) return undefined;
    let derived = cache.get(header);
    if (!derived) {
      try {
        derived = deriveKey(key, header);
      } catch {
        throw staleKey("Invalid payload key");
      }
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
      cache.set(header, derived);
    }
    return derived;
  }

  fastify.addHook("onRequest", async (request) => {
    request.payloadKey = sessionKey(request);
  });

  fastify.addContentTypeParser(ENCRYPTED_CONTENT_TYPE, { parseAs: "string" }, (request, body, done) => {
    try {
      const derived = request.payloadKey ?? sessionKey(request);
      const envelope: unknown = JSON.parse(body as string);
      if (!derived || !isEnvelope(envelope)) throw staleKey("Encrypted body without a usable key");
      const plain = open(derived, envelope, "request");
      done(null, plain ? JSON.parse(plain) : undefined);
    } catch (error) {
      done(error instanceof AppError ? error : staleKey("Could not decrypt the request"), undefined);
    }
  });

  fastify.addHook("onSend", async (request, reply, payload) => {
    if (!request.payloadKey || typeof payload !== "string") return payload;
    const type = String(reply.getHeader("content-type") ?? "");
    if (!type.startsWith("application/json")) return payload;
    reply.header("cache-control", "no-store");
    return JSON.stringify(seal(request.payloadKey, payload, "response"));
  });
});
