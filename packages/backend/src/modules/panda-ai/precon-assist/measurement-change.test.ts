import { test } from "node:test";
import assert from "node:assert/strict";
import { preconAssistService } from "./service.ts";
import { permissionFor } from "./applier.ts";
import type { PreconAssistRepository } from "./repository.ts";
import type { PreconService } from "./applier.ts";
import type { AssistDraft } from "./planner.ts";
import type { ChangeSetRow } from "./types.ts";

// The measurement entity: a prompt that adds a line measured by hand goes
// through the same createMeasurement / createStatedMeasurement the composer
// dialog uses, with the sheet checked and the measure grant required.

function harness() {
  const calls: { method: string; sessionId: string; body: Record<string, unknown> }[] = [];
  const stored: ChangeSetRow[] = [];
  // the lines the session holds; a created line shows up in the next snapshot
  const rows: { id: string; version: number }[] = [];
  let seq = 0;
  const precon = {
    assertSessionOrg: async () => undefined,
    getSnapshot: async () => ({
      bills: [{ id: "pbl_1", title: "Bill No. 1 — Measured by hand", sort: 0 }],
      rows: [...rows],
      sheets: [{ id: "pcsh_1", code: "DWG-01", fileName: "plan.dwg", scaleMmPerPt: 17.64 }],
    }),
    createMeasurement: async (sessionId: string, body: Record<string, unknown>) => {
      calls.push({ method: "createMeasurement", sessionId, body });
      const row = { id: `pbr_m${++seq}`, version: 1 };
      rows.push(row);
      return { row, geometry: { id: "pgeo_1" } };
    },
    createStatedMeasurement: async (sessionId: string, body: Record<string, unknown>) => {
      calls.push({ method: "createStatedMeasurement", sessionId, body });
      const row = { id: `pbr_s${++seq}`, version: 1 };
      rows.push(row);
      return row;
    },
    removeRow: async (id: string) => {
      calls.push({ method: "removeRow", sessionId: "", body: { id } });
      rows.splice(rows.findIndex((r) => r.id === id), 1);
      return { ok: true as const };
    },
  } as unknown as PreconService;
  const repo = {
    insert: async (r: ChangeSetRow) => {
      const full = { ...r, created_at: new Date(), applied_at: null, applied_result: null };
      stored.push(full);
      return full;
    },
    byId: async (id: string) => stored.find((s) => s.id === id),
    setStatus: async (id: string, status: ChangeSetRow["status"], result: ChangeSetRow["applied_result"]) => {
      const s = stored.find((x) => x.id === id)!;
      s.status = status;
      s.applied_result = result;
    },
    stampOrigin: async () => undefined,
  } as unknown as PreconAssistRepository;
  const service = (draft: AssistDraft) =>
    preconAssistService(repo, {
      precon,
      preconRepo: { insertAuditEvent: async () => undefined } as never,
      llm: async () => draft,
      llmConfigured: () => true,
    });
  return { calls, stored, service };
}

const allow = () => true;

test("a stated figure becomes a stated measurement with the tool's factor and a diff label", async () => {
  const h = harness();
  const svc = h.service({
    plan: ["Add 12 m of 225 wall at 2.7 m high on DWG-01"],
    changes: [
      {
        op: "create",
        entity: "measurement",
        after: { sheetId: "pcsh_1", tool: "wall_area", qty: 12, heightM: 2.7, description: "225mm blockwork", elementGroup: "walls", code: "F10/125", amount: 999 },
      },
    ],
  });
  const set = await svc.propose({ sessionId: "pcs_1", surface: "bill", prompt: "add a 12 m length of 225 wall on DWG-01 at 2.7 m high" }, "usr_1", "org_1");
  assert.equal(set.changes[0]?.entity, "measurement");
  assert.equal(set.changes[0]?.label, "Measure · 225mm blockwork (wall area, 12 stated on DWG-01)");
  assert.equal("amount" in (set.changes[0]?.after ?? {}), false, "unknown fields are dropped");
  assert.deepEqual(svc.requiredPermissions(set), [["takeoffs", "measure"]]);

  const applied = await svc.apply(set.id, "usr_1", "org_1", allow);
  assert.equal(applied.appliedResult?.applied, 1);
  assert.equal(h.calls[0]?.method, "createStatedMeasurement");
  assert.equal(h.calls[0]?.sessionId, "pcs_1");
  assert.deepEqual(h.calls[0]?.body, {
    tool: "wall_area",
    description: "225mm blockwork",
    elementGroup: "walls",
    code: "F10/125",
    unit: undefined,
    factor: { heightM: 2.7, depthM: undefined },
    typical: undefined,
    rate: undefined,
    billId: undefined,
    qty: 12,
    sheetId: "pcsh_1",
  });

  const undone = await svc.undo(set.id, "usr_1", "org_1", allow);
  assert.equal(undone.status, "undone");
  assert.equal(h.calls.at(-1)?.method, "removeRow");
  assert.equal(h.calls.at(-1)?.body["id"], "pbr_s1");
});

test("vertices on a sheet become a drawn measurement through createMeasurement", async () => {
  const h = harness();
  const svc = h.service({
    plan: ["Measure the north wall"],
    changes: [
      { op: "create", entity: "measurement", after: { sheetId: "pcsh_1", tool: "length", vertices: [[0, 0], [100, 0]], description: "North wall", elementGroup: "walls", typical: 2 } },
    ],
  });
  const set = await svc.propose({ sessionId: "pcs_1", surface: "bill", prompt: "..." }, "usr_1", "org_1");
  assert.equal(set.changes[0]?.label, "Measure · North wall (length, 2 points on DWG-01)");
  await svc.apply(set.id, "usr_1", "org_1", allow);
  assert.equal(h.calls[0]?.method, "createMeasurement");
  assert.deepEqual(h.calls[0]?.body["vertices"], [[0, 0], [100, 0]]);
  assert.equal(h.calls[0]?.body["typical"], 2);
});

test("a measurement is refused when its sheet, tool or figure is wrong", async () => {
  const h = harness();
  const propose = (after: Record<string, unknown>, op: "create" | "update" = "create") =>
    h.service({ plan: ["x"], changes: [{ op, entity: "measurement", after }] }).propose({ sessionId: "pcs_1", surface: "bill", prompt: "..." }, "usr_1", "org_1");
  const base = { tool: "length", description: "Wall", elementGroup: "walls" };
  await assert.rejects(propose({ ...base, qty: 3, sheetId: "pcsh_404" }), /sheet that does not exist/);
  await assert.rejects(propose({ ...base, tool: "laser", qty: 3 }), /tool that does not exist/);
  await assert.rejects(propose({ ...base, qty: 3, vertices: [[0, 0], [1, 1]], sheetId: "pcsh_1" }), /either vertices/);
  await assert.rejects(propose({ ...base, vertices: [[0, 0], [1, 1]] }), /needs the sheet/);
  await assert.rejects(propose({ ...base, qty: -2 }), /qty/);
  await assert.rejects(propose({ ...base, qty: 2, typical: 1.5 }), /whole number/);
  await assert.rejects(propose({ ...base, qty: 2 }, "update"), /only be created/);
  await assert.rejects(propose({ tool: "count", qty: 2, description: "WC" }), /element group/);
  assert.deepEqual(permissionFor({ op: "create", entity: "measurement", after: {} }), ["takeoffs", "measure"]);
});
