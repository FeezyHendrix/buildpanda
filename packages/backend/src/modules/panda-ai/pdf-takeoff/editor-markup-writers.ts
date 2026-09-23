// Redline changes as editor operations.
//
// A pin, a stroke and a comment are evidence on a contractual drawing, so they
// belong under the same lock, the same receipt and the same undo as the
// measurements beside them. They were not: the markup endpoints versioned and
// audited each change, but nothing serialised them against a re-calibration
// restating the sheet underneath, and no receipt existed to reverse.
//
// The writing itself still belongs to the drawing-markup module — this file
// owns no SQL and no table name. It composes that module's own editing service
// over the transaction the unit of work already holds, so one commit covers the
// redline, the audit entry and whatever else the operation touched.

import { NotFoundError } from "../../../lib/errors.ts";
import { drawingMarkupEditing } from "../../drawing-markup/editing.ts";
import { toMarkup } from "../../drawing-markup/mappers.ts";
import { drawingMarkupRepository } from "../../drawing-markup/repository.ts";
import type { DrawingMarkup, DrawingMarkupRow } from "../../drawing-markup/types.ts";
import type { OperationWriteContext } from "./editor-unit-of-work.ts";

const EMPTY = new Map<string, never>();

/** The editor discards the rendered record; a receipt names ids, never a DTO. */
const bare = (row: DrawingMarkupRow): DrawingMarkup =>
  toMarkup(row, {
    comments: EMPTY,
    names: EMPTY,
    rfiByMarkup: EMPTY,
    approvalByMarkup: EMPTY,
    currentVersionByDocument: EMPTY,
    revisionByVersion: EMPTY,
  });

/**
 * The markup module's own editing service, bound to THIS operation's
 * transaction, so its writes land inside the session lock rather than beside it.
 */
export function markupEditingIn(ctx: OperationWriteContext, sessionId: string) {
  const repo = drawingMarkupRepository(ctx.trx);
  const loadMarkup = async (id: string): Promise<DrawingMarkupRow> => {
    const markup = await repo.markupById(id);
    // A markup id is caller-supplied, so a pin on another take-off's drawing
    // must read as absent rather than as someone else's evidence.
    if (!markup || markup.precon_session_id !== sessionId) throw new NotFoundError("Markup");
    return markup;
  };
  return drawingMarkupEditing({
    repo,
    loadMarkup,
    getMarkup: async (id: string) => bare(await loadMarkup(id)),
  });
}

/**
 * The state reader widened with the redlines this session owns, so a capture and
 * the comparison that follows it describe the same world. Without it the
 * reversal reads back an empty markup set and refuses every redline undo.
 */
export function markupAwareReader(ctx: OperationWriteContext, sessionId: string) {
  const repo = drawingMarkupRepository(ctx.trx);
  return {
    ...ctx,
    markups: {
      markupById: async (id: string) => {
        const markup = await repo.markupById(id);
        return markup && markup.precon_session_id === sessionId ? markup : undefined;
      },
      commentsForMarkupIncludeDeleted: (id: string) => repo.commentsForMarkupIncludeDeleted(id),
    },
  };
}

export function commentsOf(ctx: OperationWriteContext, markupId: string) {
  return drawingMarkupRepository(ctx.trx).commentsForMarkupIncludeDeleted(markupId);
}

export async function markupsOf(
  ctx: OperationWriteContext,
  sessionId: string,
  ids: string[],
): Promise<DrawingMarkupRow[]> {
  const repo = drawingMarkupRepository(ctx.trx);
  const found: DrawingMarkupRow[] = [];
  for (const id of ids) {
    const markup = await repo.markupById(id);
    if (markup && markup.precon_session_id === sessionId) found.push(markup);
  }
  return found;
}
