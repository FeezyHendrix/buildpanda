import type { Knex } from "knex";
import type { PreconBoqRowRow, RowStatus } from "./types.ts";

export type PreconRowRepository = ReturnType<typeof preconRowRepository>;

export function preconRowRepository(db: Knex) {
  return {
    nextRowSort: async (billId: string): Promise<number> => {
      const row = await db("precon_boq_rows")
        .where({ bill_id: billId })
        .max<{ max: number | null }[]>("sort as max")
        .first();
      return (row?.max ?? -1) + 1;
    },
    insertBoqRows: async (rows: Omit<PreconBoqRowRow, "created_at" | "updated_at">[]) => {
      // chunked: a generated BOQ can be several hundred rows
      for (let i = 0; i < rows.length; i += 200) {
        await db<PreconBoqRowRow>("precon_boq_rows").insert(
          rows.slice(i, i + 200).map((r) => ({
            ...r,
            deductions: JSON.stringify(r.deductions) as never,
            evidence: (r.evidence ? JSON.stringify(r.evidence) : null) as never,
            measurement_settings: (r.measurement_settings == null
              ? r.measurement_settings
              : JSON.stringify(r.measurement_settings)) as never,
          })),
        );
      }
    },
    insertBoqRow: async (row: Omit<PreconBoqRowRow, "created_at" | "updated_at">) => {
      const [inserted] = await db<PreconBoqRowRow>("precon_boq_rows")
        .insert({
          ...row,
          deductions: JSON.stringify(row.deductions) as never,
          measurement_settings: (row.measurement_settings == null
            ? row.measurement_settings
            : JSON.stringify(row.measurement_settings)) as never,
        })
        .returning("*");
      return inserted!;
    },
    deleteRow: (id: string) => db("precon_boq_rows").where({ id }).delete(),
    deleteRows: (ids: string[]) => (ids.length ? db("precon_boq_rows").whereIn("id", ids).delete() : Promise.resolve(0)),
    /**
     * The engine's unverified lines whose only evidence is this sheet — what a
     * re-measure replaces. A line also drawn on another sheet is left alone.
     *
     * `status` alone does not say whether a person has been here: correcting a
     * quantity leaves the line `needs_review`, which is also where the engine
     * puts its own low-confidence drafts. So the edit stamp is checked too, and
     * a withdrawn line is excluded — deleting a tombstone would let the next
     * draft reintroduce a line somebody deliberately took off the bill.
     */
    aiRowIdsOnSheet: async (sheetId: string): Promise<string[]> => {
      const onSheet = await db("precon_boq_rows as r")
        .join("precon_geometries as g", "g.row_id", "r.id")
        .where("g.sheet_id", sheetId)
        .andWhere("r.origin", "ai")
        .andWhereNot("r.status", "verified")
        .whereNull("r.edited_at")
        .whereNull("r.deleted_at")
        .distinct<{ id: string }[]>("r.id");
      const ids = onSheet.map((r) => r.id);
      if (ids.length === 0) return [];
      const elsewhere = await db("precon_geometries")
        .whereIn("row_id", ids)
        .andWhereNot("sheet_id", sheetId)
        .distinct<{ row_id: string }[]>("row_id");
      const keep = new Set(elsewhere.map((e) => e.row_id));
      return ids.filter((id) => !keep.has(id));
    },
    /**
     * Lines somebody has left their own evidence on, whatever the line's own
     * origin says.
     *
     * A re-run judges a line by `origin`/`status`, which only sees what was
     * done TO the line. Two things are done BESIDE it and are just as much a
     * person's work: an opening cut by hand out of a drafted wall (the
     * geometry is `manual`, the line is still `ai_generated`), and a redline
     * pinned to it. Deleting the line takes the opening with it through the
     * CASCADE, and detaches the pin through the `SET NULL` — so the question a
     * QS asked about that figure is left floating on the sheet with no figure.
     */
    rowIdsWithManualEvidence: async (sessionId: string): Promise<string[]> => {
      const inSession = db("precon_boq_rows")
        .select("id")
        .whereIn("bill_id", db("precon_bills").select("id").where({ session_id: sessionId }));
      const [drawn, pinned] = await Promise.all([
        db("precon_geometries")
          .whereIn("row_id", inSession.clone())
          .andWhere("source", "manual")
          .whereNull("deleted_at")
          .distinct<{ row_id: string }[]>("row_id"),
        db("drawing_markups")
          .where({ precon_session_id: sessionId })
          .whereNotNull("precon_row_id")
          .whereNull("deleted_at")
          .distinct<{ precon_row_id: string }[]>("precon_row_id"),
      ]);
      return [
        ...new Set([...drawn.map((g) => g.row_id), ...pinned.map((m) => m.precon_row_id)]),
      ];
    },
    // Active readers only: a withdrawn line is still on the table for the audit
    // trail, but it is no longer part of the bill anyone is pricing.
    rowsBySession: (sessionId: string) =>
      db<PreconBoqRowRow>("precon_boq_rows")
        .whereIn("bill_id", db("precon_bills").select("id").where({ session_id: sessionId }))
        .whereNull("deleted_at")
        .orderBy("sort", "asc"),
    rowById: (id: string) => db<PreconBoqRowRow>("precon_boq_rows").where({ id }).whereNull("deleted_at").first(),
    // Batched so a sheet-wide recompute reads its lines in one query, never one
    // per annotation; withdrawn lines stay out, they are no longer being priced.
    rowsByIds: (ids: string[]) =>
      ids.length
        ? db<PreconBoqRowRow>("precon_boq_rows").whereIn("id", ids).whereNull("deleted_at")
        : Promise.resolve([]),
    // The tombstone itself — what an undo has to find, and the only read that
    // may see a withdrawn line. Never use it to serve a bill.
    rowByIdIncludeDeleted: (id: string) => db<PreconBoqRowRow>("precon_boq_rows").where({ id }).first(),
    // Tombstones included: an undo names the very row it withdrew.
    rowVersionsByIds: (ids: string[]): Promise<{ id: string; version: number }[]> =>
      ids.length
        ? db<PreconBoqRowRow>("precon_boq_rows").whereIn("id", ids).select("id", "version")
        : Promise.resolve([]),

    // Withdrawing a line hides it without erasing it: a quantity that was once
    // claimed stays recoverable and stays defensible in a dispute.
    softDeleteRow: async (id: string, deletedAt: Date): Promise<PreconBoqRowRow | null> => {
      const rows = await db<PreconBoqRowRow>("precon_boq_rows")
        .where({ id })
        .whereNull("deleted_at")
        .update({ deleted_at: deletedAt, updated_at: db.fn.now() }, "*");
      return (rows as PreconBoqRowRow[])[0] ?? null;
    },
    softRestoreRow: async (id: string): Promise<PreconBoqRowRow | null> => {
      const rows = await db<PreconBoqRowRow>("precon_boq_rows")
        .where({ id })
        .update({ deleted_at: null, updated_at: db.fn.now() }, "*");
      return (rows as PreconBoqRowRow[])[0] ?? null;
    },
    sessionIdForRow: async (rowId: string): Promise<string | null> => {
      const row = await db("precon_boq_rows")
        .join("precon_bills", "precon_bills.id", "precon_boq_rows.bill_id")
        .where("precon_boq_rows.id", rowId)
        .select<{ session_id: string }>("precon_bills.session_id")
        .first();
      return row?.session_id ?? null;
    },
    // optimistic concurrency: returns updated row or null on version miss
    updateRowVersioned: async (
      id: string,
      version: number,
      patch: Partial<
        Pick<
          PreconBoqRowRow,
          | "description"
          | "unit"
          | "qty_gross"
          | "deductions"
          | "typical"
          | "qty"
          | "rate"
          | "amount"
          | "rate_source"
          | "status"
          | "measurement_basis"
          | "measurement_settings"
          | "verified_by"
          | "verified_at"
          | "edited_at"
          | "edited_by"
        >
      >,
      trx?: Knex.Transaction,
    ): Promise<PreconBoqRowRow | null> => {
      const q = (trx ?? db)<PreconBoqRowRow>("precon_boq_rows")
        .where({ id, version })
        .update(
          {
            ...patch,
            deductions: patch.deductions === undefined ? undefined : (JSON.stringify(patch.deductions) as never),
            measurement_settings:
              patch.measurement_settings === undefined
                ? undefined
                : patch.measurement_settings === null
                  ? null
                  : (JSON.stringify(patch.measurement_settings) as never),
            version: (trx ?? db).raw("version + 1") as never,
            updated_at: (trx ?? db).fn.now(),
          },
          "*",
        );
      const rows = await q;
      return (rows as PreconBoqRowRow[])[0] ?? null;
    },

    // Engine-driven recompute of a derived row after an anchor edit: no client
    // version involved, so bump the version unconditionally.
    applyDerivedRecompute: async (
      id: string,
      qty: number,
      amount: number | null,
      measurementBasis: string,
    ): Promise<PreconBoqRowRow | null> => {
      const rows = await db<PreconBoqRowRow>("precon_boq_rows")
        .where({ id })
        .update(
          {
            qty_gross: qty,
            qty,
            amount,
            measurement_basis: measurementBasis,
            version: db.raw("version + 1") as never,
            updated_at: db.fn.now(),
          },
          "*",
        );
      return (rows as PreconBoqRowRow[])[0] ?? null;
    },

    // counts for review progress
    rowStatusCounts: async (sessionId: string): Promise<{ status: RowStatus | null; count: number }[]> => {
      const rows = (await db("precon_boq_rows")
        .whereIn("bill_id", db("precon_bills").select("id").where({ session_id: sessionId }))
        .whereIn("row_type", ["item", "provisional_sum"])
        .whereNull("deleted_at")
        .groupBy("status")
        .select("status")
        .count("* as count")) as unknown as { status: RowStatus | null; count: string }[];
      return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
    },

    updateRowPricing: (id: string, patch: { rate: number; amount: number | null; rate_source: string }) =>
      db<PreconBoqRowRow>("precon_boq_rows").where({ id }).update({ ...patch, updated_at: db.fn.now() }),
  };
}
