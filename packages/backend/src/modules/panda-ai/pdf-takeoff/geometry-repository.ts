import type { Knex } from "knex";
import type { PreconGeometryRow } from "./types.ts";

export type PreconGeometryRepository = ReturnType<typeof preconGeometryRepository>;

type GeometryInsert = Omit<PreconGeometryRow, "created_at">;

export interface GeometryMeasurementPatch {
  vertices?: number[][];
  quantity?: number;
  unit?: string;
  definition?: unknown;
}

// pg takes jsonb as a string; `undefined` must stay undefined so the column keeps its default.
const forInsert = (r: GeometryInsert) => ({
  ...r,
  vertices: JSON.stringify(r.vertices) as never,
  definition: (r.definition == null ? r.definition : JSON.stringify(r.definition)) as never,
});

export function preconGeometryRepository(db: Knex) {
  return {
    insertGeometries: (rows: GeometryInsert[]) =>
      rows.length ? db<PreconGeometryRow>("precon_geometries").insert(rows.map(forInsert)) : Promise.resolve(),

    // The line's own measurement (never a deduction) and the definition that
    // records which tool made it — what a redraw has to be measured with.
    measurementGeometryForRow: (rowId: string) =>
      db<PreconGeometryRow>("precon_geometries")
        .where({ row_id: rowId })
        .whereNot({ kind: "deduction" })
        .orderBy("created_at", "desc")
        .first(),
    geometriesBySession: (sessionId: string) =>
      db<PreconGeometryRow>("precon_geometries")
        .whereIn("sheet_id", db("precon_sheets").select("id").where({ session_id: sessionId }))
        .whereNull("deleted_at")
        .orderBy("created_at", "asc"),
    // Every live annotation on one drawing, oldest first — what a re-calibration
    // has to restate, since the sheet's scale is what turned each into a figure.
    geometriesBySheet: (sheetId: string) =>
      db<PreconGeometryRow>("precon_geometries")
        .where({ sheet_id: sheetId })
        .whereNull("deleted_at")
        .orderBy("created_at", "asc"),
    geometriesByRow: (rowId: string) =>
      db<PreconGeometryRow>("precon_geometries").where({ row_id: rowId }).whereNull("deleted_at"),
    // Batched for the operations that restate several lines at once (a merge):
    // one query for every annotation they touch, never one query per line.
    geometriesByRows: (rowIds: string[]) =>
      rowIds.length
        ? db<PreconGeometryRow>("precon_geometries")
            .whereIn("row_id", rowIds)
            .whereNull("deleted_at")
            .orderBy("created_at", "asc")
        : Promise.resolve([]),
    geometryById: (id: string) =>
      db<PreconGeometryRow>("precon_geometries").where({ id }).whereNull("deleted_at").first(),
    // Tombstones included — what an undo has to read, since the shape it is
    // restoring is by definition one the active readers can no longer see.
    geometryByIdIncludeDeleted: (id: string) =>
      db<PreconGeometryRow>("precon_geometries").where({ id }).first(),
    // Tombstones included — for an undo, which has to find the annotations that
    // were withdrawn with their line. Never use it to draw a sheet.
    geometriesByRowIncludeDeleted: (rowId: string) =>
      db<PreconGeometryRow>("precon_geometries").where({ row_id: rowId }),

    // A line's annotations are withdrawn and restored with the line itself:
    // leaving them on the sheet would show a measurement the bill no longer has.
    softDeleteGeometriesForRow: (rowId: string, deletedAt: Date) =>
      db<PreconGeometryRow>("precon_geometries")
        .where({ row_id: rowId })
        .whereNull("deleted_at")
        .update({ deleted_at: deletedAt }),
    softRestoreGeometriesForRow: (rowId: string) =>
      db<PreconGeometryRow>("precon_geometries").where({ row_id: rowId }).update({ deleted_at: null }),
    // One named shape back. An undo restores what its own withdrawal took down,
    // never every tombstone the line has ever accumulated.
    softRestoreGeometry: (id: string) =>
      db<PreconGeometryRow>("precon_geometries").where({ id }).update({ deleted_at: null }),

    // One opening withdrawn from the line it was cut out of. Tombstoned rather
    // than deleted: the deduction was once claimed against the bill, so it has
    // to stay readable in a dispute — and its id is still named by the audit
    // entry that removed it.
    softDeleteGeometry: (id: string, deletedAt: Date) =>
      db<PreconGeometryRow>("precon_geometries")
        .where({ id })
        .whereNull("deleted_at")
        .update({ deleted_at: deletedAt }),

    // A void following the half of the outline it sits in after a split. The
    // void keeps its own id; only the outline it is an opening in changes.
    reparentGeometry: (id: string, parentGeometryId: string) =>
      db<PreconGeometryRow>("precon_geometries").where({ id }).update({ parent_geometry_id: parentGeometryId }),

    // The same drawing, billed against a different line. The shape and its id
    // are untouched: a reassignment changes who is billed for the measurement,
    // never what was measured, so the annotation an audit entry names survives.
    moveGeometryToRow: (id: string, rowId: string) =>
      db<PreconGeometryRow>("precon_geometries").where({ id }).whereNull("deleted_at").update({ row_id: rowId }),

    // A shape re-measured in place: a redrawn opening, or the same drawing
    // re-billed through a new height or depth. The id must survive the write —
    // `precon_boq_rows.deductions` names it, so minting a new one would orphan
    // the billed figure from the shape that justifies it.
    updateGeometryMeasurement: (id: string, patch: GeometryMeasurementPatch) =>
      db<PreconGeometryRow>("precon_geometries")
        .where({ id })
        .update({
          ...patch,
          vertices: (patch.vertices === undefined ? undefined : JSON.stringify(patch.vertices)) as never,
          definition: (patch.definition == null ? patch.definition : JSON.stringify(patch.definition)) as never,
        }),
    // Putting a recorded shape back exactly as it was, tombstone included. Used
    // only by a reversal, which knows the whole prior state from the audit entry
    // rather than deriving it — so it restores the id it withdrew, keeping every
    // reference to that shape (row.deductions, the audit trail) intact.
    restoreGeometryState: (
      id: string,
      state: {
        rowId: string;
        parentGeometryId: string | null;
        vertices: number[][];
        quantity: number | null;
        unit: string | null;
        definition: unknown;
        deleted_at: Date | null;
      },
    ) =>
      db<PreconGeometryRow>("precon_geometries")
        .where({ id })
        .update({
          // row_id included: undoing a reassignment means moving the shape back to
          // the line it was billed against, which is part of its recorded state.
          row_id: state.rowId,
          // parent included for the same reason: undoing a split has to point a
          // void back at the outline it was an opening in, not at the half that
          // the undo has just withdrawn.
          parent_geometry_id: state.parentGeometryId,
          vertices: JSON.stringify(state.vertices) as never,
          quantity: state.quantity,
          unit: state.unit,
          definition: (state.definition == null ? null : JSON.stringify(state.definition)) as never,
          deleted_at: state.deleted_at,
        }),

    replaceRowGeometry: async (rowId: string, geometry: GeometryInsert) => {
      await db("precon_geometries").where({ row_id: rowId, kind: geometry.kind, source: "manual" }).delete();
      await db<PreconGeometryRow>("precon_geometries").insert(forInsert(geometry));
    },
  };
}
