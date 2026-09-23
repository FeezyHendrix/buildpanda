// Writing a re-run's result back, which is the only dangerous part of a re-run.
//
// Reading a drawing again is slow and harmless; applying what came back is fast
// and destructive. It prunes the engine's old drafts, rewrites the drawing
// register and inserts a new set of lines — and those landed as a sequence of
// separate statements against the pool, so a crash halfway left a take-off with
// its old lines pruned and its new ones missing, and two re-runs could interleave
// their deletes and inserts into a bill nobody could account for.
//
// Three rules, and the whole file exists to hold them together:
//
//   * ONE transaction. The prune and the insert commit together or neither does.
//   * The SESSION LOCK, taken first, so a re-run and an editor operation cannot
//     restate the same lines at once. It waits rather than refuses: nobody is
//     sitting in front of a background job, and refusing would throw away a
//     reading that took minutes to produce.
//   * NOTHING SLOW INSIDE. The PDF read, the vision call and the LLM build-up
//     all happen before `applyRerun` is entered — holding a row lock across a
//     network round trip would block every editor on the take-off for as long as
//     the model took to answer.
//
// The generation check is what makes a re-run safe to repeat. See the
// `rerun_generation` migration for why one counter covers both a straggler and
// a redelivery.

import type { Knex } from "knex";
import { ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { lockSession } from "./session-lock.ts";

/** Which re-run a result belongs to. Minted when the re-run is requested. */
export interface RerunToken {
  sessionId: string;
  generation: number;
}

interface GenerationRow {
  rerun_generation: number | string | null;
}

export async function currentGeneration(db: Knex | Knex.Transaction, sessionId: string): Promise<number> {
  const row = await db<GenerationRow>("precon_sessions").where({ id: sessionId }).first("rerun_generation");
  if (!row) throw new NotFoundError("Preconstruction session");
  return Number(row.rerun_generation ?? 0);
}

/**
 * Claim the next re-run. Every request for one — a corrected layer map, a
 * corrected sheet scale, a redraft — takes a new number, so a result computed
 * before the correction can be told apart from one computed after it.
 */
export async function beginRerun(db: Knex, sessionId: string): Promise<RerunToken> {
  const updated = await db("precon_sessions")
    .where({ id: sessionId })
    .increment("rerun_generation", 1)
    .returning<GenerationRow[]>("rerun_generation");
  const current = updated[0];
  if (!current) throw new NotFoundError("Preconstruction session");
  return { sessionId, generation: Number(current.rerun_generation ?? 0) };
}

/**
 * The result, applied once, inside the lock, or not at all.
 *
 * `apply` is handed THIS transaction and must build its repositories from it.
 * It must not open another one: a nested `db.transaction()` runs on its own
 * connection, outside this lock and this rollback, which is the split write the
 * file exists to prevent.
 */
export async function applyRerun<T>(
  db: Knex,
  token: RerunToken,
  apply: (trx: Knex.Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (trx) => {
    await lockSession(trx, token.sessionId, "wait");
    const current = await currentGeneration(trx, token.sessionId);
    if (current !== token.generation) {
      throw new ConflictError(
        `This re-run was superseded before its result came back (it read the take-off at re-run ${token.generation}, ` +
          `which is now on ${current}); nothing was changed.`,
      );
    }
    const result = await apply(trx);
    await trx("precon_sessions").where({ id: token.sessionId }).increment("rerun_generation", 1);
    return result;
  });
}
