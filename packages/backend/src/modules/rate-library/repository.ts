import type { Knex } from "knex";
import type { PreconAssemblyRow, QuoteSourceRow, RateBuildupRow, RateCardRow, RateRow } from "./types.ts";

export type RateLibraryRepository = ReturnType<typeof rateLibraryRepository>;

export function rateLibraryRepository(db: Knex) {
  return {
    // cards
    cardsByOrg: (orgId: string) =>
      db<RateCardRow>("precon_rate_cards").where({ org_id: orgId }).orderBy([{ column: "is_default", order: "desc" }, { column: "created_at", order: "desc" }]),
    cardById: (id: string) => db<RateCardRow>("precon_rate_cards").where({ id }).first(),
    defaultCardForOrg: (orgId: string) =>
      db<RateCardRow>("precon_rate_cards")
        .where({ org_id: orgId })
        .orderBy([{ column: "is_default", order: "desc" }, { column: "created_at", order: "desc" }])
        .first(),
    insertCard: async (row: Omit<RateCardRow, "created_at">) => {
      const [inserted] = await db<RateCardRow>("precon_rate_cards").insert(row).returning("*");
      return inserted!;
    },
    updateCard: async (id: string, patch: Partial<Pick<RateCardRow, "name" | "region" | "is_default">>) => {
      const [updated] = await db<RateCardRow>("precon_rate_cards").where({ id }).update(patch).returning("*");
      return updated;
    },
    // only one default per org: clearing runs in the same transaction as the set
    setDefaultCard: (orgId: string, id: string) =>
      db.transaction(async (trx) => {
        await trx("precon_rate_cards").where({ org_id: orgId }).update({ is_default: false });
        await trx("precon_rate_cards").where({ id }).update({ is_default: true });
      }),
    deleteCard: (id: string) => db("precon_rate_cards").where({ id }).delete(),

    // rates
    ratesByCards: (cardIds: string[]) =>
      cardIds.length
        ? db<RateRow>("precon_rates").whereIn("rate_card_id", cardIds).orderBy("created_at", "asc")
        : Promise.resolve([] as RateRow[]),
    rateById: (id: string) => db<RateRow>("precon_rates").where({ id }).first(),
    insertRate: async (row: Omit<RateRow, "created_at">) => {
      const [inserted] = await db<RateRow>("precon_rates").insert(row).returning("*");
      return inserted!;
    },
    updateRate: async (id: string, patch: Partial<Omit<RateRow, "id" | "rate_card_id" | "created_at">>) => {
      const [updated] = await db<RateRow>("precon_rates").where({ id }).update(patch).returning("*");
      return updated;
    },
    deleteRate: (id: string, rateCardId: string) =>
      db("precon_rates").where({ id, rate_card_id: rateCardId }).delete(),

    // build-ups
    buildupsByRates: (rateIds: string[]) =>
      rateIds.length
        ? db<RateBuildupRow>("precon_rate_buildups").whereIn("rate_id", rateIds).orderBy("sort", "asc")
        : Promise.resolve([] as RateBuildupRow[]),
    // the build-up is replaced whole and the rate figure updated in one go so a
    // half-saved build-up can never disagree with the stored rate
    replaceBuildups: (rateId: string, rows: Omit<RateBuildupRow, "created_at">[], rate: number) =>
      db.transaction(async (trx) => {
        await trx("precon_rate_buildups").where({ rate_id: rateId }).delete();
        if (rows.length) await trx("precon_rate_buildups").insert(rows);
        await trx("precon_rates").where({ id: rateId }).update({ rate });
      }),

    // quote sources
    quotesByOrg: (orgId: string) =>
      db<QuoteSourceRow>("precon_quote_sources").where({ org_id: orgId }).orderBy("created_at", "desc"),
    quoteCountsByRates: async (rateIds: string[]): Promise<Map<string, number>> => {
      if (!rateIds.length) return new Map();
      const rows = await db("precon_quote_sources")
        .whereIn("rate_id", rateIds)
        .groupBy("rate_id")
        .select("rate_id")
        .count<{ rate_id: string; count: string }[]>("id as count");
      return new Map(rows.map((r) => [r.rate_id, Number(r.count)]));
    },
    quoteById: (id: string) => db<QuoteSourceRow>("precon_quote_sources").where({ id }).first(),
    insertQuote: async (row: Omit<QuoteSourceRow, "created_at">) => {
      const [inserted] = await db<QuoteSourceRow>("precon_quote_sources").insert(row).returning("*");
      return inserted!;
    },
    deleteQuote: (id: string, orgId: string) =>
      db("precon_quote_sources").where({ id, org_id: orgId }).delete(),

    // assemblies
    assembliesByOrg: (orgId: string) =>
      db<PreconAssemblyRow>("precon_assemblies").where({ org_id: orgId }).orderBy("name", "asc"),
    assemblyById: (id: string) => db<PreconAssemblyRow>("precon_assemblies").where({ id }).first(),
    insertAssembly: async (row: Omit<PreconAssemblyRow, "created_at" | "updated_at">) => {
      const [inserted] = await db<PreconAssemblyRow>("precon_assemblies")
        .insert({ ...row, items: JSON.stringify(row.items) as never })
        .returning("*");
      return inserted!;
    },
    updateAssembly: async (id: string, patch: Partial<Pick<PreconAssemblyRow, "name" | "unit" | "element_group" | "items">>) => {
      const dbPatch: Record<string, unknown> = { ...patch, updated_at: db.fn.now() };
      if (patch.items) dbPatch["items"] = JSON.stringify(patch.items);
      const [updated] = await db<PreconAssemblyRow>("precon_assemblies").where({ id }).update(dbPatch).returning("*");
      return updated;
    },
    deleteAssembly: (id: string, orgId: string) => db("precon_assemblies").where({ id, org_id: orgId }).delete(),
    // the rates an assembly's items point at, restricted to the org's own cards
    // so a rate id from another organisation can never price a line here
    ratesByIdsForOrg: (rateIds: string[], orgId: string) =>
      rateIds.length
        ? db<RateRow>("precon_rates")
            .join("precon_rate_cards", "precon_rate_cards.id", "precon_rates.rate_card_id")
            .where("precon_rate_cards.org_id", orgId)
            .whereIn("precon_rates.id", rateIds)
            .select<RateRow[]>("precon_rates.*")
        : Promise.resolve([] as RateRow[]),
  };
}
