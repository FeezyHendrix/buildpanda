// Saving a corrected figure and signing it off as one act.
//
// Done as two requests, a QS who edits then verifies is racing themselves: the
// edit lands, someone else measures the same line, and the verify that follows
// signs off a figure its author never saw. Here both writes share one
// transaction and one session lock, and the verify names the exact version the
// save just produced — so the row is either saved AND verified at that version,
// or neither.
//
// The derived lines an anchor edit drags with it are recomputed but NOT
// verified: only the line the caller actually looked at gets their signature.

import { BadRequestError, ConflictError } from "../../../lib/errors.ts";
import { num, toRow } from "./dto.ts";
import { assertDerivedFanout, derivedRowsIn } from "./editor-limits.ts";
import type { EditorWriteContext } from "./editor-unit-of-work.ts";
import { isAnchorRow, recomputeDerivedRows, record, requireRow } from "./editor-writers.ts";
import { buildRowUpdatePatch } from "./row-patch.ts";
import type { PreconBoqRowDto, UpdateRowBody } from "./types.ts";

export async function saveAndVerifyIn(
  ctx: EditorWriteContext,
  sessionId: string,
  rowId: string,
  body: UpdateRowBody,
  actor: string,
): Promise<PreconBoqRowDto> {
  const row = await requireRow(ctx, rowId);
  if (row.status === null) throw new BadRequestError("Row is not a reviewable item");

  const { patch } = buildRowUpdatePatch(row, body.changes, actor);
  const fansOut = body.changes.qty !== undefined && isAnchorRow(row);
  if (fansOut) assertDerivedFanout(derivedRowsIn(await ctx.rows.rowsBySession(sessionId)).length);

  const saved = await ctx.rows.updateRowVersioned(rowId, body.version, patch);
  if (!saved) {
    const current = await ctx.rows.rowById(rowId);
    throw new ConflictError(
      `Row was updated by someone else (current version ${current?.version ?? "?"}); refresh and reapply`,
    );
  }

  const verified = await ctx.rows.updateRowVersioned(rowId, saved.version, {
    status: "verified",
    verified_by: actor,
    verified_at: new Date(),
  });
  // Unreachable while the session lock holds; if it ever is reached the save
  // rolls back with it, which is the whole point of doing both here.
  if (!verified) throw new ConflictError("Row changed while it was being saved; refresh and retry");

  await record(ctx, sessionId, rowId, actor, "adjusted", { qty: num(row.qty), rate: num(row.rate) }, body.changes);
  await record(ctx, sessionId, rowId, actor, "verified", { status: row.status }, { status: "verified" });
  ctx.emit({ type: "row.updated", sessionId, rowId, version: saved.version, actor, changes: body.changes });
  ctx.emit({
    type: "row.verified",
    sessionId,
    rowId,
    version: verified.version,
    actor,
    changes: { status: "verified" },
  });
  if (fansOut) await recomputeDerivedRows(ctx, sessionId, actor);
  return toRow(verified);
}
