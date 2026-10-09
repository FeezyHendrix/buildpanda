// The shared rig for the cutout re-scale regressions.
//
// Two suites exercise the same world — one for the figures a re-scale must
// produce, one for what it must refuse — and they run against a real database.
// The rig lives here rather than being copied into both so that a fixture that
// drifts cannot make one suite pass while the other tests something subtly
// different.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Knex } from "knex";
import { preconAuditRepository } from "./audit-repository.ts";
import { calibrationPreviewService } from "./editor-calibration-preview.ts";
import { m, type EditorFixture } from "./editor-db-fixture.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import { editorReverseServiceWith } from "./editor-reverse-service.ts";
import { createOperationUnitOfWork } from "./editor-unit-of-work.ts";
import type { Deduction } from "./types.ts";

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};
const newOperationId = (): string => `op_${randomUUID()}`;

export interface RowFigures {
  gross: number;
  qty: number;
  deductions: Deduction[];
}

/** Metres → sheet points, then a closed rectangle of them. */
export const rect = (x: number, y: number, w: number, h: number): number[][] => [
  [m(x), m(y)],
  [m(x + w), m(y)],
  [m(x + w), m(y + h)],
  [m(x), m(y + h)],
];

export function cutoutRig(dbOf: () => Knex, fixture: () => EditorFixture) {
  const db = (): Knex => dbOf();
  const apply = (command: EditorCommand): Promise<OperationReceipt> =>
    editorOperationService(db(), noop).apply(
      fixture().sessionId,
      { operationId: newOperationId(), command },
      fixture().actor,
      GRANTS,
    );

  const rowOf = async (rowId: string): Promise<RowFigures> => {
    const row = await db()("precon_boq_rows").where({ id: rowId }).first();
    return {
      gross: Number(row?.["qty_gross"]),
      qty: Number(row?.["qty"]),
      deductions: (row?.["deductions"] ?? []) as Deduction[],
    };
  };

  return {
    apply,
    rowOf,

    preview: (): ReturnType<typeof calibrationPreviewService> => calibrationPreviewService(db()),

    async undo(eventId: string): Promise<void> {
      const undoer = editorReverseServiceWith(createOperationUnitOfWork(db(), noop), preconAuditRepository(db()));
      const outcome = await undoer.reverseOperation(
        fixture().sessionId,
        eventId,
        { operationId: newOperationId() },
        fixture().actor,
        GRANTS,
      );
      assert.equal(outcome.reversed, true, outcome.reversed === false ? outcome.reason : "");
    },

    cutOf: async (rowId: string, geometryId: string): Promise<Deduction | undefined> =>
      (await rowOf(rowId)).deductions.find((entry) => entry.geometryId === geometryId),

    geometryQty: async (id: string): Promise<number> =>
      Number((await db()("precon_geometries").where({ id }).first())?.["quantity"]),

    sheetVersion: async (id: string): Promise<number> =>
      Number((await db()("precon_sheets").where({ id }).first())?.["version"] ?? 1),

    async sheet(code: string, page: number, viewports?: unknown): Promise<string> {
      const id = `pcsh_${code}_${randomUUID().slice(0, 8)}`;
      await db()("precon_sheets").insert({
        id,
        session_id: fixture().sessionId,
        file_name: `${code}.pdf`,
        storage_path: `qa/${id}.pdf`,
        page_number: page,
        code: code.toUpperCase(),
        kind: "floor-plan",
        status: "measured",
        scale_mm_per_pt: 50,
        dim_unit: "mm",
        version: 1,
        ...(viewports === undefined ? {} : { viewports: JSON.stringify(viewports) }),
      });
      return id;
    },

    create: (sheetId: string, tool: string, vertices: number[][], extra: Record<string, unknown> = {}) =>
      apply({
        kind: "create-geometry",
        sheetId,
        tool,
        vertices,
        description: `${tool} ${randomUUID().slice(0, 6)}`,
        elementGroup: "Cutouts",
        ...extra,
      } as EditorCommand),

    cut: (rowId: string, label: string, body: Record<string, unknown>) =>
      apply({ kind: "add-deduction", rowId, label, ...body } as EditorCommand),
  };
}
