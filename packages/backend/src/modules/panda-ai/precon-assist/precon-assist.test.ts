import { test } from "node:test";
import assert from "node:assert/strict";
import { preconAssistService } from "./service.ts";
import type { PreconAssistRepository } from "./repository.ts";
import type { PreconService } from "./applier.ts";
import type { AssistDraft } from "./planner.ts";
import type { ChangeSetRow } from "./types.ts";
import type { PreconBoqRowDto, PreconProgrammeTask } from "../pdf-takeoff/types.ts";

function row(overrides: Partial<PreconBoqRowDto> = {}): PreconBoqRowDto {
  return {
    id: "pbr_1",
    billId: "pbl_1",
    sort: 0,
    rowType: "item",
    elementGroup: "Walls",
    code: "F10",
    description: "225mm blockwork",
    unit: "m2",
    qtyGross: 50,
    deductions: [],
    qty: 50,
    rate: 4000,
    amount: 200000,
    rateSource: null,
    confidence: "high",
    status: "ai_generated",
    version: 1,
    measurementBasis: null,
    verifiedBy: null,
    verifiedAt: null,
    ...overrides,
  };
}

function task(overrides: Partial<PreconProgrammeTask> = {}): PreconProgrammeTask {
  return {
    id: "ppt_1",
    sessionId: "pcs_1",
    sort: 0,
    name: "Blockwork to lintel",
    elementGroup: "Walls",
    wbsCode: null,
    outlineLevel: 2,
    parentTaskId: null,
    durationDays: 20,
    predecessors: [],
    isMilestone: false,
    basis: "186 m2 at 10 m2/day",
    confidence: "high",
    status: "ai_generated",
    version: 1,
    verifiedBy: null,
    verifiedAt: null,
    startAt: "2026-09-15T00:00:00.000Z",
    finishAt: "2026-10-12T00:00:00.000Z",
    totalFloatDays: null,
    isCritical: false,
    origin: "ai",
    ...overrides,
  };
}

interface Harness {
  calls: string[];
  rows: Map<string, PreconBoqRowDto>;
  tasks: Map<string, PreconProgrammeTask>;
  stored: ChangeSetRow[];
  precon: PreconService;
  repo: PreconAssistRepository;
}

function harness(): Harness {
  const calls: string[] = [];
  const rows = new Map([["pbr_1", row()], ["pbr_2", row({ id: "pbr_2", description: "Screed", qty: 27.8, rate: 4200 })]]);
  const tasks = new Map([["ppt_1", task()]]);
  const stored: ChangeSetRow[] = [];
  let createdSeq = 0;
  const precon = {
    assertSessionOrg: async () => undefined,
    getSnapshot: async () => ({ bills: [{ id: "pbl_1", title: "Bill 1", sort: 0 }], rows: [...rows.values()] }),
    getProgramme: async () => ({ tasks: [...tasks.values()] }),
    updateRow: async (id: string, body: { version: number; changes: Record<string, unknown> }) => {
      calls.push(`updateRow:${id}:${JSON.stringify(body.changes)}`);
      const current = rows.get(id)!;
      const next = { ...current, ...Object.fromEntries(Object.entries(body.changes).filter(([, v]) => v !== undefined)), version: current.version + 1 };
      rows.set(id, next);
      return next;
    },
    verifyRow: async (id: string, version: number) => {
      calls.push(`verifyRow:${id}:v${version}`);
      const next = { ...rows.get(id)!, status: "verified" as const, version: version + 1 };
      rows.set(id, next);
      return next;
    },
    rejectRow: async (id: string, version: number) => {
      calls.push(`rejectRow:${id}:v${version}`);
      const next = { ...rows.get(id)!, status: "rejected" as const, version: version + 1 };
      rows.set(id, next);
      return next;
    },
    createRow: async (billId: string, body: { description: string }) => {
      calls.push(`createRow:${billId}:${body.description}`);
      const created = row({ id: `pbr_new_${++createdSeq}`, billId, description: body.description });
      rows.set(created.id, created);
      return created;
    },
    removeRow: async (id: string) => {
      calls.push(`removeRow:${id}`);
      rows.delete(id);
      return { ok: true as const };
    },
    updateProgrammeTask: async (id: string, version: number, patch: Record<string, unknown>) => {
      calls.push(`updateTask:${id}:${JSON.stringify(patch)}`);
      const next = { ...tasks.get(id)!, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)), version: version + 1 };
      tasks.set(id, next);
      return next;
    },
    setProgrammeTaskStatus: async (id: string, version: number, status: string) => {
      calls.push(`taskStatus:${id}:${status}`);
      const next = { ...tasks.get(id)!, status, version: version + 1 } as PreconProgrammeTask;
      tasks.set(id, next);
      return next;
    },
  } as unknown as PreconService;
  const repo = {
    insert: async (r: ChangeSetRow) => {
      const full = { ...r, created_at: new Date(), applied_at: null, applied_result: null };
      stored.push(full);
      return full;
    },
    byId: async (id: string) => stored.find((s) => s.id === id),
    listForSession: async () => stored,
    setStatus: async (id: string, status: ChangeSetRow["status"], result: ChangeSetRow["applied_result"]) => {
      const s = stored.find((x) => x.id === id)!;
      s.status = status;
      s.applied_result = result;
    },
    stampOrigin: async (_e: string, ids: string[]) => {
      calls.push(`stamp:${ids.join(",")}`);
    },
  } as unknown as PreconAssistRepository;
  return { calls, rows, tasks, stored, precon, repo };
}

function service(h: Harness, draft: AssistDraft) {
  const audits: unknown[] = [];
  const svc = preconAssistService(h.repo, {
    precon: h.precon,
    preconRepo: { insertAuditEvent: async (e: unknown) => { audits.push(e); } } as never,
    llm: async () => draft,
    llmConfigured: () => true,
  });
  return { svc, audits };
}

