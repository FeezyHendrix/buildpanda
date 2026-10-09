// Writing a recorded state back, which is what every reversal ultimately does.
//
// Split out of editor-reverse-service.ts at the house 400-line ceiling; the
// service still owns the decision (may this be reversed at all), this owns the
// write (put exactly this back).

import type { ExpectedVersion } from "./types.ts";
import type { OperationStateV1 } from "./editor-operation-types.ts";
import { commentsOf, markupEditingIn, markupsOf } from "./editor-markup-writers.ts";
import type { OperationWriteContext } from "./editor-unit-of-work.ts";
import { canonicalJson } from "./editor-fingerprint.ts";
import { sheetStateOf } from "./editor-operation-state.ts";
import {
  readMarkupGeometry,
  readMarkupStyle,
  readOverlaySettings,
  readSheetCalibration,
  readViewports,
} from "./editor-audit-parse.ts";

const sameSheetJson = (a: unknown, b: unknown): boolean => canonicalJson(a ?? null) === canonicalJson(b ?? null);

export interface AppliedState {
  rows: ExpectedVersion[];
  restoredGeometryIds: string[];
  tombstonedGeometryIds: string[];
}

/**
 * Writing a recorded state back. A record the state says did not exist becomes a
 * tombstone; one it describes is restored field for field. A restored line's
 * status never comes back as `verified`: the figure moved under whoever signed it,
 * so it returns to review.
 */
export interface ApplyStateRequest {
  state: OperationStateV1;
  actor: string;
  sessionId: string;
  /** The state the reversed operation left, when the caller already read it. */
  committed?: OperationStateV1;
}

