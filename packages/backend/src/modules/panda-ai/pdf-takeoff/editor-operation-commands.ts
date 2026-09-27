// Each command, executed through the writer that already implements it.
//
// This file is a seam, not a second implementation. Every branch delegates to the
// shipped writer — `addDeductionIn`, `applyCalibrationIn`, `mergeGeometriesIn` —
// so the envelope adds receipts, idempotency, version checks and reversal to
// behaviour that is already reviewed, rather than forking it. The versions those
// writers expect are read from the live row HERE; commands carry ids and inputs
// only, never an authoritative quantity.
//
// Nothing here starts a transaction or takes a lock: it runs inside the one the
// unit of work already owns.

import { BadRequestError, ForbiddenError } from "../../../lib/errors.ts";
import { confirmMeasurementBasisIn } from "./editor-basis-confirm.ts";
import { executeMarkupCommand } from "./editor-markup-commands.ts";
import { mmPerPtFor } from "./editor-calibration-input.ts";
import { assertBatchGrants, planBatch, runBatch } from "./editor-batch-envelope.ts";
import { rebindGeometryIn } from "./editor-rebind-writer.ts";
import { setOverlayIn } from "./editor-overlay-writer.ts";
import { duplicateGeometryIn, duplicateRowIn } from "./editor-batch-copy.ts";
import { createAssemblyIn } from "./editor-assembly-command.ts";
import { mergeGeometriesIn, reassignGeometryIn } from "./editor-batch-merge.ts";
import { removeSegmentIn, splitPolygonIn, splitPolylineIn, transformGeometryIn } from "./editor-batch-writers.ts";
import { applyCalibrationIn, applyViewportsIn } from "./editor-calibration-writers.ts";
import {
  geometryInSession,
  rowInSession,
  scopeOf,
  sheetInSession,
  type CommandContext,
  type CommandScope,
} from "./editor-command-scope.ts";
import { executeDeductionCommand } from "./editor-deduction-commands.ts";
import { MEASURING_COMMAND_KINDS, type EditorCommand, type EditorGrants } from "./editor-operation-types.ts";
import { editDepthIn, editHeightIn, editTypicalIn } from "./editor-parameter-writers.ts";
import { setRepeatLabelsIn, splitRepeatExceptionIn } from "./editor-repeat-writers.ts";
import { contributingShapes } from "./editor-row-recompute.ts";
import { requireRow } from "./editor-write-helpers.ts";
import { createMeasurementIn, updateGeometryIn } from "./editor-writers.ts";

export { scopeOf };
export type { CommandContext, CommandScope };

export function assertGrants(command: EditorCommand, verify: boolean, grants: EditorGrants): void {
  if (!grants.edit) throw new ForbiddenError("Your role does not allow you to edit takeoffs");
  // Every member's grants BEFORE any of them runs: a batch whose fourth step
  // needs `verify` is refused outright, not after three have committed.
  if (command.kind === "batch") assertBatchGrants(command, verify, grants, assertGrants);
  // Copying a shape brings a NEW measurement into being, so it needs the same
  // grant as drawing one (contract 18).
  if (MEASURING_COMMAND_KINDS.includes(command.kind) && !grants.measure) {
    throw new ForbiddenError("Your role does not allow you to measure takeoffs");
  }
  if (verify && !grants.verify) throw new ForbiddenError("Your role does not allow you to verify takeoffs");
}

export interface CommandOutcome {
  action: string;
  /** Records the command created, which had no "before" to capture. */
  createdRowIds: string[];
  createdGeometryIds: string[];
  deletedRowIds: string[];
  deletedGeometryIds: string[];
}

const nothing = { createdRowIds: [], createdGeometryIds: [], deletedRowIds: [], deletedGeometryIds: [] };
const did = (action: string, over: Partial<CommandOutcome> = {}): CommandOutcome => ({ action, ...nothing, ...over });

async function deleteGeometry(context: CommandContext, geometryId: string): Promise<CommandOutcome> {
  const { ctx, sessionId, actor } = context;
  const { geometry, rowId } = await geometryInSession(context, geometryId);
  if (geometry.kind === "deduction") {
    throw new BadRequestError("Remove this opening through the deduction it belongs to, not as a measurement");
  }
  const children = (await ctx.geometries.geometriesByRow(rowId)).filter((c) => c.parent_geometry_id === geometryId);
  const deletedAt = new Date();
  // Openings cut out of this shape go with it: leaving them would net a figure
  // off a measurement the bill no longer has. parent_geometry_id is RESTRICT, so
  // they are tombstoned in child-before-parent order.
  for (const child of children) await ctx.geometries.softDeleteGeometry(child.id, deletedAt);
  await ctx.geometries.softDeleteGeometry(geometryId, deletedAt);

  const remaining = contributingShapes(await ctx.geometries.geometriesByRow(rowId));
  const deletedRowIds: string[] = [];
  const row = await requireRow(ctx, rowId);
  if (remaining.length === 0) {
    await ctx.rows.updateRowVersioned(rowId, row.version, { qty_gross: null, qty: null, amount: null });
    await ctx.rows.softDeleteRow(rowId, deletedAt);
    deletedRowIds.push(rowId);
    ctx.emit({ type: "row.deleted", sessionId, rowId, version: row.version + 1, actor, changes: {} });
  } else {
    ctx.emit({ type: "geometry.updated", sessionId, rowId, version: row.version, actor, changes: {} });
  }
  return did("geometry_deleted", { deletedRowIds, deletedGeometryIds: [...children.map((c) => c.id), geometryId] });
}

