// What each command WILL touch, resolved before anything is written.
//
// This is the half of the envelope that makes reversal generic. The operation
// service captures the full before-state of everything `scopeOf` names, so a
// command whose scope is wrong is a command whose undo silently loses data — a
// reassign that named only the target would undo by restoring the target and
// leaving the source at the figure it had while the shape was gone.
//
// So every command names EVERY row and shape whose stored state it can move,
// including ones it only touches indirectly: the source line of a reassign, all
// lines on a re-scaled sheet, all shapes on a line whose factor changed.
//
// Nothing here writes, and nothing here starts a transaction.

import { BadRequestError, NotFoundError } from "../../../lib/errors.ts";
import { planBatch } from "./editor-batch-envelope.ts";
import { contributingShapes } from "./editor-row-recompute.ts";
import type { EditorCommand } from "./editor-operation-types.ts";
import type { OperationWriteContext } from "./editor-unit-of-work.ts";
import { requireRow } from "./editor-write-helpers.ts";
import type { PreconGeometryRow } from "./types.ts";

export interface CommandScope {
  rowIds: string[];
  geometryIds: string[];
  sheetIds: string[];
  /** Redlines the operation may move. A markup change touches no priced line. */
  markupIds: string[];
}

export interface CommandContext {
  ctx: OperationWriteContext;
  sessionId: string;
  actor: string;
}

/**
 * The shape named by a command, checked against the session it claims to be in.
 * A geometry id is caller-supplied, so resolving it without this check would let
 * one session edit another organisation's drawing.
 */
export async function geometryInSession(
  { ctx, sessionId }: CommandContext,
  geometryId: string,
): Promise<{ geometry: PreconGeometryRow; rowId: string }> {
  const geometry = await ctx.geometries.geometryById(geometryId);
  if (!geometry) throw new NotFoundError("Measurement");
  const sheet = await ctx.sheets.sheetById(geometry.sheet_id);
  if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Measurement");
  return { geometry, rowId: geometry.row_id };
}

/**
 * The line named by a command, checked against the session it claims to be in.
 *
 * Membership is the line's own bill, never the drawings it happens to be
 * measured on. Inferring it from geometry was the same as not checking it for
 * every line that carries none — an engine-drafted stated deduction, a derived
 * line, a stated quantity, a line never measured, a line whose shapes were
 * withdrawn — and those are exactly the lines the deduction commands target.
 */
export async function rowInSession({ ctx, sessionId }: CommandContext, rowId: string): Promise<string> {
  const row = await requireRow(ctx, rowId);
  if ((await ctx.rows.sessionIdForRow(row.id)) !== sessionId) throw new NotFoundError("BOQ row");
  return row.id;
}

export async function sheetInSession({ ctx, sessionId }: CommandContext, sheetId: string): Promise<string> {
  const sheet = await ctx.sheets.sheetById(sheetId);
  if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Sheet");
  return sheet.id;
}

/** A line plus every shape on it — parents and openings alike. */
async function wholeLine(context: CommandContext, rowId: string): Promise<CommandScope> {
  const shapes = await context.ctx.geometries.geometriesByRow(rowId);
  return {
    rowIds: [rowId],
    geometryIds: shapes.map((shape) => shape.id),
    sheetIds: [...new Set(shapes.map((shape) => shape.sheet_id))],
    markupIds: [],
  };
}

function merge(...scopes: CommandScope[]): CommandScope {
  return {
    rowIds: [...new Set(scopes.flatMap((scope) => scope.rowIds))],
    geometryIds: [...new Set(scopes.flatMap((scope) => scope.geometryIds))],
    sheetIds: [...new Set(scopes.flatMap((scope) => scope.sheetIds))],
    markupIds: [...new Set(scopes.flatMap((scope) => scope.markupIds))],
  };
}

/**
 * Every line measured on one drawing. A re-scale or a viewport change restates
 * all of them at once, so all of them are part of the operation's before-state —
 * a line the QS never opened still has to be restorable by the undo.
 */
export async function linesOnSheet(context: CommandContext, sheetId: string): Promise<CommandScope> {
  const shapes = await context.ctx.geometries.geometriesBySheet(sheetId);
  const rowIds = [...new Set(shapes.map((shape: PreconGeometryRow) => shape.row_id))];
  const scopes = await Promise.all(rowIds.map((rowId: string) => wholeLine(context, rowId)));
  // The shapes' OTHER sheets matter too: a line measured across two drawings is
  // re-added from both, so re-scaling one of them moves a figure that depends on
  // the other. Both end up in the scope through wholeLine.
  return merge({ rowIds: [], geometryIds: shapes.map((shape: PreconGeometryRow) => shape.id), sheetIds: [sheetId], markupIds: [] }, ...scopes);
}

