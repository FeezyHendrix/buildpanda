import { test } from "node:test";
import assert from "node:assert/strict";
import { assemblyBasis, assemblyMeasurement, assertAssemblyUnit } from "./assembly-measure.ts";
import type { PreconRepository } from "./repository.ts";
import type { PricedAssembly } from "../../rate-library/types.ts";
import type { PreconBillRow, PreconBoqRowDto, PreconBoqRowRow, PreconGeometry, PreconGeometryRow, PreconSessionRow, PreconSheetRow } from "./types.ts";

const MM_PER_PT = 17.64;
const pt = (mm: number) => mm / MM_PER_PT;

const sheet = { id: "pcsh_1", session_id: "pcs_1", file_name: "plan.dwg", code: "DWG-01", title: "Ground floor", scale_mm_per_pt: MM_PER_PT } as PreconSheetRow;
const session = { id: "pcs_1", org_id: "org_1", takeoff_kind: "manual" } as PreconSessionRow;
const bill = { id: "pbl_1", session_id: "pcs_1", title: "Bill No. 1", sort: 0, created_at: new Date() } as PreconBillRow;

const blockwall: PricedAssembly = {
  id: "pasm_1",
  name: "Blockwall 225",
  unit: "m",
  elementGroup: "walls",
  items: [
    { description: "225mm blockwork", unit: "m2", factor: 2.7, elementGroup: "walls", rateId: null, code: "F10", rate: null },
    { description: "Plaster both faces", unit: "m2", factor: 5.4, elementGroup: "finishes", rateId: "prt_plaster", code: null, rate: 3500 },
    { description: "DPC", unit: "m", factor: 1, elementGroup: "walls", rateId: null, code: null, rate: null },
  ],
  createdAt: "",
  updatedAt: "",
};

interface Line {
  description: string;
  elementGroup: string;
  code?: string;
  unit: string;
  qty: number;
  rate?: number;
  basis: string;
  provenance: string;
}

function harness() {
  const got = { lines: [] as Line[], geometries: [] as Omit<PreconGeometryRow, "created_at">[], audits: [] as Record<string, unknown>[], announced: [] as string[] };
  let n = 0;
  const repo = {
    sessionById: async () => session,
    sheetById: async () => sheet,
    insertGeometries: async (rows: Omit<PreconGeometryRow, "created_at">[]) => {
      got.geometries.push(...rows);
    },
  } as unknown as PreconRepository;
  const manual = {
    targetBill: async () => bill,
    insert: async (_bill: PreconBillRow, line: Line, actor: string) => {
      got.lines.push(line);
      n += 1;
      return { id: `pbr_${n}`, bill_id: bill.id, description: line.description, unit: line.unit, qty: line.qty, rate: line.rate ?? null, measurement_basis: line.basis, element_group: line.elementGroup, code: line.code ?? null, version: 1, verified_by: actor } as unknown as PreconBoqRowRow;
    },
    announce: (_s: string, row: PreconBoqRowRow) => {
      got.announced.push(row.id);
    },
    audit: async (_s: string, rowId: string | null, _a: string, action: string, _b: unknown, after: Record<string, unknown> | null) => {
      got.audits.push({ rowId, action, ...after });
    },
    toRow: (r: PreconBoqRowRow) => ({ id: r.id, description: r.description, unit: r.unit, qty: Number(r.qty), rate: r.rate === null ? null : Number(r.rate), elementGroup: r.element_group, code: r.code, measurementBasis: r.measurement_basis }) as unknown as PreconBoqRowDto,
    toGeometry: (g: PreconGeometryRow) => ({ id: g.id, rowId: g.row_id, sheetId: g.sheet_id, kind: g.kind, vertices: g.vertices, source: g.source, quantity: g.quantity, unit: g.unit }) as PreconGeometry,
  };
  const measure = assemblyMeasurement({ repo, manual, loadAssembly: async (orgId, id) => {
    if (orgId !== "org_1" || id !== "pasm_1") throw new Error("Assembly");
    return blockwall;
  } });
  return { measure, got };
}