const allow = () => true;

test("propose rejects a change that references a line that does not exist", async () => {
  const h = harness();
  const { svc } = service(h, { plan: ["Change it"], changes: [{ op: "update", entity: "boq_row", id: "pbr_404", after: { qty: 1 } }] });
  await assert.rejects(svc.propose({ sessionId: "pcs_1", surface: "bill", prompt: "set qty" }, "usr_1", "org_1"), /does not exist/);
  assert.equal(h.stored.length, 0);
});

test("propose drops disallowed fields, fills before values, and refuses unsupported surfaces", async () => {
  const h = harness();
  const { svc } = service(h, {
    plan: ["Reprice blockwork"],
    changes: [{ op: "update", entity: "boq_row", id: "pbr_1", after: { rate: 4800, amount: 999, status: "verified" } }],
  });
  const set = await svc.propose({ sessionId: "pcs_1", surface: "bill", prompt: "price blockwork at 4800 and verify" }, "usr_1", "org_1");
  assert.deepEqual(set.changes[0]?.after, { rate: 4800, status: "verified" });
  assert.deepEqual(set.changes[0]?.before, { rate: 4000, status: "ai_generated" });
  assert.equal(set.status, "proposed");
  await assert.rejects(svc.propose({ sessionId: "pcs_1", surface: "pack", prompt: "rewrite" }, "usr_1", "org_1"), /not available on the pack yet/);
});

test("apply checks every grant first, then calls the same service methods the buttons use", async () => {
  const h = harness();
  const { svc, audits } = service(h, {
    plan: ["Reprice and verify blockwork, add skirting, drop screed"],
    changes: [
      { op: "update", entity: "boq_row", id: "pbr_1", after: { rate: 4800, status: "verified" } },
      { op: "create", entity: "boq_row", after: { billId: "pbl_1", description: "Skirting 100mm", unit: "m", qty: 42 } },
      { op: "delete", entity: "boq_row", id: "pbr_2", after: {} },
    ],
  });
  const set = await svc.propose({ sessionId: "pcs_1", surface: "bill", prompt: "..." }, "usr_1", "org_1");

  // an editor without the verify grant cannot apply a set that verifies
  const editOnly = (_r: string, action: string) => action !== "verify";
  await assert.rejects(svc.apply(set.id, "usr_1", "org_1", editOnly), /verify takeoffs/);
  assert.equal(h.calls.length, 0, "nothing is written when a grant is missing");

  const applied = await svc.apply(set.id, "usr_1", "org_1", allow);
  assert.equal(applied.status, "applied");
  assert.equal(applied.appliedResult?.applied, 3);
  assert.deepEqual(h.calls, [
    'updateRow:pbr_1:{"rate":4800}',
    "verifyRow:pbr_1:v2",
    "createRow:pbl_1:Skirting 100mm",
    "removeRow:pbr_2",
    "stamp:pbr_1,pbr_new_1",
  ]);
  assert.equal(h.rows.get("pbr_1")?.status, "verified");
  assert.equal(h.rows.has("pbr_2"), false);
  assert.equal((audits[0] as { action: string }).action, "assist.applied");
  assert.match(JSON.stringify(audits[0]), /Panda AI prompt/);
});

test("undo restores edited values, removes created lines and recreates deleted ones", async () => {
  const h = harness();
  const { svc } = service(h, {
    plan: ["Reprice, add, delete"],
    changes: [
      { op: "update", entity: "boq_row", id: "pbr_1", after: { rate: 4800 } },
      { op: "create", entity: "boq_row", after: { billId: "pbl_1", description: "Skirting 100mm" } },
      { op: "delete", entity: "boq_row", id: "pbr_2", after: {} },
    ],
  });
  const set = await svc.propose({ sessionId: "pcs_1", surface: "bill", prompt: "..." }, "usr_1", "org_1");
  await svc.apply(set.id, "usr_1", "org_1", allow);
  h.calls.length = 0;

  const undone = await svc.undo(set.id, "usr_1", "org_1", allow);
  assert.equal(undone.status, "undone");
  assert.equal(h.rows.get("pbr_1")?.rate, 4000, "rate restored");
  assert.equal(h.rows.has("pbr_new_1"), false, "created line removed");
  assert.ok([...h.rows.values()].some((r) => r.description === "Screed"), "deleted line recreated");
  await assert.rejects(svc.undo(set.id, "usr_1", "org_1", allow), /Only an applied change set/);
});

test("programme: supported fields apply, unsupported ones are reported as skipped, status uses the task method", async () => {
  const h = harness();
  const { svc } = service(h, {
    plan: ["Shorten blockwork and verify"],
    changes: [
      { op: "update", entity: "programme_task", id: "ppt_1", after: { durationDays: 15, basis: "two gangs", predecessors: [], status: "verified" } },
    ],
  });
  const set = await svc.propose({ sessionId: "pcs_1", surface: "programme", prompt: "..." }, "usr_1", "org_1");
  assert.deepEqual(set.changes[0]?.before, { durationDays: 20, basis: "186 m2 at 10 m2/day", predecessors: [], status: "ai_generated" });
  const applied = await svc.apply(set.id, "usr_1", "org_1", allow);
  assert.equal(applied.appliedResult?.applied, 1);
  assert.match(applied.appliedResult?.changes[0]?.reason ?? "", /predecessors/);
  assert.equal(h.calls[0], 'updateTask:ppt_1:{"durationDays":15,"basis":"two gangs"}');
  assert.equal(h.calls[1], "taskStatus:ppt_1:verified");
  assert.equal(h.tasks.get("ppt_1")?.durationDays, 15);
});
