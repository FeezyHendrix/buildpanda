// What the precon assistant is actually told about a measured line, taken off
// the real `propose` path rather than a hand-built context object.
//
// The assistant and Panda AI's `get_precon_boq` read the same bill through two
// different doors, and they had drifted to the same half-answer: tool, the two
// factors and the gross, with no openings, no repeat, no scale and no revision.
// A user asking the assistant to explain or adjust a line therefore got a model
// reasoning from a figure it could not decompose — and the only other thing in
// front of it was the `measurement_basis` sentence, which is prose.
//
// So the claims here are about the whole path: the snapshot the service loads,
// the compact rows the planner builds from it, and — most importantly — that
// the two surfaces say the SAME thing about the same line. Two field lists
// maintained by hand is exactly how this drifted the first time.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import {
  connectTestDatabase,
  dropEditorFixture,
  m,
  seedEditorFixture,
  type EditorFixture,
} from "../pdf-takeoff/editor-db-fixture.ts";
import { editorOperationService } from "../pdf-takeoff/editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "../pdf-takeoff/editor-operation-types.ts";
import { preconRepository } from "../pdf-takeoff/repository.ts";
import { preconService } from "../pdf-takeoff/service.ts";
import { agentRepository } from "../agent/repository.ts";
import { preconBoqLines } from "../agent/precon-boq.ts";
import type { LlmMessage } from "../../../lib/llm.ts";
import { preconAssistRepository } from "./repository.ts";
import { preconAssistService } from "./service.ts";
import type { AssistDraft } from "./planner.ts";

let db: Knex;
let fixture: EditorFixture;
let captured: LlmMessage[] = [];

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};
const EMPTY_DRAFT: AssistDraft = { plan: ["Nothing to change; this run only reads the context."], changes: [] };

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "assistbasis");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const apply = (command: EditorCommand): Promise<OperationReceipt> =>
  editorOperationService(db, noop).apply(
    fixture.sessionId,
    { operationId: `op_${randomUUID()}`, command },
    fixture.actor,
    GRANTS,
  );

const rect = (x: number, y: number, w: number, h: number): number[][] => [
  [m(x), m(y)],
  [m(x + w), m(y)],
  [m(x + w), m(y + h)],
  [m(x), m(y + h)],
];

/** One 6 m × 4 m slab: 24 m² gross on the fixture's calibrated sheet. */
const slab = (label: string, at: number): Promise<OperationReceipt> =>
  apply({
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool: "area",
    vertices: rect(0, at, 6, 4),
    description: `${label} ${randomUUID().slice(0, 6)}`,
    elementGroup: "Slabs",
  });

interface CompactRow {
  id: string;
  qty: number | null;
  qtyGross: number | null;
  tool: string | null;
  heightM: number | null;
  deductions: { label: string; qty: number; unit: string | null; mode: string | null }[];
  deductionsTotal: number;
  typical: number;
  repeatLabels: string[] | null;
  scales: { source: string; viewportId: string | null; sheetVersion: number; mmPerPt: number }[];
  measurementCount: number;
  hasUnknownBasis: boolean;
}

interface AssistContext {
  takeoff: { sourceRevision: number | null; supersededByNewerRevision: boolean | null };
  rows: CompactRow[];
}

/** The prompt the assistant would really send, built through `propose`. */
async function contextSentToTheModel(): Promise<{ system: string; context: AssistContext }> {
  captured = [];
  const service = preconAssistService(preconAssistRepository(db), {
    precon: preconService(preconRepository(db), noop),
    preconRepo: preconRepository(db),
    llmConfigured: () => true,
    llm: async (messages) => {
      captured = messages;
      return EMPTY_DRAFT;
    },
  });
  await service.propose(
    { sessionId: fixture.sessionId, surface: "bill", prompt: "Explain how these lines were measured" },
    fixture.actor,
    fixture.orgId,
  );
  const system = captured.find((message) => message.role === "system");
  const user = captured.find((message) => message.role === "user");
  assert.ok(system && user, "the assistant was given a system brief and a context");
  return { system: String(system.content), context: JSON.parse(String(user.content)) as AssistContext };
}

const rowIn = (context: AssistContext, id: string): CompactRow => {
  const row = context.rows.find((candidate) => candidate.id === id);
  assert.ok(row, `line ${id} is in the context the assistant is given`);
  return row;
};

