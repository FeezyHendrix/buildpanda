// Creation and geometry edits, each one run as a single unit of work.
//
// Every method here takes the session lock, does all of its writing through
// the transaction-bound context the lock hands out, and queues its realtime
// event for after the commit. The write logic itself lives in
// `editor-writers.ts`; this file is only the seam that puts it under the lock.

import type { Knex } from "knex";
import { NotFoundError } from "../../../lib/errors.ts";
import { duplicateGeometryIn } from "./editor-batch-copy.ts";
import { mergeGeometriesIn, reassignGeometryIn } from "./editor-batch-merge.ts";
import { removeSegmentIn, splitPolylineIn } from "./editor-batch-writers.ts";
import { previewCalibration, previewViewports } from "./editor-calibration-writers.ts";
import { editDepthIn, editHeightIn, editTypicalIn } from "./editor-parameter-writers.ts";
import {
  createEditorUnitOfWork,
  type BatchWriteContext,
  type CalibrationReadContext,
  type CalibrationWriteContext,
  type EditorWriteContext,
} from "./editor-unit-of-work.ts";
import { preconGeometryRepository } from "./geometry-repository.ts";
import { saveAndVerifyIn } from "./editor-row-writer.ts";
import { createMeasurementIn, updateGeometryIn } from "./editor-writers.ts";
import { preconRowRepository } from "./row-repository.ts";
import { preconSessionRepository } from "./session-repository.ts";
import { preconSheetRepository } from "./sheet-repository.ts";
import type { PublishFn } from "./service.ts";
import type {
  CalibrationPreview,
  CalibrationPreviewBody,
  CreateMeasurementBody,
  CreateMeasurementResult,
  DuplicateGeometryBody,
  DuplicateGeometryResult,
  EditDepthBody,
  EditHeightBody,
  EditTypicalBody,
  MergeGeometriesBody,
  MergeGeometriesResult,
  PreconBoqRowDto,
  ReassignGeometryBody,
  ReassignGeometryResult,
  RemoveSegmentBody,
  RemoveSegmentResult,
  SplitPolylineBody,
  SplitPolylineResult,
  UpdateGeometryBody,
  UpdateRowBody,
  ViewportPreview,
  ViewportPreviewBody,
} from "./types.ts";

export type SessionIdForRow = (rowId: string) => Promise<string | null>;
export type SessionIdForSheet = (sheetId: string) => Promise<string | null>;
export type SessionIdForGeometry = (geometryId: string) => Promise<string | null>;

/** The unit of work as these writers need it: a session lock around a narrow context. */
export type WithEditorWrite = <T>(sessionId: string, callback: (ctx: EditorWriteContext) => Promise<T>) => Promise<T>;

/** The same lock, widened for the two operations that restate a whole sheet. */
export type WithCalibrationWrite = <T>(
  sessionId: string,
  callback: (ctx: CalibrationWriteContext) => Promise<T>,
) => Promise<T>;

/** The same lock again, widened for the edits that restate several lines at once. */
export type WithBatchWrite = <T>(sessionId: string, callback: (ctx: BatchWriteContext) => Promise<T>) => Promise<T>;

export function editorServiceWith(withEditorWrite: WithEditorWrite, sessionIdForRow: SessionIdForRow) {
  async function sessionOf(rowId: string): Promise<string> {
    const sessionId = await sessionIdForRow(rowId);
    if (!sessionId) throw new NotFoundError("BOQ row");
    return sessionId;
  }

  return {
    createMeasurement(sessionId: string, body: CreateMeasurementBody, actor: string): Promise<CreateMeasurementResult> {
      return withEditorWrite(sessionId, (ctx) => createMeasurementIn(ctx, sessionId, body, actor));
    },

    async updateGeometry(rowId: string, body: UpdateGeometryBody, actor: string): Promise<PreconBoqRowDto> {
      const sessionId = await sessionOf(rowId);
      return withEditorWrite(sessionId, (ctx) => updateGeometryIn(ctx, sessionId, rowId, body, actor));
    },

    async editHeight(rowId: string, body: EditHeightBody, actor: string): Promise<PreconBoqRowDto> {
      const sessionId = await sessionOf(rowId);
      return withEditorWrite(sessionId, (ctx) => editHeightIn(ctx, sessionId, rowId, body, actor));
    },

    async editDepth(rowId: string, body: EditDepthBody, actor: string): Promise<PreconBoqRowDto> {
      const sessionId = await sessionOf(rowId);
      return withEditorWrite(sessionId, (ctx) => editDepthIn(ctx, sessionId, rowId, body, actor));
    },

    async editTypical(rowId: string, body: EditTypicalBody, actor: string): Promise<PreconBoqRowDto> {
      const sessionId = await sessionOf(rowId);
      return withEditorWrite(sessionId, (ctx) => editTypicalIn(ctx, sessionId, rowId, body, actor));
    },

    async saveAndVerify(rowId: string, body: UpdateRowBody, actor: string): Promise<PreconBoqRowDto> {
      const sessionId = await sessionOf(rowId);
      return withEditorWrite(sessionId, (ctx) => saveAndVerifyIn(ctx, sessionId, rowId, body, actor));
    },
  };
}