export async function execute(context: CommandContext, command: EditorCommand): Promise<CommandOutcome> {
  const { ctx, sessionId, actor } = context;
  const version = async (rowId: string): Promise<number> => (await requireRow(ctx, rowId)).version;

  switch (command.kind) {
    case "create-geometry": {
      // `vertices` are optional on the command when a `shape` is sent; the
      // legacy body still states them, and resolveShape treats an empty list
      // beside a shape as "the shape is the outline", never as a disagreement.
      const created = await createMeasurementIn(ctx, sessionId, { ...command, vertices: command.vertices ?? [] }, actor);
      return did("measured_by_hand", { createdRowIds: [created.row.id], createdGeometryIds: [created.geometry.id] });
    }
    case "update-geometry": {
      const { geometry, rowId } = await geometryInSession(context, command.geometryId);
      await updateGeometryIn(
        ctx,
        sessionId,
        rowId,
        {
          version: await version(rowId),
          kind: geometry.kind,
          vertices: command.vertices ?? [],
          ...(command.shape === undefined ? {} : { shape: command.shape }),
          sheetId: geometry.sheet_id,
          geometryId: geometry.id,
          ...(command.confirm ? { confirm: command.confirm } : {}),
        },
        actor,
      );
      return did("measured");
    }
    case "delete-geometry":
      return deleteGeometry(context, command.geometryId);

    case "confirm-measurement-basis": {
      const rowId = await rowInSession(context, command.rowId);
      await confirmMeasurementBasisIn(ctx, sessionId, { ...command, rowId }, actor);
      return did("measurement_basis_confirmed");
    }

    case "rebind-geometry": {
      const { rowId } = await geometryInSession(context, command.geometryId);
      await rebindGeometryIn(ctx, sessionId, { geometryId: command.geometryId, rowId, scaleChoice: command.scaleChoice }, actor);
      return did("geometry_rebound");
    }

    case "batch":
      return runBatch(context, command, { plan: planBatch, scopeOf, execute, nothing });

    case "set-overlay": {
      const sheetId = await sheetInSession(context, command.sheetId);
      await setOverlayIn(ctx, sessionId, { sheetId, overlay: command.overlay }, actor);
      return did("overlay_set");
    }

    case "edit-markup":
    case "delete-markup":
    case "restore-markup":
    case "edit-comment":
      return executeMarkupCommand(context, command);

    case "set-row-factor": {
      const rowId = await rowInSession(context, command.rowId);
      if ((command.heightM === undefined) === (command.depthM === undefined)) {
        throw new BadRequestError("Change either the height or the depth, not both and not neither");
      }
      if (command.heightM !== undefined) {
        await editHeightIn(ctx, sessionId, rowId, { version: await version(rowId), heightM: command.heightM }, actor);
        return did("height_changed");
      }
      await editDepthIn(ctx, sessionId, rowId, { version: await version(rowId), depthM: command.depthM! }, actor);
      return did("depth_changed");
    }
    case "set-row-typical": {
      const rowId = await rowInSession(context, command.rowId);
      await editTypicalIn(ctx, sessionId, rowId, { version: await version(rowId), typical: command.typical }, actor);
      return did("typical_changed");
    }

    case "set-measurement-settings": {
      const rowId = await rowInSession(context, command.rowId);
      await setRepeatLabelsIn(
        ctx,
        sessionId,
        rowId,
        { version: await version(rowId), repeatLabels: command.repeatLabels },
        actor,
      );
      return did("repeat_labels_set");
    }

    case "split-repeat-exception": {
      const rowId = await rowInSession(context, command.rowId);
      const split = await splitRepeatExceptionIn(
        ctx,
        sessionId,
        rowId,
        { version: await version(rowId), label: command.label, confirmed: command.confirmed },
        actor,
      );
      return did("repeat_exception_split", {
        createdRowIds: [split.exceptionRowId],
        createdGeometryIds: split.createdGeometryIds,
      });
    }

    case "add-deduction":
    case "edit-deduction":
    case "remove-deduction":
    case "edit-stated-deduction":
    case "remove-stated-deduction":
      return executeDeductionCommand(context, command);

    case "apply-calibration": {
      const sheetId = await sheetInSession(context, command.sheetId);
      const sheet = await ctx.sheets.sheetById(sheetId);
      await applyCalibrationIn(
        ctx,
        sessionId,
        sheetId,
        {
          version: sheet?.version ?? 1,
          newScaleMmPerPt: mmPerPtFor(command),
          ...(command.reference ? { reference: command.reference } : {}),
          ...(command.previewToken ? { previewToken: command.previewToken } : {}),
        },
        actor,
      );
      return did("recalibrated");
    }
    case "apply-viewports": {
      const sheetId = await sheetInSession(context, command.sheetId);
      const sheet = await ctx.sheets.sheetById(sheetId);
      await applyViewportsIn(
        ctx,
        sessionId,
        sheetId,
        {
          version: sheet?.version ?? 1,
          viewports: command.viewports,
          ...(command.confirmed === true ? { confirmed: true } : {}),
          ...(command.previewToken ? { previewToken: command.previewToken } : {}),
        },
        actor,
      );
      return did("viewports_changed");
    }

    case "split-polyline": {
      const rowId = await rowInSession(context, command.rowId);
      const split = await splitPolylineIn(
        ctx,
        sessionId,
        rowId,
        { version: await version(rowId), splitAtIndex: command.vertexIndex },
        actor,
      );
      // pieces[0] is the shape that was already there; pieces[1] is the new half.
      return did("split", { createdGeometryIds: split.createdGeometryIds });
    }
    case "remove-segment": {
      const rowId = await rowInSession(context, command.rowId);
      const trimmed = await removeSegmentIn(ctx, sessionId, rowId, command.segmentIndex, { version: await version(rowId) }, actor);
      return did("segment_removed", { createdGeometryIds: trimmed.createdGeometryIds });
    }
    case "duplicate-geometry": {
      const rowId = await rowInSession(context, command.rowId);
      const copied = await duplicateGeometryIn(
        ctx,
        sessionId,
        rowId,
        {
          version: await version(rowId),
          geometryId: command.geometryId,
          offset: command.offset,
          ...(command.targetSheetId ? { targetSheetId: command.targetSheetId } : {}),
          ...(command.crossSheet ? { crossSheet: command.crossSheet } : {}),
        },
        actor,
      );
      return did("duplicated", { createdRowIds: [copied.newRow.id], createdGeometryIds: [copied.newGeometryId] });
    }
    case "transform-geometry": {
      const rowId = await rowInSession(context, command.rowId);
      await transformGeometryIn(
        ctx,
        sessionId,
        rowId,
        {
          version: await version(rowId),
          geometryId: command.geometryId,
          ...(command.translate ? { translate: command.translate } : {}),
          ...(command.rotateDeg !== undefined ? { rotateDeg: command.rotateDeg } : {}),
          ...(command.about ? { about: command.about } : {}),
        },
        actor,
      );
      return did("transformed");
    }
    case "split-polygon": {
      const rowId = await rowInSession(context, command.rowId);
      const cut = await splitPolygonIn(
        ctx,
        sessionId,
        rowId,
        { version: await version(rowId), geometryId: command.geometryId, cut: command.cut },
        actor,
      );
      return did("polygon_split", { createdGeometryIds: cut.createdGeometryIds });
    }
    case "create-assembly": {
      const sheetId = await sheetInSession(context, command.sheetId);
      const sheet = await ctx.sheets.sheetById(sheetId);
      const session = await ctx.editor.sessionOrgId(sessionId);
      const result = await createAssemblyIn(
        ctx,
        sessionId,
        session,
        {
          assemblyId: command.assemblyId,
          sheetId,
          tool: command.tool,
          vertices: command.vertices,
          ...(command.elementGroup ? { elementGroup: command.elementGroup } : {}),
          ...(command.code ? { code: command.code } : {}),
          ...(command.factor ? { factor: command.factor } : {}),
          ...(command.typical !== undefined ? { typical: command.typical } : {}),
          ...(command.rate !== undefined ? { rate: command.rate } : {}),
          ...(command.billId ? { billId: command.billId } : {}),
        },
        actor,
      );
      void sheet;
      return did("assembly_measured", {
        createdRowIds: result.rows.map((row) => row.id),
        createdGeometryIds: result.geometries.map((geometry) => geometry.id),
      });
    }
    case "duplicate-row": {
      const rowId = await rowInSession(context, command.rowId);
      const copied = await duplicateRowIn(
        ctx,
        sessionId,
        rowId,
        {
          version: await version(rowId),
          ...(command.offset ? { offset: command.offset } : {}),
          ...(command.targetSheetId ? { targetSheetId: command.targetSheetId } : {}),
          ...(command.crossSheet ? { crossSheet: command.crossSheet } : {}),
        },
        actor,
      );
      return did("row_duplicated", {
        createdRowIds: [copied.newRowId],
        createdGeometryIds: copied.createdGeometryIds,
      });
    }
    case "merge-geometries": {
      // The shapes of the absorbed lines go down with them; the receipt names
      // them so the undo restores exactly those and no other tombstone.
      const merged = await mergeGeometriesIn(ctx, sessionId, { rowIds: command.rowIds }, actor);
      return did("merged", {
        deletedRowIds: merged.mergedRowIds,
        deletedGeometryIds: merged.absorbedGeometryIds,
        createdGeometryIds: merged.createdGeometryIds,
      });
    }
    case "reassign-geometry": {
      const moved = await reassignGeometryIn(ctx, sessionId, command.geometryId, { targetRowId: command.targetRowId }, actor);
      return did("reassigned", { deletedRowIds: moved.emptiedRowIds });
    }
  }
}