describe("the assistant is given the whole basis, not half of it", () => {
  test("24 m² less a 2 m² opening, ×2 typical floors, arrives as the 44 it bills", async () => {
    const rowId = (await slab("Ground slab", 0)).rows[0]!.id;
    await apply({
      kind: "add-deduction",
      rowId,
      label: "Lift pit",
      mode: "area",
      vertices: rect(1, 1, 2, 1),
      sheetId: fixture.sheetId,
    });
    await apply({ kind: "set-row-typical", rowId, typical: 2 });

    const { context } = await contextSentToTheModel();
    const row = rowIn(context, rowId);
    assert.equal(row.qtyGross, 24);
    assert.equal(row.deductionsTotal, 2);
    assert.equal(row.typical, 2);
    assert.equal(row.qty, 44);
    assert.equal(
      (row.qtyGross! - row.deductionsTotal) * row.typical,
      row.qty,
      "the model can reach the billed figure from the fields alone, without the basis sentence",
    );
    assert.equal(row.deductions[0]?.label, "Lift pit", "and can name the opening it is explaining");
    assert.equal(row.deductions[0]?.unit, "m2");
    assert.equal(row.deductions[0]?.mode, "area");
    assert.equal(row.tool, "area");
    assert.deepEqual(row.scales, [{ source: "sheet", viewportId: null, sheetVersion: 1, mmPerPt: 50 }]);
    assert.equal(row.measurementCount, 1);
    assert.equal(row.hasUnknownBasis, false);
  });

  test("the revision the take-off was measured on travels with the context", async () => {
    const { context } = await contextSentToTheModel();
    assert.equal(context.takeoff.sourceRevision, 1);
    assert.equal(context.takeoff.supersededByNewerRevision, false);

    await db("precon_sessions").where({ id: fixture.sessionId }).update({ revision: 2 });
    const restated = await contextSentToTheModel();
    assert.equal(restated.context.takeoff.sourceRevision, 2, "a re-measured drawing says which revision these figures are");
    await db("precon_sessions").where({ id: fixture.sessionId }).update({ revision: 1 });
  });

  test("the names a repeating line stands for reach the model", async () => {
    const rowId = (await slab("Named bays", 40)).rows[0]!.id;
    await apply({ kind: "set-measurement-settings", rowId, repeatLabels: ["Bay 1", "Bay 2", "Bay 3"] });

    const row = rowIn((await contextSentToTheModel()).context, rowId);
    assert.deepEqual(row.repeatLabels, ["Bay 1", "Bay 2", "Bay 3"]);
    assert.equal(row.typical, 3);
  });

  test("a line whose basis was never recorded is flagged, with nothing guessed in its place", async () => {
    const rowId = (await slab("Legacy slab", 60)).rows[0]!.id;
    const shape = await db("precon_geometries")
      .where({ row_id: rowId })
      .whereNot("kind", "deduction")
      .first<{ id: string }>("id");
    await db("precon_geometries").where({ id: shape!.id }).update({ definition: null });

    const row = rowIn((await contextSentToTheModel()).context, rowId);
    assert.equal(row.tool, null, "nothing was stored, so nothing is offered");
    assert.equal(row.heightM, null);
    assert.deepEqual(row.scales, []);
    assert.equal(row.hasUnknownBasis, true, "and the model is told to send it for factor review instead");
  });

  test("the brief names the fields, so the model is told what it is being given", async () => {
    const { system } = await contextSentToTheModel();
    for (const field of ["deductionsTotal", "typical", "repeatLabels", "scales", "sheetVersion", "measurementCount", "sourceRevision"]) {
      assert.ok(system.includes(field), `the brief explains ${field}`);
    }
    assert.ok(
      system.includes("never infer a factor, an opening, a unit or a scale"),
      "and forbids inventing the parts of a basis that are not there",
    );
  });
});

describe("the two read surfaces describe the same line the same way", () => {
  test("Panda AI's tool and the assistant's context agree on gross, openings, repeat and scale", async () => {
    const rowId = (await slab("Shared slab", 80)).rows[0]!.id;
    await apply({
      kind: "add-deduction",
      rowId,
      label: "Duct riser",
      mode: "area",
      vertices: rect(1, 81, 1, 1),
      sheetId: fixture.sheetId,
    });
    await apply({ kind: "set-row-typical", rowId, typical: 3 });

    const description = (await db("precon_boq_rows").where({ id: rowId }).first<{ description: string }>("description"))!;
    const viaTool = (await preconBoqLines(agentRepository(db), fixture.projectId)).find(
      (line) => line.description === description.description,
    );
    const viaContext = rowIn((await contextSentToTheModel()).context, rowId);
    assert.ok(viaTool, "the line is in what Panda AI reads");

    assert.equal(viaTool.quantityGross, viaContext.qtyGross);
    assert.equal(viaTool.quantity, viaContext.qty);
    assert.equal(viaTool.deductionsTotal, viaContext.deductionsTotal);
    assert.equal(viaTool.typical, viaContext.typical);
    assert.equal(viaTool.tool, viaContext.tool);
    assert.equal(viaTool.measurementCount, viaContext.measurementCount);
    assert.equal(viaTool.hasUnknownBasis, viaContext.hasUnknownBasis);
    assert.deepEqual(viaTool.scales, viaContext.scales);
    assert.deepEqual(
      viaTool.deductions.map((opening) => [opening.label, opening.qty, opening.unit, opening.mode]),
      viaContext.deductions.map((opening) => [opening.label, opening.qty, opening.unit, opening.mode]),
      "including how each opening was taken, which lives on the opening's own record",
    );
  });
});
