import type { Knex } from "knex";
import type {
  PreconAuditEventRow,
  PreconRateCardRow,
  PreconRateRow,
  PreconBillRow,
  PreconBoqRowRow,
  PreconGeometryRow,
  PreconProgrammeTaskRow,
  PreconSessionRow,
  PreconSheetRow,
  PreconSummarySettingsRow,
  RowStatus,
  SessionStatus,
  SheetStatus,
  PreconProgressEntry,
  StructureContext,
} from "./types.ts";

export type PreconRepository = ReturnType<typeof preconRepository>;

export function preconRepository(db: Knex) {
  return {
    // sessions
    insertSession: async (row: Omit<PreconSessionRow, "created_at" | "updated_at" | "structure_context" | "programme_start_date">) => {
      // pg turns a JS array into a Postgres array literal, which jsonb rejects;
      // the JSON columns go in as text so an array-valued log inserts cleanly.
      const [inserted] = await db<PreconSessionRow>("precon_sessions")
        .insert({
          ...row,
          progress_log: (row.progress_log === null ? null : JSON.stringify(row.progress_log)) as never,
          scope: (row.scope === null ? null : JSON.stringify(row.scope)) as never,
        })
        .returning("*");
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

    // Append one progress entry and move the phase pointer. The log is capped
    // at 100 entries in SQL (drop index 0 when full) so a chatty run cannot
    // bloat the row; the client only ever renders the latest message per phase.
    appendSessionProgress: (id: string, entry: PreconProgressEntry) =>
      db<PreconSessionRow>("precon_sessions")
        .where({ id })
        .update({
          phase: entry.phase,
          progress_log: db.raw(
            `(CASE WHEN jsonb_array_length(COALESCE(progress_log, '[]'::jsonb)) >= 100
                THEN (progress_log - 0) ELSE COALESCE(progress_log, '[]'::jsonb) END) || ?::jsonb`,
            [JSON.stringify([entry])],
          ) as never,
          updated_at: db.fn.now(),
        }),

    // Put a failed session back to the state it was in before generate ran:
    // one pending placeholder sheet per uploaded file, no bills/rows/geometry,
    // no structure context, empty log. Everything else (settings, audit trail,
    // proposal link) is kept so the retry is a continuation, not a new session.
    resetSessionForRetry: (id: string) =>
      db.transaction(async (trx) => {
        const sheets = await trx<PreconSheetRow>("precon_sheets")
          .where({ session_id: id })
          .orderBy("page_number", "asc");
        const keepByFile = new Map<string, PreconSheetRow>();
        for (const sheet of sheets) {
          if (!keepByFile.has(sheet.storage_path)) keepByFile.set(sheet.storage_path, sheet);
        }
        const keepIds = [...keepByFile.values()].map((s) => s.id);
        await trx("precon_bills").where({ session_id: id }).delete();
        await trx("precon_sheets").where({ session_id: id }).whereNotIn("id", keepIds).delete();
        let pageNumber = 1;
        for (const sheet of keepByFile.values()) {
          await trx<PreconSheetRow>("precon_sheets")
            .where({ id: sheet.id })
            .update({
              page_number: pageNumber++,
              code: null,
              title: null,
              kind: "unknown",
              status: "pending",
              scale_mm_per_pt: null,
              scale_confidence: null,
              dim_unit: null,
              snap_index: null,
              error: null,
              updated_at: trx.fn.now(),
            });
        }
        await trx<PreconSessionRow>("precon_sessions")
          .where({ id })
          .update({
            status: "generating",
            error: null,
            phase: null,
            progress_log: null,
            structure_context: null,
            updated_at: trx.fn.now(),
          });
      }),

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
    insertBill: async (row: Omit<PreconBillRow, "created_at">) => {
      const [inserted] = await db<PreconBillRow>("precon_bills").insert(row).returning("*");
      return inserted!;
    },
    billsBySession: (sessionId: string) =>
      db<PreconBillRow>("precon_bills").where({ session_id: sessionId }).orderBy("sort", "asc"),
    billById: (id: string) => db<PreconBillRow>("precon_bills").where({ id }).first(),
    updateBill: async (id: string, patch: Partial<Pick<PreconBillRow, "title" | "sort">>) => {
      const rows = await db<PreconBillRow>("precon_bills").where({ id }).update(patch, "*");
      return (rows as PreconBillRow[])[0] ?? null;
    },
    deleteBill: (id: string) => db("precon_bills").where({ id }).delete(),
    nextBillSort: async (sessionId: string): Promise<number> => {
      const row = await db("precon_bills")
        .where({ session_id: sessionId })
        .max<{ max: number | null }[]>("sort as max")
        .first();
      return (row?.max ?? -1) + 1;
    },
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
          rows.slice(i, i + 200).map((r) => ({ ...r, deductions: JSON.stringify(r.deductions) as never })),
        );
      }
    },
    insertBoqRow: async (row: Omit<PreconBoqRowRow, "created_at" | "updated_at">) => {
      const [inserted] = await db<PreconBoqRowRow>("precon_boq_rows")
        .insert({ ...row, deductions: JSON.stringify(row.deductions) as never })
        .returning("*");
      return inserted!;
    },
    deleteRow: (id: string) => db("precon_boq_rows").where({ id }).delete(),
    deleteRows: (ids: string[]) => (ids.length ? db("precon_boq_rows").whereIn("id", ids).delete() : Promise.resolve(0)),
    // The engine's unverified lines whose only evidence is this sheet — what a
    // re-measure replaces. A line also drawn on another sheet is left alone.
    aiRowIdsOnSheet: async (sheetId: string): Promise<string[]> => {
      const onSheet = await db("precon_boq_rows as r")
        .join("precon_geometries as g", "g.row_id", "r.id")
        .where("g.sheet_id", sheetId)
        .andWhere("r.origin", "ai")
        .andWhereNot("r.status", "verified")
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

    // programme of work
    replaceProgrammeTasks: async (
      sessionId: string,
      rows: Omit<PreconProgrammeTaskRow, "created_at" | "updated_at">[],
    ) => {
      await db.transaction(async (trx) => {
        // Null the self-references first: the rows reference each other, so a
        // plain delete trips the parent_task_id foreign key.
        await trx("precon_programme_tasks").where({ session_id: sessionId }).update({ parent_task_id: null });
        await trx("precon_programme_tasks").where({ session_id: sessionId }).delete();
        for (let i = 0; i < rows.length; i += 200) {
          await trx<PreconProgrammeTaskRow>("precon_programme_tasks").insert(
            rows.slice(i, i + 200).map((r) => ({
              ...r,
              predecessors: JSON.stringify(r.predecessors) as never,
            })),
          );
        }
      });
    },
    programmeTasksBySession: (sessionId: string) =>
      db<PreconProgrammeTaskRow>("precon_programme_tasks")
        .where({ session_id: sessionId })
        .orderBy("sort", "asc"),
    programmeTaskById: (id: string) =>
      db<PreconProgrammeTaskRow>("precon_programme_tasks").where({ id }).first(),
    insertProgrammeTask: async (row: Omit<PreconProgrammeTaskRow, "created_at" | "updated_at">) => {
      const [inserted] = await db<PreconProgrammeTaskRow>("precon_programme_tasks")
        .insert({ ...row, predecessors: JSON.stringify(row.predecessors) as never })
        .returning("*");
      return inserted!;
    },
    deleteProgrammeTask: (id: string) => db("precon_programme_tasks").where({ id }).delete(),
    // Derived fields (parent, sort, float, critical) change as a consequence of
    // another task's edit, so they bypass the optimistic version check.
    updateProgrammeTaskDerived: (
      id: string,
      patch: Partial<
        Pick<
          PreconProgrammeTaskRow,
          "parent_task_id" | "sort" | "total_float_days" | "is_critical" | "predecessors" | "outline_level"
        >
      >,
    ) =>
      db<PreconProgrammeTaskRow>("precon_programme_tasks")
        .where({ id })
        .update({
          ...patch,
          predecessors: patch.predecessors === undefined ? undefined : (JSON.stringify(patch.predecessors) as never),
        }),
    updateProgrammeTaskVersioned: async (
      id: string,
      version: number,
      patch: Partial<
        Pick<
          PreconProgrammeTaskRow,
          | "name"
          | "duration_days"
          | "predecessors"
          | "is_milestone"
          | "basis"
          | "status"
          | "verified_by"
          | "verified_at"
          | "outline_level"
          | "origin"
        >
      >,
    ): Promise<PreconProgrammeTaskRow | null> => {
      const rows = await db<PreconProgrammeTaskRow>("precon_programme_tasks")
        .where({ id, version })
        .update(
          {
            ...patch,
            predecessors:
              patch.predecessors === undefined ? undefined : (JSON.stringify(patch.predecessors) as never),
            version: db.raw("version + 1") as never,
            updated_at: db.fn.now(),
          },
          "*",
        );
      return (rows as PreconProgrammeTaskRow[])[0] ?? null;
    },
    programmeStatusCounts: async (sessionId: string): Promise<{ status: RowStatus | null; count: number }[]> => {
      const rows = (await db("precon_programme_tasks")
        .where({ session_id: sessionId })
        .groupBy("status")
        .select("status")
        .count("* as count")) as unknown as { status: RowStatus | null; count: string }[];
      return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
    },
    setProgrammeStartDate: (sessionId: string, startDate: string) =>
      db("precon_sessions").where({ id: sessionId }).update({ programme_start_date: startDate, updated_at: db.fn.now() }),

    transaction: <T>(fn: (trx: Knex.Transaction) => Promise<T>) => db.transaction(fn),
  };
}
