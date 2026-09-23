// Composition facade for the take-off service. The behaviour lives in
// domain-scoped siblings (session, row, geometry, programme, review, manual);
// this file owns the shared helpers they all need — the audit trail, the row
// lookup, the anchor recompute and the measurement sheet resolution — and
// spreads the slices into the one flat object every caller already uses.
import { NotFoundError, BadRequestError } from "../../../lib/errors.ts";
import { generateId } from "../../../lib/ids.ts";
import { DERIVED_BASIS_PATTERN, anchorsFromRows, evaluateFormula } from "./engine/enrich.ts";
import { assertAuditPayloadWithinCap, assertDerivedFanout, derivedRowsIn } from "./editor-limits.ts";
import type { PreconRepository } from "./repository.ts";
import type { PreconAuditEventRow, PreconBoqRowRow, PreconSheetRow, PreconSnapshot } from "./types.ts";
import { num, toGeometry, toRow, toSession, toSheet } from "./dto.ts";
import { programmeEditor } from "./programme-editor.ts";
import { geometryService } from "./geometry-service.ts";
import { programmeService } from "./programme-service.ts";
import { rowService } from "./row-service.ts";
import { sessionService } from "./session-service.ts";
import { reviewService } from "./review-service.ts";
import { manualService } from "./manual-service.ts";
import { noStaleLookup, type StaleLookup } from "./stale.ts";
import type { WorkbookChangeEvent } from "./workbook/types.ts";

export { computeSummary, quantityFromVertices, toBill, toGeometry, toProgrammeTask, toRow, toSession, toSheet } from "./dto.ts";
export { geometryService } from "./geometry-service.ts";
export { programmeService } from "./programme-service.ts";
export { rowService } from "./row-service.ts";
export { sessionService } from "./session-service.ts";

export interface RowChangeEvent {
  type:
    | "row.created"
    | "row.updated"
    | "row.verified"
    | "row.rejected"
    | "row.deleted"
    | "geometry.updated";
  sessionId: string;
  rowId: string;
  version: number;
  actor: string;
  changes: Record<string, unknown>;
}

/**
 * Everything published on a `precon:<sessionId>` channel, as a closed union.
 *
 * A workbook change is genuinely not row-shaped — it names a document version,
 * and names bill lines only when a rate or description moved — so it is a
 * second member here rather than a `RowChangeEvent` with invented `rowId` and
 * `changes` fields that no subscriber could trust.
 */
export type PreconChangeEvent = RowChangeEvent | WorkbookChangeEvent;

export type PublishFn = (sessionId: string, event: PreconChangeEvent) => void;

/**
 * What makes an audit entry reversible: the operation it belongs to, and — when
 * it is itself an undo — the entry it compensates for. Both stay null for the
 * ambient writes (recomputes, AI runs) nobody undoes by hand.
 */
export interface AuditIdentity {
  operationId?: string | null;
  reversesEventId?: string | null;
}

export function preconService(repo: PreconRepository, publish: PublishFn = () => {}, staleLookup: StaleLookup = noStaleLookup) {
  async function audit(
    sessionId: string,
    rowId: string | null,
    actor: string,
    action: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    identity: AuditIdentity = {},
  ): Promise<void> {
    assertAuditPayloadWithinCap(before, after);
    await repo.insertAuditEvent({
      id: generateId("pae"),
      session_id: sessionId,
      row_id: rowId,
      actor,
      action,
      before,
      after,
      operation_id: identity.operationId ?? null,
      reverses_event_id: identity.reversesEventId ?? null,
    } as Omit<PreconAuditEventRow, "created_at">);
  }

  const editor = programmeEditor(repo, audit);

  // Checked against the rows the recompute WOULD touch, before the edit that
  // triggers it is written: over the cap, nothing is written at all.
  async function assertDerivedFanoutWithinCap(sessionId: string): Promise<void> {
    assertDerivedFanout(derivedRowsIn(await repo.rowsBySession(sessionId)).length);
  }

  function isAnchorRow(row: PreconBoqRowRow): boolean {
    if (row.code === "F10/125" || row.code === "M10") return true;
    return (row.code === "L11" || row.code === "L20") && /type [WD]\d/i.test(row.description);
  }

  // Derived rows carry their formula in the measurement basis; when a QS
  // corrects a measured anchor, re-evaluate every formula so the build-up
  // follows the correction instead of the stale measurement.
  async function recomputeDerivedRows(sessionId: string, actor: string): Promise<void> {
    const rows = await repo.rowsBySession(sessionId);
    const anchors = anchorsFromRows(rows);
    for (const row of rows) {
      if (row.status === "rejected") continue;
      const match = row.measurement_basis?.match(DERIVED_BASIS_PATTERN);
      if (!match) continue;
      const value = evaluateFormula(match[1]!, anchors);
      if (value === null || Math.abs(value - Number(row.qty ?? 0)) < 0.005) continue;
      const amount = row.rate !== null ? Math.round(value * Number(row.rate) * 100) / 100 : null;
      const basis = `Derived: ${match[1]} = ${value} (engine-evaluated over measured anchors)`;
      const updated = await repo.applyDerivedRecompute(row.id, value, amount, basis);
      if (!updated) continue;
      await audit(sessionId, row.id, actor, "recomputed", { qty: num(row.qty) }, { qty: value });
      publish(sessionId, {
        type: "row.updated",
        sessionId,
        rowId: row.id,
        version: updated.version,
        actor,
        changes: { qty: value, amount },
      });
    }
  }

  // Falls back to the row's last-measured sheet, so never-measured rows stay
  // measurable. The id is caller-supplied, so it must be checked against the
  // session — otherwise one session could measure another's sheet.
  async function resolveMeasurementSheet(
    rowId: string,
    sessionId: string,
    sheetId?: string,
  ): Promise<PreconSheetRow> {
    const target = sheetId ?? (await repo.geometriesByRow(rowId))[0]?.sheet_id;
    if (!target) throw new BadRequestError("Open the sheet you want to measure on first");
    const sheet = await repo.sheetById(target);
    if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Sheet");
    // the scale is picked per drawing (a viewport or the sheet) by scaleAt
    return sheet;
  }

  async function requireRow(rowId: string): Promise<{ row: PreconBoqRowRow; sessionId: string }> {
    const [row, sessionId] = await Promise.all([repo.rowById(rowId), repo.sessionIdForRow(rowId)]);
    if (!row || !sessionId) throw new NotFoundError("BOQ row");
    return { row, sessionId };
  }

  // the manual path exports from the same snapshot review reads
  const snapshot = (sessionId: string): Promise<PreconSnapshot> => api.getSnapshot(sessionId);

  const api = {
    // The repository this service is bound to. A cross-domain composer (the
    // assembly measure) needs the SAME handle, or its writes land outside
    // whatever transaction this service is running in.
    boundRepository: repo,
    ...sessionService({ repo, audit, staleLookup }),

    ...reviewService({ repo, audit, toSession, toSheet }),
    ...manualService({ repo, audit, publish, toSession, toRow, toGeometry, snapshot }),

    ...rowService({ repo, audit, publish, requireRow, isAnchorRow, recomputeDerivedRows, assertDerivedFanoutWithinCap }),
    ...geometryService({
      repo,
      audit,
      publish,
      requireRow,
      resolveMeasurementSheet,
      isAnchorRow,
      recomputeDerivedRows,
      assertDerivedFanoutWithinCap,
    }),
    ...programmeService({ repo, audit, editor }),
  };
  return api;
}
