import { test } from "node:test";
import assert from "node:assert/strict";
import { programmeEditor } from "./programme-editor.ts";
import type { PreconRepository } from "./repository.ts";
import type { PreconProgrammeTaskRow, ProgrammeDependency } from "./types.ts";

function row(id: string, overrides: Partial<PreconProgrammeTaskRow> = {}): PreconProgrammeTaskRow {
  return {
    id,
    session_id: "pcs_1",
    sort: 0,
    name: id,
    element_group: null,
    wbs_code: null,
    outline_level: 2,
    parent_task_id: null,
    duration_days: 5,
    predecessors: [],
    is_milestone: false,
    basis: null,
    confidence: "high",
    status: "ai_generated",
    version: 1,
    verified_by: null,
    verified_at: null,
    total_float_days: null,
    is_critical: false,
    origin: "ai",
    created_at: new Date("2026-09-01T00:00:00Z"),
    updated_at: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  };
}

/** In-memory programme table: enough repository surface for the editor. */
function memoryRepo(initial: PreconProgrammeTaskRow[]) {
  const rows = new Map(initial.map((r) => [r.id, { ...r }]));
  const audits: string[] = [];
  const repo = {
    programmeTasksBySession: async () => [...rows.values()].sort((a, b) => a.sort - b.sort),
    programmeTaskById: async (id: string) => rows.get(id) ?? undefined,
    updateProgrammeTaskVersioned: async (id: string, version: number, patch: Partial<PreconProgrammeTaskRow>) => {
      const current = rows.get(id);
      if (!current || current.version !== version) return null;
      const next = { ...current, ...patch, version: current.version + 1 };
      rows.set(id, next);
      return next;
    },
    updateProgrammeTaskDerived: async (id: string, patch: Partial<PreconProgrammeTaskRow>) => {
      const current = rows.get(id);
      if (current) rows.set(id, { ...current, ...patch });
      return 1;
    },
    insertProgrammeTask: async (r: PreconProgrammeTaskRow) => {
      rows.set(r.id, { ...r });
      return rows.get(r.id)!;
    },
    deleteProgrammeTask: async (id: string) => {
      rows.delete(id);
      return 1;
    },
  } as unknown as PreconRepository;
  const audit = async (_s: string, _r: string | null, _a: string, action: string) => {
    audits.push(action);
  };
  return { repo, rows, audits, editor: programmeEditor(repo, audit) };
}

const link = (taskId: string, type: ProgrammeDependency["type"] = "FS", lagDays = 0): ProgrammeDependency => ({ taskId, type, lagDays });

test("editing predecessors rejects a loop and names the tasks on it", async () => {
  const { editor } = memoryRepo([
    row("a", { sort: 0, name: "Excavate" }),
    row("b", { sort: 1, name: "Foundation", predecessors: [link("a")] }),
  ]);
  await assert.rejects(
    editor.updateTask("a", 1, { predecessors: [link("b")] }, "usr_1"),
    /dependency loop: .*Excavate.*Foundation|dependency loop: .*Foundation.*Excavate/,
  );
});

test("an edit moves the task off the AI draft and back to needs review", async () => {
  const { editor, rows, audits } = memoryRepo([row("a", { status: "verified", verified_by: "usr_9" })]);
  const updated = await editor.updateTask("a", 1, { durationDays: 8 }, "usr_1");
  assert.equal(updated.status, "needs_review");
  assert.equal(updated.origin, "manual");
  assert.equal(updated.verified_by, null);
  assert.equal(Number(rows.get("a")!.duration_days), 8);
  assert.deepEqual(audits, ["programme.updated"]);
});

test("indenting re-derives parents and reordering renumbers sorts", async () => {
  const { editor, rows } = memoryRepo([
    row("phase", { sort: 0, outline_level: 1 }),
    row("a", { sort: 1, outline_level: 2 }),
    row("b", { sort: 2, outline_level: 2 }),
    row("c", { sort: 3, outline_level: 2 }),
  ]);
  await editor.updateTask("b", 1, { outlineLevel: 3 }, "usr_1");
  assert.equal(rows.get("b")!.parent_task_id, "a", "indented under the task above it");
  await editor.updateTask("c", 1, { sort: 1 }, "usr_1");
  const order = [...rows.values()].sort((x, y) => x.sort - y.sort).map((r) => r.id);
  assert.deepEqual(order, ["phase", "c", "a", "b"]);
  assert.equal(rows.get("c")!.parent_task_id, "phase");
});

test("creating a task inserts after its anchor and deleting strips links to it", async () => {
  const { editor, rows } = memoryRepo([
    row("phase", { sort: 0, outline_level: 1 }),
    row("a", { sort: 1 }),
    row("b", { sort: 2, predecessors: [link("a")] }),
  ]);
  const created = await editor.createTask("pcs_1", { name: "Blinding", durationDays: 2, afterTaskId: "a", predecessors: [link("a", "SS", 1)] }, "usr_1");
  assert.equal(created.status, "needs_review");
  assert.equal(created.origin, "manual");
  assert.equal(created.parent_task_id, "phase");
  const orderAfterCreate = [...rows.values()].sort((x, y) => x.sort - y.sort).map((r) => r.id);
  assert.deepEqual(orderAfterCreate, ["phase", "a", created.id, "b"]);

  await editor.deleteTask("a", "usr_1");
  assert.equal(rows.has("a"), false);
  assert.deepEqual(rows.get("b")!.predecessors, [], "link into the deleted task removed");
  assert.deepEqual(rows.get(created.id)!.predecessors, []);
  const orderAfterDelete = [...rows.values()].sort((x, y) => x.sort - y.sort).map((r) => r.sort);
  assert.deepEqual(orderAfterDelete, [0, 1, 2], "sorts renumbered without a gap");
});

test("a milestone edit zeroes the duration and a self-link is refused", async () => {
  const { editor, rows } = memoryRepo([row("a", { duration_days: 5 })]);
  await editor.updateTask("a", 1, { isMilestone: true }, "usr_1");
  assert.equal(Number(rows.get("a")!.duration_days), 0);
  await assert.rejects(editor.updateTask("a", 2, { predecessors: [link("a")] }, "usr_1"), /depend on itself/);
});
