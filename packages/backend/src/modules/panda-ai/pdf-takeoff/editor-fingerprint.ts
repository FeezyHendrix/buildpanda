// What makes a retry idempotent rather than a second edit.
//
// A save that times out on the wire leaves the client unable to tell whether it
// landed. Resending the same `operationId` must therefore be answered from the
// first attempt's record — but only if it really is the same request. If the
// same id arrives carrying a DIFFERENT command, the client has reused an id for
// a new edit, and replaying the old receipt would report success for work that
// never happened. So the operation's meaning is hashed and stored with it, and
// a mismatch is a conflict rather than a replay.
//
// The hash is taken over canonical JSON: object keys sorted, so key order in
// the request cannot change the fingerprint; numbers normalised through
// JSON.stringify, so 2.70 and 2.7 agree; `undefined` and absent properties
// treated alike, so an optional field the client omits matches one it sends as
// undefined. `operationId` itself is excluded — it is the identity being looked
// up, not part of what is being compared.

import { BadRequestError } from "../../../lib/errors.ts";
import { createHash } from "node:crypto";
import type { EditorOperationRequest } from "./editor-operation-types.ts";
import type { ReverseOperationBody } from "./request-types.ts";

type Canonical = null | boolean | number | string | Canonical[] | { [key: string]: Canonical };

function canonicalise(value: unknown): Canonical | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    // A quantity nobody can defend must not be hashable into a stable identity
    if (!Number.isFinite(value)) throw new BadRequestError("This edit carries a number that is not finite, so it describes no drawing");
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => canonicalise(item) ?? null);
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: { [key: string]: Canonical } = {};
    for (const key of Object.keys(source).sort()) {
      const canonical = canonicalise(source[key]);
      if (canonical !== undefined) out[key] = canonical;
    }
    return out;
  }
  throw new TypeError(`Cannot fingerprint a ${typeof value}`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalise(value) ?? null);
}

/**
 * The identity of what this operation MEANS: its command, the versions it
 * expected and whether it also signs the result off. Excludes `operationId`,
 * and excludes actor and session because those are the indexed identity the
 * receipt is looked up by, not part of the comparison.
 */
export function requestFingerprint(request: EditorOperationRequest): string {
  const material = {
    command: request.command,
    expectedRows: request.expectedRows ?? [],
    expectedSheets: request.expectedSheets ?? [],
    expectedMarkups: request.expectedMarkups ?? [],
    verify: request.verify === true,
  };
  return createHash("sha256").update(canonicalJson(material), "utf8").digest("hex");
}

/**
 * The same identity for an undo. What a reversal MEANS is the entry it
 * compensates for plus the versions it expected, so reusing one undo's id to
 * reverse a different entry is a reused id and not a retry.
 */
export function reverseFingerprint(eventId: string, body: ReverseOperationBody): string {
  const material = {
    reverses: eventId,
    expectedRows: body.expectedRows ?? [],
    expectedSheets: body.expectedSheets ?? [],
    expectedMarkups: body.expectedMarkups ?? [],
  };
  return createHash("sha256").update(canonicalJson(material), "utf8").digest("hex");
}
