import type { Knex } from "knex";
import type {
  PreconAuditEventRow,
  PreconRateCardRow,
  PreconRateRow,
  PreconBillRow,
  PreconBoqRowRow,
  PreconGeometryRow,
  PreconSessionRow,
  PreconSheetRow,
  PreconSummarySettingsRow,
  RowStatus,
  SessionStatus,
  SheetStatus,
  StructureContext,
} from "./types.ts";

export type PreconRepository = ReturnType<typeof preconRepository>;

export function preconRepository(db: Knex) {
  return {
    // sessions
    insertSession: async (row: Omit<PreconSessionRow, "created_at" | "updated_at" | "structure_context">) => {
      const [inserted] = await db<PreconSessionRow>("precon_sessions").insert(row).returning("*");
      return inserted!;
    },
    sessionById: (id: string) => db<PreconSessionRow>("precon_sessions").where({ id }).first(),
    sessionsByOrg: (orgId: string, proposalId?: string) =>
      db<PreconSessionRow>("precon_sessions")
        .where({ org_id: orgId })
        .modify((q) => {
          if (proposalId) q.where({ proposal_id: proposalId });
        })
        .orderBy("created_at", "desc"),
    linkSessionToProposal: (sessionId: string, proposalId: string) =>
      db<PreconSessionRow>("precon_sessions")
        .where({ id: sessionId })
        .update({ proposal_id: proposalId, updated_at: db.fn.now() }),
    updateSessionStatus: (id: string, status: SessionStatus, error?: string | null) =>
      db<PreconSessionRow>("precon_sessions")
        .where({ id })
        .update({ status, error: error ?? null, updated_at: db.fn.now() }),

    updateSessionStructure: (id: string, structure: StructureContext) =>
      db<PreconSessionRow>("precon_sessions")
        .where({ id })
        .update({ structure_context: db.raw("?::jsonb", [JSON.stringify(structure)]), updated_at: db.fn.now() }),

    // sheets
    insertSheets: (rows: Omit<PreconSheetRow, "created_at" | "updated_at">[]) =>
      rows.length ? db<PreconSheetRow>("precon_sheets").insert(rows) : Promise.resolve(),
    sheetsBySession: (sessionId: string) =>
      db<PreconSheetRow>("precon_sheets").where({ session_id: sessionId }).orderBy("page_number", "asc"),
    sheetById: (id: string) => db<PreconSheetRow>("precon_sheets").where({ id }).first(),
    updateSheet: (
      id: string,
      patch: Partial<
        Pick<
          PreconSheetRow,
          | "code"
          | "title"
          | "kind"
          | "status"
          | "page_number"
          | "scale_mm_per_pt"
          | "scale_confidence"
          | "dim_unit"
          | "snap_index"
          | "error"
        >
      >,
    ) =>
      db<PreconSheetRow>("precon_sheets")
        .where({ id })
        .update({
          ...patch,
          snap_index: patch.snap_index === undefined ? undefined : (JSON.stringify(patch.snap_index) as never),
          updated_at: db.fn.now(),
        }),
    updateSheetStatus: (id: string, status: SheetStatus, error?: string | null) =>
      db<PreconSheetRow>("precon_sheets").where({ id }).update({ status, error: error ?? null, updated_at: db.fn.now() }),

    // bills + rows
    insertBills: (rows: Omit<PreconBillRow, "created_at">[]) =>
      rows.length ? db<PreconBillRow>("precon_bills").insert(rows) : Promise.resolve(),
    billsBySession: (sessionId: string) =>
      db<PreconBillRow>("precon_bills").where({ session_id: sessionId }).orderBy("sort", "asc"),
    insertBoqRows: async (rows: Omit<PreconBoqRowRow, "created_at" | "updated_at">[]) => {
      // chunked: a generated BOQ can be several hundred rows
      for (let i = 0; i < rows.length; i += 200) {
        await db<PreconBoqRowRow>("precon_boq_rows").insert(
          rows.slice(i, i + 200).map((r) => ({ ...r, deductions: JSON.stringify(r.deductions) as never })),
        );
      }
    },
    rowsBySession: (sessionId: string) =>
      db<PreconBoqRowRow>("precon_boq_rows")
        .whereIn("bill_id", db("precon_bills").select("id").where({ session_id: sessionId }))
        .orderBy("sort", "asc"),
    rowById: (id: string) => db<PreconBoqRowRow>("precon_boq_rows").where({ id }).first(),
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
          | "qty"
          | "rate"
          | "amount"
          | "rate_source"
          | "status"
          | "measurement_basis"
          | "verified_by"
          | "verified_at"
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

    // geometries
    insertGeometries: (rows: Omit<PreconGeometryRow, "created_at">[]) =>
      rows.length
        ? db<PreconGeometryRow>("precon_geometries").insert(
            rows.map((r) => ({ ...r, vertices: JSON.stringify(r.vertices) as never })),
          )
        : Promise.resolve(),
    geometriesBySession: (sessionId: string) =>
      db<PreconGeometryRow>("precon_geometries")
        .whereIn("sheet_id", db("precon_sheets").select("id").where({ session_id: sessionId }))
        .orderBy("created_at", "asc"),
    geometriesByRow: (rowId: string) => db<PreconGeometryRow>("precon_geometries").where({ row_id: rowId }),
    replaceRowGeometry: async (rowId: string, geometry: Omit<PreconGeometryRow, "created_at">) => {
      await db("precon_geometries").where({ row_id: rowId, kind: geometry.kind, source: "manual" }).delete();
      await db<PreconGeometryRow>("precon_geometries").insert({
        ...geometry,
        vertices: JSON.stringify(geometry.vertices) as never,
      });
    },

    // audit
    insertAuditEvent: (row: Omit<PreconAuditEventRow, "created_at">) =>
      db<PreconAuditEventRow>("precon_audit_events").insert({
        ...row,
        before: row.before === null ? null : (JSON.stringify(row.before) as never),
        after: row.after === null ? null : (JSON.stringify(row.after) as never),
      }),
    auditEventsForRow: (rowId: string) =>
      db<PreconAuditEventRow>("precon_audit_events").where({ row_id: rowId }).orderBy("created_at", "asc"),

    // summary settings
    settingsForSession: (sessionId: string) =>
      db<PreconSummarySettingsRow>("precon_summary_settings").where({ session_id: sessionId }).first(),
    upsertSettings: (row: PreconSummarySettingsRow) =>
      db<PreconSummarySettingsRow>("precon_summary_settings").insert(row).onConflict("session_id").merge(),

    // counts for review progress
    rowStatusCounts: async (sessionId: string): Promise<{ status: RowStatus | null; count: number }[]> => {
      const rows = (await db("precon_boq_rows")
        .whereIn("bill_id", db("precon_bills").select("id").where({ session_id: sessionId }))
        .whereIn("row_type", ["item", "provisional_sum"])
        .groupBy("status")
        .select("status")
        .count("* as count")) as unknown as { status: RowStatus | null; count: string }[];
      return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
    },

    projectNameForSession: async (sessionId: string): Promise<string | null> => {
      const row = await db("precon_sessions")
        .leftJoin("projects", "projects.id", "precon_sessions.project_id")
        .where("precon_sessions.id", sessionId)
        .select<{ name: string | null }>("projects.name")
        .first();
      return row?.name ?? null;
    },

    // rates
    orgIdForSession: async (sessionId: string): Promise<string | null> => {
      const row = await db<PreconSessionRow>("precon_sessions").where({ id: sessionId }).select("org_id").first();
      return row?.org_id ?? null;
    },
    rateCardsByOrg: (orgId: string) =>
      db<PreconRateCardRow>("precon_rate_cards").where({ org_id: orgId }).orderBy("created_at", "desc"),
    rateCardById: (id: string) => db<PreconRateCardRow>("precon_rate_cards").where({ id }).first(),
    insertRateCard: async (row: Omit<PreconRateCardRow, "created_at">) => {
      const [inserted] = await db<PreconRateCardRow>("precon_rate_cards").insert(row).returning("*");
      return inserted!;
    },
    ratesByCard: (rateCardId: string) =>
      db<PreconRateRow>("precon_rates").where({ rate_card_id: rateCardId }).orderBy("created_at", "asc"),
    insertRate: async (row: Omit<PreconRateRow, "created_at">) => {
      const [inserted] = await db<PreconRateRow>("precon_rates").insert(row).returning("*");
      return inserted!;
    },
    deleteRate: (id: string, rateCardId: string) =>
      db("precon_rates").where({ id, rate_card_id: rateCardId }).delete(),
    updateRowPricing: (id: string, patch: { rate: number; amount: number | null; rate_source: string }) =>
      db<PreconBoqRowRow>("precon_boq_rows").where({ id }).update({ ...patch, updated_at: db.fn.now() }),

    transaction: <T>(fn: (trx: Knex.Transaction) => Promise<T>) => db.transaction(fn),
  };
}
