import { test } from "node:test";
import assert from "node:assert/strict";
import { buildupLineCost, buildupTotal, quoteStatus, rateLibraryService } from "./service.ts";
import type { RateLibraryRepository } from "./repository.ts";
import type { RateBuildupRow, RateCardRow, RateRow } from "./types.ts";

const card: RateCardRow = {
  id: "prc_1",
  org_id: "org_1",
  name: "Lagos 2026",
  region: "Lagos",
  currency: "NGN",
  is_default: true,
  created_at: new Date("2026-08-01T00:00:00Z"),
};

const rate: RateRow = {
  id: "prt_1",
  rate_card_id: "prc_1",
  label: "225mm blockwork",
  code_prefix: "F10",
  description_pattern: "225mm sandcrete blockwork",
  unit: "m2",
  rate: 4800,
  created_at: new Date("2026-08-01T00:00:00Z"),
};

function fakeRepo(overrides: Partial<Record<keyof RateLibraryRepository, unknown>> = {}): RateLibraryRepository {
  return {
    cardsByOrg: async () => [card],
    cardById: async () => card,
    defaultCardForOrg: async () => card,
    insertCard: async (row: RateCardRow) => ({ ...row, created_at: new Date() }),
    updateCard: async () => card,
    setDefaultCard: async () => undefined,
    deleteCard: async () => 1,
    ratesByCards: async () => [rate],
    rateById: async () => rate,
    insertRate: async (row: RateRow) => ({ ...row, created_at: new Date() }),
    updateRate: async (_id: string, patch: Partial<RateRow>) => ({ ...rate, ...patch }),
    deleteRate: async () => 1,
    buildupsByRates: async () => [],
    replaceBuildups: async () => undefined,
    quotesByOrg: async () => [],
    quoteCountsByRates: async () => new Map(),
    quoteById: async () => undefined,
    insertQuote: async (row: Record<string, unknown>) => ({ ...row, created_at: new Date() }),
    deleteQuote: async () => 1,
    ...overrides,
  } as unknown as RateLibraryRepository;
}

test("buildup maths: waste is applied on top of qty × unit cost", () => {
  assert.equal(buildupLineCost(1.1, 1000, 10), 1210);
  assert.equal(buildupTotal([{ qty: 2, unitCost: 500, wastePct: 0 }, { qty: 1, unitCost: 300, wastePct: 5 }]), 1315);
});

test("quote status derives from valid_until with a 30-day expiring window", () => {
  const soon = new Date();
  soon.setUTCDate(soon.getUTCDate() + 10);
  const far = new Date();
  far.setUTCDate(far.getUTCDate() + 90);
  assert.equal(quoteStatus(null).status, "open");
  assert.equal(quoteStatus("2020-01-01").status, "expired");
  assert.equal(quoteStatus(soon.toISOString().slice(0, 10)).status, "expiring");
  assert.equal(quoteStatus(far.toISOString().slice(0, 10)).status, "valid");
});

test("setBuildups rewrites the rate to the build-up total and stores lines in order", async () => {
  const stored: { rows: RateBuildupRow[]; rate: number } = { rows: [], rate: Number(rate.rate) };
  const svc = rateLibraryService(
    fakeRepo({
      replaceBuildups: async (_rateId: string, rows: RateBuildupRow[], total: number) => {
        stored.rows = rows.map((r) => ({ ...r, created_at: new Date() }));
        stored.rate = total;
      },
      rateById: async () => ({ ...rate, rate: stored.rate }),
      buildupsByRates: async () => stored.rows,
    }),
  );
  const result = await svc.setBuildups("org_1", "prc_1", "prt_1", [
    { component: "material", description: "Blocks", qty: 12.5, unit: "nr", unitCost: 350, wastePct: 5 },
    { component: "labour", description: "Mason + labourer", qty: 0.4, unit: "day", unitCost: 15000 },
  ]);
  assert.equal(stored.rows.length, 2);
  assert.equal(stored.rows[1]!.sort, 1);
  assert.equal(result.buildupTotal, 10593.75);
  assert.equal(result.rate, 10593.75);
});

test("setBuildups rejects negative figures and refuses a foreign card", async () => {
  const svc = rateLibraryService(fakeRepo());
  await assert.rejects(
    svc.setBuildups("org_1", "prc_1", "prt_1", [{ component: "plant", description: "Mixer", qty: -1, unit: "hr", unitCost: 10 }]),
    /negative/,
  );
  const foreign = rateLibraryService(fakeRepo({ cardById: async () => ({ ...card, org_id: "org_2" }) }));
  await assert.rejects(foreign.setBuildups("org_1", "prc_1", "prt_1", []), /Rate card/);
});

test("matchRates prices lines against the default card and skips unmatched units", async () => {
  const svc = rateLibraryService(fakeRepo());
  const matches = await svc.matchRates("org_1", {
    items: [
      { code: "F10/125", description: "225mm sandcrete blockwork in cement mortar", unit: "m2" },
      { code: null, description: "Excavate trench", unit: "m3" },
    ],
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0]!.index, 0);
  assert.equal(matches[0]!.rate, 4800);
  assert.equal(matches[0]!.cardName, "Lagos 2026");
});

test("createCard makes the first card the default", async () => {
  let defaulted: string | null = null;
  const svc = rateLibraryService(
    fakeRepo({
      cardsByOrg: async () => [],
      insertCard: async (row: RateCardRow) => ({ ...row, created_at: new Date() }),
      setDefaultCard: async (_org: string, id: string) => {
        defaulted = id;
      },
    }),
  );
  const created = await svc.createCard("org_1", { name: "First" }, "NGN");
  assert.equal(created.isDefault, true);
  assert.equal(defaulted, created.id);
});
