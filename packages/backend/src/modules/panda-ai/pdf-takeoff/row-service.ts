import { generateId } from "../../../lib/ids.ts";
import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import type { PreconRepository } from "./repository.ts";
import { num, toRow } from "./dto.ts";
import { buildRowUpdatePatch } from "./row-patch.ts";
import type { CreateRowBody, PreconBoqRowDto, PreconBoqRowRow, UpdateRowBody } from "./types.ts";
import type { AuditIdentity, PublishFn } from "./service.ts";

type Audit = (
  sessionId: string,
  rowId: string | null,
  actor: string,
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  identity?: AuditIdentity,
) => Promise<void>;

interface Deps {
  repo: PreconRepository;
  audit: Audit;
  publish: PublishFn;
  requireRow: (rowId: string) => Promise<{ row: PreconBoqRowRow; sessionId: string }>;
  isAnchorRow: (row: PreconBoqRowRow) => boolean;
  recomputeDerivedRows: (sessionId: string, actor: string) => Promise<void>;
  assertDerivedFanoutWithinCap: (sessionId: string) => Promise<void>;
}

/**
 * Writes to a single bill line: created by hand, edited, verified, rejected
 * or deleted. Split from the main service so each file stays readable; the
 * main service spreads these in.
 */
export function rowService({
  repo,
  audit,
  publish,
  requireRow,
  isAnchorRow,
  recomputeDerivedRows,
  assertDerivedFanoutWithinCap,
}: Deps) {
  /**
   * The shape ids the line's most recent withdrawal tombstoned. `null` when the
   * withdrawal predates the record (older tombstones carry no list), in which
   * case the caller falls back to restoring the whole line's shapes — the old
   * behaviour, kept only for those.
   */
  async function tombstonedByWithdrawal(rowId: string): Promise<string[] | null> {
    const events = await repo.auditEventsForRow(rowId);
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i]!;
      if (event.action !== "soft_deleted") continue;
      const ids = (event.before as { tombstonedGeometryIds?: unknown } | null)?.tombstonedGeometryIds;
      return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : null;
    }
    return null;
  }

  return {
    // Authored by a person, so it needs no AI review: it lands verified, and
    // its rate is manual rather than sourced from a rate card.
    async createRow(billId: string, body: CreateRowBody, actor: string): Promise<PreconBoqRowDto> {
      const bill = await repo.billById(billId);
      if (!bill) throw new NotFoundError("Bill");
      const rowType = body.rowType ?? "item";
      const priced = rowType === "item" || rowType === "provisional_sum";
      if (!priced && (body.qty !== undefined || body.rate !== undefined)) {
        throw new BadRequestError("Only priced rows carry quantities");
      }
      const qty = priced ? (body.qty ?? null) : null;
      const rate = priced ? (body.rate ?? null) : null;
      const row = await repo.insertBoqRow({
        id: generateId("pbr"),
        bill_id: billId,
        sort: await repo.nextRowSort(billId),
        row_type: rowType,
        element_group: body.elementGroup ?? null,
        code: body.code ?? null,
        description: body.description,
        unit: priced ? (body.unit ?? null) : null,
        qty_gross: qty,
        deductions: [],
        qty,
        rate,
        amount: qty !== null && rate !== null ? Math.round(qty * rate * 100) / 100 : null,
        rate_source: rate === null ? null : "manual",
        confidence: null,
        status: priced ? "verified" : null,
        version: 1,
        measurement_basis: priced ? "Entered manually" : null,
        confidence_reason: null,
        provenance: priced ? "Entered by hand in review" : null,
        origin: "manual",
        edited_at: null,
        edited_by: null,
        verified_by: priced ? actor : null,
        verified_at: priced ? new Date() : null,
      });
      await audit(bill.session_id, row.id, actor, "created", null, {
        description: body.description,
        qty,
        rate,
      });
      publish(bill.session_id, {
        type: "row.created",
        sessionId: bill.session_id,
        rowId: row.id,
        version: row.version,
        actor,
        changes: { billId, description: body.description, qty, rate },
      });
      return toRow(row);
    },

    // A withdrawal, not an erasure. A line that was once claimed is evidence in
    // a dispute even after the QS takes it off the bill, so it is tombstoned
    // and stays recoverable; `rejectRow` is the different act of keeping an AI
    // proposal visible as declined. The row's annotations go with it, or the
    // sheet would still show a measurement the bill no longer has.
    async removeRow(rowId: string, actor: string, identity: AuditIdentity = {}): Promise<{ ok: true }> {
      const { row, sessionId } = await requireRow(rowId);
      const deletedAt = new Date();
      // Exactly which shapes THIS withdrawal tombstones, so the undo restores
      // those and only those. Restoring by row id would resurrect shapes that a
      // different, earlier operation withdrew and nobody asked to bring back.
      const tombstoned = (await repo.geometriesByRow(rowId)).map((geometry) => geometry.id);
      await repo.softDeleteRow(rowId, deletedAt);
      await repo.softDeleteGeometriesForRow(rowId, deletedAt);
      await audit(sessionId, rowId, actor, "soft_deleted", { ...toRow(row), tombstonedGeometryIds: tombstoned }, null, {
        operationId: identity.operationId ?? generateId("pop"),
        reversesEventId: identity.reversesEventId ?? null,
      });
      publish(sessionId, {
        type: "row.deleted",
        sessionId,
        rowId,
        version: row.version,
        actor,
        changes: {},
      });
      return { ok: true };
    },

    // The compensating half of `removeRow`, reached through the reverse
    // endpoint. It reads the tombstone rather than the active row, which the
    // active readers can no longer see.
    async restoreRow(rowId: string, actor: string, identity: AuditIdentity = {}): Promise<PreconBoqRowDto> {
      const [existing, sessionId] = await Promise.all([repo.rowByIdIncludeDeleted(rowId), repo.sessionIdForRow(rowId)]);
      if (!existing || !sessionId) throw new NotFoundError("BOQ row");
      if (!existing.deleted_at) return toRow(existing);
      const restored = await repo.softRestoreRow(rowId);
      if (!restored) throw new NotFoundError("BOQ row");
      // Only the shapes the withdrawal itself took down. The list is read back
      // from that withdrawal's own audit entry, so a shape deleted separately
      // beforehand stays deleted.
      const tombstoned = await tombstonedByWithdrawal(rowId);
      if (tombstoned === null) await repo.softRestoreGeometriesForRow(rowId);
      else for (const geometryId of tombstoned) await repo.softRestoreGeometry(geometryId);
      await audit(sessionId, rowId, actor, "restored", null, { ...toRow(restored) }, identity);
      publish(sessionId, {
        type: "row.updated",
        sessionId,
        rowId,
        version: restored.version,
        actor,
        changes: { restored: true },
      });
      return toRow(restored);
    },

    async updateRow(rowId: string, body: UpdateRowBody, actor: string): Promise<PreconBoqRowDto> {
      const { row, sessionId } = await requireRow(rowId);
      const { patch, noOp } = buildRowUpdatePatch(row, body.changes, actor);
      // A save that moves nothing writes nothing. Bumping the version would
      // invalidate every other editor's in-flight save for no reason, and
      // re-stamping edited_at would misreport when the line last changed.
      if (noOp) {
        if (Number(row.version) !== body.version) {
          throw new ConflictError(`Row was updated by someone else (current version ${row.version}); refresh and reapply`);
        }
        return toRow(row);
      }
      // bound the fanout before the first write, so an over-large bill is
      // refused outright rather than left half-recomputed
      if (body.changes.qty !== undefined && isAnchorRow(row)) await assertDerivedFanoutWithinCap(sessionId);
      const updated = await repo.updateRowVersioned(rowId, body.version, patch);
      if (!updated) {
        const current = await repo.rowById(rowId);
        throw new ConflictError(
          `Row was updated by someone else (current version ${current?.version ?? "?"}); refresh and reapply`,
        );
      }
      await audit(sessionId, rowId, actor, "adjusted", { qty: num(row.qty), rate: num(row.rate) }, body.changes);
      publish(sessionId, {
        type: "row.updated",
        sessionId,
        rowId,
        version: updated.version,
        actor,
        changes: body.changes,
      });
      if (body.changes.qty !== undefined && isAnchorRow(updated)) {
        await recomputeDerivedRows(sessionId, actor);
      }
      return toRow(updated);
    },

    async verifyRow(rowId: string, version: number, actor: string): Promise<PreconBoqRowDto> {
      const { row, sessionId } = await requireRow(rowId);
      if (row.status === "verified") {
        // Re-verifying is only a no-op when it is the SAME figure being signed
        // off twice. If someone edited in between, the caller is approving a
        // row it never saw, so the stale version has to be refused here — the
        // write below, which would have caught it, never runs.
        if (Number(row.version) !== version) {
          throw new ConflictError(
            `Row was updated by someone else (current version ${row.version}); refresh and re-verify`,
          );
        }
        return toRow(row);
      }
      if (row.status === null) throw new BadRequestError("Row is not a reviewable item");
      const updated = await repo.updateRowVersioned(rowId, version, {
        status: "verified",
        verified_by: actor,
        verified_at: new Date(),
      });
      if (!updated) throw new ConflictError("Row changed since you loaded it; refresh and re-verify");
      await audit(sessionId, rowId, actor, "verified", { status: row.status }, { status: "verified" });
      publish(sessionId, {
        type: "row.verified",
        sessionId,
        rowId,
        version: updated.version,
        actor,
        changes: { status: "verified" },
      });
      return toRow(updated);
    },

    async rejectRow(rowId: string, version: number, actor: string): Promise<PreconBoqRowDto> {
      const { row, sessionId } = await requireRow(rowId);
      if (row.status === null) throw new BadRequestError("Row is not a reviewable item");
      const updated = await repo.updateRowVersioned(rowId, version, {
        status: "rejected",
        verified_by: actor,
        verified_at: new Date(),
      });
      if (!updated) throw new ConflictError("Row changed since you loaded it; refresh and retry");
      await audit(sessionId, rowId, actor, "rejected", { status: row.status }, { status: "rejected" });
      publish(sessionId, {
        type: "row.rejected",
        sessionId,
        rowId,
        version: updated.version,
        actor,
        changes: { status: "rejected" },
      });
      return toRow(updated);
    },
  };
}
