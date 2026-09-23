// The one lock that serialises everything which restates a take-off.
//
// An editor operation and a re-run of the automated take-off both rewrite the
// same bill lines, so they cannot be allowed to interleave: a re-run pruning
// drafts while a save is halfway through restating one produces a bill with a
// quantity nobody measured. Both take THIS lock on the session row, which is
// why it lives on its own rather than inside either of them.
//
// Extracted from `editor-unit-of-work.ts` so the re-run path can take the very
// same lock. A second copy of this would be two locks that look like one.

import type { Knex } from "knex";
import { ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { isLockNotAvailable } from "./editor-repository.ts";

/**
 * `nowait` tells a second editor immediately that the drawing is busy, which is
 * right for an interactive save: being held on a lock and then applied on top of
 * a state the user never saw is worse than being asked to refresh.
 *
 * `wait` is for callers nobody is sitting in front of — the operation envelope
 * retrying its own save, and a background re-run with a reading that took
 * minutes to produce. Both have to queue rather than throw the work away.
 * Bounded by `lock_timeout` so neither can ever hang.
 */
export type SessionLockMode = "nowait" | "wait";

export const SESSION_LOCK_TIMEOUT_MS = 10_000;

interface LockedSessionResult {
  rows: { id: string }[];
}

export async function lockSession(trx: Knex.Transaction, sessionId: string, mode: SessionLockMode): Promise<void> {
  let result: LockedSessionResult;
  try {
    if (mode === "wait") {
      // SET LOCAL takes no bind parameter, so the value is interpolated. It is a
      // module-level integer constant, never caller input.
      await trx.raw(`SET LOCAL lock_timeout = ${Number(SESSION_LOCK_TIMEOUT_MS)}`);
      result = await trx.raw<LockedSessionResult>("SELECT id FROM precon_sessions WHERE id = ? FOR UPDATE", [sessionId]);
    } else {
      result = await trx.raw<LockedSessionResult>("SELECT id FROM precon_sessions WHERE id = ? FOR UPDATE NOWAIT", [
        sessionId,
      ]);
    }
  } catch (error) {
    if (isLockNotAvailable(error)) throw new ConflictError("Session is being modified by another operation");
    throw error;
  }
  if (result.rows.length === 0) throw new NotFoundError("Preconstruction session");
}
