import { test } from "node:test";
import assert from "node:assert/strict";
import { assemblyService, normaliseItems } from "./assembly-service.ts";
import type { RateLibraryRepository } from "./repository.ts";
import type { AssemblyItem, PreconAssemblyRow, RateRow } from "./types.ts";

const plasterRate: RateRow = {
  id: "prt_plaster",
  rate_card_id: "prc_1",
  label: "Plaster",
  code_prefix: null,
  description_pattern: null,
  unit: "m2",
  rate: 3500,
  created_at: new Date("2026-08-01T00:00:00Z"),
};

const items: AssemblyItem[] = [
  { description: "225mm blockwork", unit: "m2", factor: 2.7, elementGroup: "walls", rateId: null, code: "F10" },
  { description: "Plaster both faces", unit: "m2", factor: 5.4, elementGroup: "", rateId: "prt_plaster", code: null },
];

const row: PreconAssemblyRow = {
  id: "pasm_1",
  org_id: "org_1",
  name: "Blockwall 225",
  unit: "m",
  element_group: "walls",
  items,
  created_by: "usr_1",
  created_at: new Date("2026-08-01T00:00:00Z"),
  updated_at: new Date("2026-08-01T00:00:00Z"),
};

function fakeRepo(overrides: Partial<Record<keyof RateLibraryRepository, unknown>> = {}): { repo: RateLibraryRepository; inserted: PreconAssemblyRow[] } {
  const inserted: PreconAssemblyRow[] = [];
  const repo = {
    assembliesByOrg: async () => [row],
    assemblyById: async (id: string) => (id === "pasm_1" ? row : undefined),
    insertAssembly: async (r: PreconAssemblyRow) => {
      const full = { ...r, created_at: new Date(), updated_at: new Date() };
      inserted.push(full);
      return full;
    },
    updateAssembly: async (_id: string, patch: Partial<PreconAssemblyRow>) => ({ ...row, ...patch }),
    deleteAssembly: async () => 1,
    ratesByIdsForOrg: async (ids: string[], orgId: string) => (orgId === "org_1" ? [plasterRate].filter((r) => ids.includes(r.id)) : []),
    ...overrides,
  } as unknown as RateLibraryRepository;
  return { repo, inserted };
}

test("assembly items: trimmed, factor above zero, element group falls back to the assembly's", () => {
  const out = normaliseItems(
    [{ description: "  Paint ", unit: " m2 ", factor: 2, elementGroup: " ", rateId: "", code: " M60 " }],
    "finishes",
  );
  assert.deepEqual(out, [{ description: "Paint", unit: "m2", factor: 2, elementGroup: "finishes", rateId: null, code: "M60" }]);
  assert.throws(() => normaliseItems([], "walls"), /at least one item/);
  assert.throws(() => normaliseItems([{ ...items[0]!, factor: 0 }], "walls"), /factor above zero/);
  assert.throws(() => normaliseItems([{ ...items[0]!, description: " " }], "walls"), /needs a description/);
});

test("assembly create: rejects a rate outside the organisation's library, otherwise stores normalised items", async () => {
  const { repo, inserted } = fakeRepo();
  const svc = assemblyService(repo);
  await assert.rejects(
    svc.create("org_1", "usr_1", { name: "Bad", unit: "m", elementGroup: "walls", items: [{ ...items[1]!, rateId: "prt_other" }] }),
    /not in this organisation's rate library/,
  );
  const created = await svc.create("org_1", "usr_1", { name: " Blockwall 225 ", unit: "m", elementGroup: "walls", items });
  assert.equal(inserted.length, 1);
  assert.equal(created.name, "Blockwall 225");
  assert.equal(created.items[1]!.elementGroup, "walls", "blank item group takes the assembly's");
  assert.match(created.id, /^pasm_/);
});

test("assembly priced: resolves each item's current rate, leaves unpriced items null, hides other orgs", async () => {
  const svc = assemblyService(fakeRepo().repo);
  const priced = await svc.priced("org_1", "pasm_1");
  assert.deepEqual(priced.items.map((i) => [i.description, i.rate]), [
    ["225mm blockwork", null],
    ["Plaster both faces", 3500],
  ]);
  await assert.rejects(svc.priced("org_2", "pasm_1"), /Assembly/);
  await assert.rejects(svc.priced("org_1", "pasm_missing"), /Assembly/);
});

test("assembly update: an empty patch returns the assembly unchanged; items are re-validated", async () => {
  const svc = assemblyService(fakeRepo().repo);
  const same = await svc.update("org_1", "pasm_1", {});
  assert.equal(same.name, "Blockwall 225");
  const renamed = await svc.update("org_1", "pasm_1", { name: "Blockwall 225 (ext)" });
  assert.equal(renamed.name, "Blockwall 225 (ext)");
  await assert.rejects(svc.update("org_1", "pasm_1", { items: [] }), /at least one item/);
  await assert.rejects(svc.update("org_1", "pasm_1", { name: "  " }), /needs a name/);
});
