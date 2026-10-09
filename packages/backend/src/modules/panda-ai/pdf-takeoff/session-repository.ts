import type { SessionExtraction } from "../geometry/types.ts";
import type { Knex } from "knex";
import type {
  PreconBillRow,
  PreconRateCardRow,
  PreconRateRow,
  PreconSessionRow,
  PreconSheetRow,
  PreconSummarySettingsRow,
  PreconProgressEntry,
  RowStatus,
  SessionLayerMap,
  SessionLineCounts,
  SessionStatus,
  StructureContext,
} from "./types.ts";

export type PreconSessionRepository = ReturnType<typeof preconSessionRepository>;

export function preconSessionRepository(db: Knex) {
  return {
    // sessions
    insertSession: async (
      row: Omit<PreconSessionRow, "created_at" | "updated_at" | "structure_context" | "programme_start_date" | "extraction" | "revision" | "superseded_by"> &
        Partial<Pick<PreconSessionRow, "revision" | "superseded_by">>,
    ) => {
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
    // every take-off ever run on this drawing, newest first; the caller matches the scope
    sessionsByPlan: (planId: string) => db<PreconSessionRow>("precon_sessions").where({ plan_id: planId }).orderBy("created_at", "desc"),
    supersedeSessions: (ids: string[], byId: string) =>
      ids.length === 0
        ? Promise.resolve(0)
        : db<PreconSessionRow>("precon_sessions").whereIn("id", ids).update({ superseded_by: byId, updated_at: db.fn.now() }),
    // one grouped query for a whole list, never one per session
    lineCountsForSessions: async (sessionIds: string[]): Promise<Map<string, SessionLineCounts>> => {
      const out = new Map<string, SessionLineCounts>();
      if (sessionIds.length === 0) return out;
      const rows = (await db("precon_boq_rows")
        .join("precon_bills", "precon_bills.id", "precon_boq_rows.bill_id")
        .whereIn("precon_bills.session_id", sessionIds)
        .whereIn("precon_boq_rows.row_type", ["item", "provisional_sum"])
        .whereNull("precon_boq_rows.deleted_at")
        .groupBy("precon_bills.session_id", "precon_boq_rows.status")
        .select("precon_bills.session_id as session_id", "precon_boq_rows.status as status")
        .count("* as count")) as unknown as { session_id: string; status: RowStatus | null; count: string }[];
      for (const r of rows) {
        const c = out.get(r.session_id) ?? { total: 0, verified: 0, attention: 0 };
        const n = Number(r.count);
        c.total += n;
        if (r.status === "verified") c.verified += n;
        if (r.status === "needs_review") c.attention += n;
        out.set(r.session_id, c);
      }
      return out;
    },
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

    // Extraction reports are written once per run, replacing the previous set;
    // the sheet summary is the compact cut the viewer reads without the session.
    updateSessionExtraction: (id: string, extraction: SessionExtraction) =>
      db<PreconSessionRow>("precon_sessions")
        .where({ id })
        .update({ extraction: db.raw("?::jsonb", [JSON.stringify(extraction)]) as never, updated_at: db.fn.now() }),

    updateSessionStructure: (id: string, structure: StructureContext) =>
      db<PreconSessionRow>("precon_sessions")
        .where({ id })
        .update({ structure_context: db.raw("?::jsonb", [JSON.stringify(structure)]), updated_at: db.fn.now() }),
    updateSessionLayerMap: (id: string, layerMap: SessionLayerMap | null) =>
      db<PreconSessionRow>("precon_sessions")
        .where({ id })
        .update({ layer_map: (layerMap === null ? null : db.raw("?::jsonb", [JSON.stringify(layerMap)])) as never, updated_at: db.fn.now() }),

    // bills
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

    // summary settings
    settingsForSession: (sessionId: string) =>
      db<PreconSummarySettingsRow>("precon_summary_settings").where({ session_id: sessionId }).first(),
    upsertSettings: (row: PreconSummarySettingsRow) =>
      db<PreconSummarySettingsRow>("precon_summary_settings").insert(row).onConflict("session_id").merge(),

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
  };
}