/**
 * The two sheet-level operations. Both are shown before they are committed —
 * `preview` reads on the pool and can write nothing, `apply*` runs every write
 * inside the one session lock — because re-scaling a drawing restates lines
 * nobody opened, and viewports decide which scale each of those lines uses.
 */
/**
 * The two calibration PREVIEWS. It holds no write method on purpose: a re-scale
 * and a region change both restate priced lines, so both go through the one
 * operation envelope that mints a receipt, not through a service a route can
 * call directly.
 */
export function calibrationServiceWith(read: CalibrationReadContext, sessionIdForSheet: SessionIdForSheet) {
  async function sessionOf(sheetId: string): Promise<string> {
    const sessionId = await sessionIdForSheet(sheetId);
    if (!sessionId) throw new NotFoundError("Sheet");
    return sessionId;
  }

  return {
    previewCalibration(sheetId: string, body: CalibrationPreviewBody): Promise<CalibrationPreview> {
      return previewCalibration(read, sheetId, body);
    },

    async previewViewports(sheetId: string, body: ViewportPreviewBody): Promise<ViewportPreview> {
      return previewViewports(read, await sessionOf(sheetId), sheetId, body);
    },


  };
}

/**
 * The edits that restructure the bill: a split, a trim, a copy, a merge and a
 * reassignment. A merge names its session outright because it belongs to no
 * single line; the rest resolve theirs from the row or drawing they start at.
 */
export function batchEditorServiceWith(
  withBatchWrite: WithBatchWrite,
  sessionIdForRow: SessionIdForRow,
  sessionIdForGeometry: SessionIdForGeometry,
) {
  async function sessionOfRow(rowId: string): Promise<string> {
    const sessionId = await sessionIdForRow(rowId);
    if (!sessionId) throw new NotFoundError("BOQ row");
    return sessionId;
  }

  return {
    async splitPolyline(rowId: string, body: SplitPolylineBody, actor: string): Promise<SplitPolylineResult> {
      const sessionId = await sessionOfRow(rowId);
      return withBatchWrite(sessionId, (ctx) => splitPolylineIn(ctx, sessionId, rowId, body, actor));
    },

    async removeSegment(
      rowId: string,
      segmentIndex: number,
      body: RemoveSegmentBody,
      actor: string,
    ): Promise<RemoveSegmentResult> {
      const sessionId = await sessionOfRow(rowId);
      return withBatchWrite(sessionId, (ctx) => removeSegmentIn(ctx, sessionId, rowId, segmentIndex, body, actor));
    },

    async duplicateGeometry(
      rowId: string,
      body: DuplicateGeometryBody,
      actor: string,
    ): Promise<DuplicateGeometryResult> {
      const sessionId = await sessionOfRow(rowId);
      return withBatchWrite(sessionId, (ctx) => duplicateGeometryIn(ctx, sessionId, rowId, body, actor));
    },

    mergeGeometries(sessionId: string, body: MergeGeometriesBody, actor: string): Promise<MergeGeometriesResult> {
      return withBatchWrite(sessionId, (ctx) => mergeGeometriesIn(ctx, sessionId, body, actor));
    },

    async reassignGeometry(
      geometryId: string,
      body: ReassignGeometryBody,
      actor: string,
    ): Promise<ReassignGeometryResult> {
      const sessionId = await sessionIdForGeometry(geometryId);
      if (!sessionId) throw new NotFoundError("Geometry");
      return withBatchWrite(sessionId, (ctx) => reassignGeometryIn(ctx, sessionId, geometryId, body, actor));
    },
  };
}

export function editorService(db: Knex, publish: PublishFn) {
  const withSessionWrite = createEditorUnitOfWork(db, publish);
  const rows = preconRowRepository(db);
  const withEditorWrite: WithEditorWrite = (sessionId, callback) =>
    withSessionWrite(sessionId, (ctx) => callback({ ...ctx, bills: preconSessionRepository(ctx.trx) }));
  // The row→session lookup is a read on the pool, and it has to precede the
  // lock: the lock is taken on the session it resolves to.
  return editorServiceWith(withEditorWrite, (rowId) => rows.sessionIdForRow(rowId));
}

export function batchEditorService(db: Knex, publish: PublishFn) {
  const withSessionWrite = createEditorUnitOfWork(db, publish);
  const rows = preconRowRepository(db);
  const geometries = preconGeometryRepository(db);
  const withBatchWrite: WithBatchWrite = (sessionId, callback) =>
    withSessionWrite(sessionId, (ctx) => callback({ ...ctx, bills: preconSessionRepository(ctx.trx) }));
  return batchEditorServiceWith(
    withBatchWrite,
    (rowId) => rows.sessionIdForRow(rowId),
    async (geometryId) => {
      const geometry = await geometries.geometryById(geometryId);
      return geometry ? rows.sessionIdForRow(geometry.row_id) : null;
    },
  );
}

export function calibrationService(db: Knex) {
  const sheets = preconSheetRepository(db);
  const read: CalibrationReadContext = {
    sheets,
    geometries: preconGeometryRepository(db),
    rows: preconRowRepository(db),
  };
  return calibrationServiceWith(read, async (sheetId) => {
    const sheet = await sheets.sheetById(sheetId);
    return sheet?.session_id ?? null;
  });
}