export async function scopeOf(context: CommandContext, command: EditorCommand): Promise<CommandScope> {
  switch (command.kind) {
    case "create-assembly": {
      // The rows and shapes do not exist yet; the receipt names them once
      // `execute` has minted them.
      return { rowIds: [], geometryIds: [], sheetIds: [await sheetInSession(context, command.sheetId)], markupIds: [] };
    }
    case "duplicate-row": {
      const scope = await wholeLine(context, await rowInSession(context, command.rowId));
      const target = command.targetSheetId ? await sheetInSession(context, command.targetSheetId) : null;
      return target ? merge(scope, { rowIds: [], geometryIds: [], sheetIds: [target], markupIds: [] }) : scope;
    }
    case "create-geometry": {
      // The row and shape do not exist yet, so the "before" for them is absent;
      // the ids land in the receipt once `execute` has minted them.
      return { rowIds: [], geometryIds: [], sheetIds: [await sheetInSession(context, command.sheetId)], markupIds: [] };
    }
    case "update-geometry":
    case "delete-geometry": {
      const { rowId } = await geometryInSession(context, command.geometryId);
      return wholeLine(context, rowId);
    }
    case "set-row-factor":
    case "set-row-typical":
    case "set-measurement-settings":
      return wholeLine(context, await rowInSession(context, command.rowId));

    // The exception line and its copied shapes do not exist yet; the receipt
    // names them once `execute` has minted them.
    case "split-repeat-exception":
      return wholeLine(context, await rowInSession(context, command.rowId));

    case "confirm-measurement-basis": {
      const { rowId } = await geometryInSession(context, command.geometryId);
      if (rowId !== command.rowId) throw new BadRequestError("That measurement does not belong to the line you named");
      return wholeLine(context, rowId);
    }

    case "add-deduction":
    // A legacy opening has no shape of its own, so the scope is the line and
    // every drawing on it — which is what the undo restores the figure from.
    case "edit-stated-deduction":
    case "remove-stated-deduction":
      return wholeLine(context, await rowInSession(context, command.rowId));
    case "edit-deduction":
    case "remove-deduction": {
      await geometryInSession(context, command.geometryId);
      return wholeLine(context, await rowInSession(context, command.rowId));
    }

    // Sheet only: it touches no line, so naming one would put an untouched
    // priced row into the operation's before-state for no reason.
    case "set-overlay":
      return { rowIds: [], geometryIds: [], sheetIds: [await sheetInSession(context, command.sheetId)], markupIds: [] };

    case "edit-markup":
    case "delete-markup":
    case "restore-markup":
    case "edit-comment":
      return { rowIds: [], geometryIds: [], sheetIds: [], markupIds: [command.markupId] };

    // A rebind re-measures the whole line, openings included, so the line and
    // every shape on it are part of what the undo must be able to put back.
    case "rebind-geometry": {
      const { rowId } = await geometryInSession(context, command.geometryId);
      return wholeLine(context, rowId);
    }

    case "batch":
      return (await planBatch(context, command, scopeOf)).scope;

    case "apply-calibration":
    case "apply-viewports":
      return linesOnSheet(context, await sheetInSession(context, command.sheetId));

    case "split-polyline":
    case "remove-segment":
    case "transform-geometry":
    case "split-polygon":
    case "duplicate-geometry": {
      const { rowId } = await geometryInSession(context, command.geometryId);
      if (rowId !== command.rowId) throw new BadRequestError("That measurement does not belong to the line you named");
      const scope = await wholeLine(context, rowId);
      const target = command.kind === "duplicate-geometry" && command.targetSheetId
        ? await sheetInSession(context, command.targetSheetId)
        : null;
      return target ? merge(scope, { rowIds: [], geometryIds: [], sheetIds: [target], markupIds: [] }) : scope;
    }

    case "merge-geometries": {
      if (command.rowIds.length < 2) throw new BadRequestError("Merging needs at least two lines");
      const scopes = await Promise.all(command.rowIds.map(async (id: string) => wholeLine(context, await rowInSession(context, id))));
      return merge(...scopes);
    }

    case "reassign-geometry": {
      const { rowId } = await geometryInSession(context, command.geometryId);
      // BOTH lines: the source loses a contribution and is re-added too, so an
      // undo that did not know about it would leave it at the wrong figure.
      const [source, target] = await Promise.all([
        wholeLine(context, rowId),
        wholeLine(context, await rowInSession(context, command.targetRowId)),
      ]);
      return merge(source, target);
    }
  }
}

export { contributingShapes };
