// What Panda AI may read of a take-off, as SQL.
//
// Split out of `agent/repository.ts` because that file had grown past the point
// where another domain could honestly be appended to it. The composition is
// unchanged: `agentRepository` spreads this in, so every existing caller keeps
// the method it already calls.
//
// Both queries carry the same two guarantees, stated in the SQL rather than
// left to the caller:
//
//   * They reach the project through `bill → session → session.project_id`, so
//     a line measured on another project cannot appear in this one's answer.
//   * They exclude tombstones. A withdrawn line and a withdrawn drawing are
//     kept for the audit trail and are not part of what the bill claims today.

import type { Knex } from "knex";

export interface PreconBoqQueryRow {
  id: string;
  session_id: string;
  session_title: string | null;
  session_status: string | null;
  /** nth measurement of this drawing with this scope — the take-off's revision. */
  session_revision: number | null;
  /** Set when a later revision replaced this take-off. */
  session_superseded_by: string | null;
  element_group: string | null;
  code: string | null;
  description: string;
  qty: string | number | null;
  qty_gross: string | number | null;
  unit: string | null;
  rate: string | number | null;
  amount: string | number | null;
  status: string | null;
  confidence: string | null;
  measurement_basis: string | null;
  deductions: unknown;
  typical: unknown;
  measurement_settings: unknown;
}

/** One live drawing of a priced line, and the basis it recorded. */
export interface PreconBoqShapeRow {
  id: string;
  row_id: string;
  kind: string;
  source: string;
  definition: unknown;
}

/**
 * A take-off of THIS project that has a saved workbook.
 *
 * Deliberately carries no workbook content. What a cell means is the workbook
 * module's to say, and letting a second module read `precon_workbooks.snapshot`
 * is how a stale figure ends up quoted somewhere that does not know it is one.
 */
export interface PreconWorkbookSessionRow {
  session_id: string;
  session_title: string | null;
  session_revision: number | null;
  session_superseded_by: string | null;
}

const livePricedRows = (db: Knex, projectId: string): Knex.QueryBuilder =>
  db("precon_boq_rows as row")
    .join("precon_bills as bill", "bill.id", "row.bill_id")
    .join("precon_sessions as session", "session.id", "bill.session_id")
    .where("session.project_id", projectId)
    .whereIn("row.row_type", ["item", "provisional_sum"])
    .whereNull("row.deleted_at")
    .where((q) => q.whereNot("row.status", "rejected").orWhereNull("row.status"));

export function takeoffAgentRepository(db: Knex) {
  return {
    preconBoqRows(projectId: string): Promise<PreconBoqQueryRow[]> {
      return livePricedRows(db, projectId)
        .orderBy([
          { column: "session.created_at", order: "asc" },
          { column: "row.sort", order: "asc" },
        ])
        .select<PreconBoqQueryRow[]>(
          "row.id",
          "session.id as session_id",
          "session.title as session_title",
          "session.status as session_status",
          "session.revision as session_revision",
          "session.superseded_by as session_superseded_by",
          "row.element_group",
          "row.code",
          "row.description",
          "row.qty",
          "row.qty_gross",
          "row.unit",
          "row.rate",
          "row.amount",
          "row.status",
          "row.confidence",
          "row.measurement_basis",
          "row.deductions",
          "row.typical",
          "row.measurement_settings",
        );
    },

    /**
     * Every live drawing on those lines — the outlines that measure them and
     * the openings cut out of them — newest first within a line.
     *
     * The read used to be a `DISTINCT ON (row_id)` join that kept one drawing
     * per line, which is the right choice for "which tool made this" and the
     * wrong one for "at what scale". A line measured across two viewports, or
     * re-measured after a re-calibration, holds two scales; reporting whichever
     * drawing happened to be newest states one of them as the basis and
     * silently drops the other. It also had no room for the openings, whose
     * mode and typed dimensions live on their OWN definitions and nowhere else.
     * So every drawing comes back and the mapper does the sorting.
     */
    preconBoqShapes(projectId: string): Promise<PreconBoqShapeRow[]> {
      return livePricedRows(db, projectId)
        .join("precon_geometries as geo", "geo.row_id", "row.id")
        .whereNull("geo.deleted_at")
        .orderBy([
          { column: "geo.row_id", order: "asc" },
          { column: "geo.created_at", order: "desc" },
          { column: "geo.id", order: "desc" },
        ])
        .select<PreconBoqShapeRow[]>("geo.id", "geo.row_id", "geo.kind", "geo.source", "geo.definition");
    },

    /**
     * The take-offs of this project that have a saved workbook, oldest first.
     *
     * Reached through `workbook -> session -> session.project_id`, the same
     * scoping the two reads above use: a workbook belonging to another
     * project — or to another organisation — cannot appear here, and no caller
     * can widen that by passing an id, because there is no id to pass.
     *
     * `limit` is asked for one higher than the caller intends to report, so
     * "there are more" is a fact read from the database rather than guessed.
     */
    preconWorkbookSessions(projectId: string, limit: number): Promise<PreconWorkbookSessionRow[]> {
      return db("precon_workbooks as wb")
        .join("precon_sessions as session", "session.id", "wb.session_id")
        .where("session.project_id", projectId)
        .orderBy([
          { column: "session.created_at", order: "asc" },
          { column: "session.id", order: "asc" },
        ])
        .limit(limit)
        .select<PreconWorkbookSessionRow[]>(
          "wb.session_id",
          "session.title as session_title",
          "session.revision as session_revision",
          "session.superseded_by as session_superseded_by",
        );
    },
  };
}

export type TakeoffAgentRepository = ReturnType<typeof takeoffAgentRepository>;
