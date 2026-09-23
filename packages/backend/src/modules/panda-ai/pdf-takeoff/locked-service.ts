// The session lock for the writers that predate the editor.
//
// `editorService` runs its own writes under a lock; every other mutating path —
// the row PATCH, the assembly measure, the sheet settings, the assistant — ran on
// the pool. That is not a theoretical race: an assembly creating N lines while an
// editor operation re-adds the same row interleaves their writes, and the loser's
// figure survives with the winner's audit entry beside it.
//
// The fix is deliberately NOT a second implementation of those writers. The
// services already take a `PreconRepository`; handing them one bound to a locked
// transaction makes every statement they run part of it, with no duplicated
// logic to drift. `preconService` is rebuilt per request against `trx`, which
// costs a few closures and buys atomicity.
//
// Realtime events are buffered and flushed after commit, for the same reason the
// editor buffers them: announcing a change that can still roll back tells every
// other editor something untrue.

import type { Knex } from "knex";
import { NotFoundError } from "../../../lib/errors.ts";
import { lockSession } from "./session-lock.ts";
import { preconRepository } from "./repository.ts";
import { preconService, type PreconChangeEvent, type PublishFn } from "./service.ts";
import type { StaleLookup } from "./stale.ts";

export type LockedApi = ReturnType<typeof preconService>;

/**
 * Runs `fn` against a session-locked, transaction-bound service. The callback
 * must not open a nested transaction: a nested `db.transaction()` takes its own
 * connection, outside this lock and this rollback.
 */
export function lockedPreconService(db: Knex, publish: PublishFn, staleLookup?: StaleLookup) {
  const pooled = preconRepository(db);

  async function forSession<T>(sessionId: string, fn: (api: LockedApi) => Promise<T>): Promise<T> {
    const buffered: { sessionId: string; event: PreconChangeEvent }[] = [];
    const result = await db.transaction(async (trx) => {
      await lockSession(trx, sessionId, "wait");
      const api = preconService(preconRepository(trx), (id, event) => buffered.push({ sessionId: id, event }), staleLookup);
      return fn(api);
    });
    for (const entry of buffered) publish(entry.sessionId, entry.event);
    return result;
  }

  // The id→session lookups are reads on the pool and must PRECEDE the lock: the
  // lock is taken on whichever session they resolve to.
  return {
    forSession,

    async forRow<T>(rowId: string, fn: (api: LockedApi) => Promise<T>): Promise<T> {
      const sessionId = await pooled.sessionIdForRow(rowId);
      if (!sessionId) throw new NotFoundError("BOQ row");
      return forSession(sessionId, fn);
    },

    async forBill<T>(billId: string, fn: (api: LockedApi) => Promise<T>): Promise<T> {
      const bill = await pooled.billById(billId);
      if (!bill) throw new NotFoundError("Bill");
      return forSession(bill.session_id, fn);
    },

    async forSheet<T>(sheetId: string, fn: (api: LockedApi) => Promise<T>): Promise<T> {
      const sheet = await pooled.sheetById(sheetId);
      if (!sheet) throw new NotFoundError("Sheet");
      return forSession(sheet.session_id, fn);
    },
  };
}

export type LockedPreconService = ReturnType<typeof lockedPreconService>;