test("assembly measurement: one drawn length bills as every item at drawn × factor × typical, with its own shape", async () => {
  const { measure, got } = harness();
  const vertices = [[0, 0], [pt(12400), 0]];
  const result = await measure.create("pcs_1", "org_1", { assemblyId: "pasm_1", sheetId: "pcsh_1", tool: "length", vertices, typical: 2 }, "usr_1");

  assert.equal(result.rows.length, 3);
  assert.deepEqual(result.rows.map((r) => [r.description, r.qty, r.unit, r.rate, r.elementGroup, r.code]), [
    ["225mm blockwork", 66.96, "m2", null, "walls", "F10"],
    ["Plaster both faces", 133.92, "m2", 3500, "finishes", null],
    ["DPC", 24.8, "m", null, "walls", null],
  ]);
  assert.equal(result.rows[0]!.measurementBasis, "12.4 m length on DWG-01 × factor 2.7 (Blockwall 225: 225mm blockwork) × 2 typical floors = 66.96 m2");
  assert.equal(got.lines[1]!.provenance, "Measured by hand on DWG-01 by usr_1 (assembly: Blockwall 225)");

  // every line carries the shape as evidence; the drawn figure is the base, before factors
  assert.equal(got.geometries.length, 3);
  assert.deepEqual(got.geometries.map((g) => g.row_id), ["pbr_1", "pbr_2", "pbr_3"]);
  assert.ok(got.geometries.every((g) => g.vertices === vertices && g.quantity === 12.4 && g.unit === "m" && g.kind === "linear" && g.source === "manual"));
  assert.equal(result.geometry.rowId, "pbr_1");
  assert.equal(result.geometries.length, 3);

  // each line is audited and announced on its own, naming the assembly
  assert.deepEqual(got.announced, ["pbr_1", "pbr_2", "pbr_3"]);
  assert.equal(got.audits.length, 3);
  assert.equal(got.audits[0]!["action"], "measured_by_hand");
  assert.equal(got.audits[0]!["assemblyId"], "pasm_1");
  assert.equal(got.audits[0]!["typical"], 2);
});

test("assembly measurement: the body rate prices only items without a library rate", async () => {
  const { measure } = harness();
  const result = await measure.create("pcs_1", "org_1", { assemblyId: "pasm_1", sheetId: "pcsh_1", tool: "length", vertices: [[0, 0], [pt(1000), 0]], rate: 100 }, "usr_1");
  assert.deepEqual(result.rows.map((r) => r.rate), [100, 3500, 100]);
});

test("assembly measurement: a drawing in another unit than the assembly is refused before anything is written", async () => {
  const { measure, got } = harness();
  await assert.rejects(
    measure.create("pcs_1", "org_1", { assemblyId: "pasm_1", sheetId: "pcsh_1", tool: "area", vertices: [[0, 0], [pt(1000), 0], [pt(1000), pt(1000)]] }, "usr_1"),
    /Blockwall 225 is measured in m; a area gives m2/,
  );
  assert.equal(got.lines.length, 0);
  assert.equal(got.geometries.length, 0);
});

test("assembly measurement: units compare loosely and the basis names every factor", () => {
  const q = { base: 10, baseUnit: "m2", gross: 10, unit: "m2", geometryKind: "area" as const };
  assert.doesNotThrow(() => assertAssemblyUnit({ name: "Slab", unit: "M²" }, q, "area"));
  assert.doesNotThrow(() => assertAssemblyUnit({ name: "Slab", unit: "sqm" }, q, "area"));
  assert.throws(() => assertAssemblyUnit({ name: "Slab", unit: "m3" }, q, "area"), /Slab is measured in m3/);
  assert.equal(assemblyBasis("10 m2 area on A-01", { name: "Slab" }, { description: "Screed", factor: 1, unit: "m2" }, 1, 10), "10 m2 area on A-01 × factor 1 (Slab: Screed) = 10 m2");
});