export async function applyState(ctx: OperationWriteContext, request: ApplyStateRequest): Promise<AppliedState> {
  const { state, actor, sessionId, committed } = request;
  const restoredGeometryIds: string[] = [];
  const tombstonedGeometryIds: string[] = [];
  const now = new Date();

  // Shapes first: a bill line only means something once the measurements behind
  // it are back, and parent_geometry_id is RESTRICT.
  for (const [id, recorded] of Object.entries(state.geometries)) {
    const live = await ctx.geometries.geometryByIdIncludeDeleted(id);
    if (!live) continue;
    if (recorded === null || recorded.deleted) {
      if (!live.deleted_at) {
        await ctx.geometries.softDeleteGeometry(id, now);
        tombstonedGeometryIds.push(id);
      }
      continue;
    }
    await ctx.geometries.restoreGeometryState(id, {
      rowId: recorded.rowId,
      parentGeometryId: recorded.parentGeometryId,
      vertices: recorded.vertices,
      quantity: recorded.quantity,
      unit: recorded.unit,
      definition: recorded.definition,
      deleted_at: null,
    });
    restoredGeometryIds.push(id);
  }

  // Re-scaling is an edit to the drawing itself. Restored BEFORE the lines, so
  // anything re-added afterwards is re-added at the scale being restored.
  //
  // Only when it actually differs. Most operations name a sheet merely because
  // their lines are measured on it, and rewriting an unchanged drawing is not
  // harmless: `replaceViewports` would turn a NULL column into `[]`, which reads
  // as a different state and makes the NEXT reversal in the chain conflict.
  for (const [id, recorded] of Object.entries(state.sheets ?? {})) {
    if (!recorded) continue;
    const live = await ctx.sheets.sheetById(id);
    if (!live) continue;
    const current = sheetStateOf(live);
    if (current.scaleMmPerPt !== recorded.scaleMmPerPt || !sameSheetJson(current.calibration, recorded.calibration)) {
      // A sheet that had no scale is restored to having none, so the patch is nullable.
      await ctx.sheets.applyCalibration(id, {
        scaleMmPerPt: recorded.scaleMmPerPt,
        calibration: readSheetCalibration(recorded.calibration),
      });
    }
    const viewports = readViewports(recorded.viewports);
    if (viewports && !sameSheetJson(current.viewports, recorded.viewports)) {
      await ctx.sheets.replaceViewports(id, viewports);
    }
    if (!sameSheetJson(current.overlaySettings ?? null, recorded.overlaySettings ?? null)) {
      await ctx.sheets.setOverlaySettings(id, readOverlaySettings(recorded.overlaySettings));
    }
  }

  // A redline is put back through the markup module's own restore, which is
  // what refuses when somebody replied after the withdrawal — the undo of a
  // withdrawal must not fold a later voice into a thread they never saw.
  for (const [id, recorded] of Object.entries(state.markups ?? {})) {
    if (!recorded) continue;
    const editing = markupEditingIn(ctx, sessionId);
    const live = await markupsOf(ctx, sessionId, [id]);
    const current = live[0];
    if (!current) continue;
    const wasDeleted = current.deleted_at !== null && current.deleted_at !== undefined;
    if (recorded.deletedAt === null && wasDeleted) {
      await editing.restoreMarkup(id, actor);
      continue;
    }
    if (recorded.deletedAt !== null && !wasDeleted) {
      await editing.softDeleteMarkup(id, actor, current.version ?? 1);
      continue;
    }
    if (wasDeleted) continue;
    const style = readMarkupStyle(recorded.style);
    await editing.editMarkup(id, actor, {
      version: current.version ?? 1,
      geometry: readMarkupGeometry(recorded.geometry),
      ...(recorded.color === null ? {} : { color: recorded.color }),
      ...(style === null ? {} : { style }),
    });
    // Only the words this operation actually changed. Rewriting every recorded
    // comment would reach for other people's — and the module rightly refuses,
    // so the undo of one's own edit would fail on somebody else's note.
    const liveComments = new Map((await commentsOf(ctx, id)).map((c) => [c.id, c]));
    for (const [commentId, text] of Object.entries(recorded.comments)) {
      if (text.deletedAt !== null) continue;
      const live = liveComments.get(commentId);
      if (!live || live.deleted_at !== null || live.body === text.body) continue;
      await editing.editComment(id, commentId, actor, {
        version: live.version ?? 1,
        body: text.body,
        bodyHtml: text.bodyHtml,
      });
    }
  }

  const rows: ExpectedVersion[] = [];
  // A record the operation CREATED has no "before" at all: the target state does
  // not mention it, while the committed state does. Undoing a creation therefore
  // means withdrawing it, which a straight replay of `before` would never do.
  for (const id of Object.keys(committed?.rows ?? {})) {
    if (id in state.rows) continue;
    const live = await ctx.rows.rowByIdIncludeDeleted(id);
    if (!live || live.deleted_at) continue;
    const withdrawn = await ctx.rows.softDeleteRow(id, now);
    rows.push({ id, version: (withdrawn ?? live).version });
  }
  for (const id of Object.keys(committed?.geometries ?? {})) {
    if (id in state.geometries) continue;
    const live = await ctx.geometries.geometryByIdIncludeDeleted(id);
    if (!live || live.deleted_at) continue;
    await ctx.geometries.softDeleteGeometry(id, now);
    tombstonedGeometryIds.push(id);
  }
  for (const [id, recorded] of Object.entries(state.rows)) {
    const live = await ctx.rows.rowByIdIncludeDeleted(id);
    if (!live) continue;
    if (recorded === null) {
      const withdrawn = await ctx.rows.softDeleteRow(id, now);
      rows.push({ id, version: (withdrawn ?? live).version });
      continue;
    }
    const restored = await ctx.editor.restoreRowState(id, {
      description: recorded.description,
      unit: recorded.unit,
      qty_gross: recorded.qtyGross,
      qty: recorded.qty,
      deductions: recorded.deductions,
      typical: recorded.typical,
      rate: recorded.rate,
      amount: recorded.amount,
      measurement_basis: recorded.measurementBasis,
      measurement_settings: recorded.measurementSettings ?? null,
      status: recorded.status === "verified" ? "needs_review" : recorded.status,
      deleted_at: recorded.deleted ? now : null,
      edited_by: actor,
    });
    rows.push({ id, version: restored.version });
  }
  return { rows, restoredGeometryIds, tombstonedGeometryIds };
}

/**
 * Every drawing the operation happened on, from BOTH sides of it and including
 * tombstones.
 *
 * A compensation that withdraws a creation leaves nothing active to read a sheet
 * id from, so deriving this from live records alone produced `[]` — and the
 * sheet-scoped history then dropped the entry, taking the redo with it. The
 * recorded states still name the sheet, whether or not the shape survives.
 */
export function sheetsOf(...states: (OperationStateV1 | undefined)[]): string[] {
  const ids = new Set<string>();
  for (const state of states) {
    for (const geometry of Object.values(state?.geometries ?? {})) {
      if (geometry) ids.add(geometry.sheetId);
    }
    for (const id of Object.keys(state?.sheets ?? {})) ids.add(id);
  }
  return [...ids];
}

