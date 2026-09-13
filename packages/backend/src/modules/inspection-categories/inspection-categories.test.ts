import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectionCategoriesService } from "./service.ts";
import type { InspectionCategoriesRepository } from "./repository.ts";
import type { CategoryAudience, CategoryOwner, InspectionCategoryRow } from "./types.ts";

const owner: CategoryOwner = { projectId: "prj_1", organizationId: "org_1" };
const catalogue: CategoryAudience = { global: true };

/** Mirrors the repository's scoping: global catalogue + workspace + project. */
function visible(audience: CategoryAudience, r: InspectionCategoryRow): boolean {
  const isGlobal = r.organization_id === null && r.project_id === null;
  if ("global" in audience) return isGlobal;
  if (isGlobal) return true;
  if (r.project_id) return r.project_id === audience.projectId;
  return r.organization_id === audience.organizationId;
}

function row(over: Partial<InspectionCategoryRow> = {}): InspectionCategoryRow {
  return {
    id: "insc_1",
    organization_id: "org_1",
    project_id: null,
    name: "Drainage",
    sort_order: 0,
    active: true,
    created_by_id: "usr_1",
    created_at: new Date(),
    updated_at: new Date(),
    ...over,
  };
}

interface FakeState {
  rows: InspectionCategoryRow[];
  usage: Map<string, number>;
  renamed: { id: string; name: string }[];
  removed: string[];
}

function fakeRepository(state: FakeState): InspectionCategoriesRepository {
  return {
    list: async (audience: CategoryAudience, includeArchived: boolean) =>
      state.rows.filter((r) => visible(audience, r) && (includeArchived || r.active)),
    byId: async (audience: CategoryAudience, id: string) =>
      state.rows.find((r) => r.id === id && visible(audience, r)),
    byName: async (audience: CategoryAudience, name: string) =>
      state.rows.find(
        (r) => visible(audience, r) && r.name.toLowerCase() === name.toLowerCase(),
      ),
    insert: async (r: InspectionCategoryRow) => {
      state.rows.push(r);
      return [1] as never;
    },
    update: async (id: string, patch: Partial<InspectionCategoryRow>) => {
      const target = state.rows.find((r) => r.id === id);
      if (target) Object.assign(target, patch);
      return 1 as never;
    },
    remove: async (id: string) => {
      state.removed.push(id);
      state.rows = state.rows.filter((r) => r.id !== id);
      return 1 as never;
    },
    usageCounts: async (ids: string[]) =>
      new Map(ids.map((id) => [id, state.usage.get(id) ?? 0])),
    renameOnInspections: async (id: string, name: string) => {
      state.renamed.push({ id, name });
      return 1 as never;
    },
  } as unknown as InspectionCategoriesRepository;
}

function build(rows: InspectionCategoryRow[] = [], usage = new Map<string, number>()) {
  const state: FakeState = { rows, usage, renamed: [], removed: [] };
  return { state, service: inspectionCategoriesService(fakeRepository(state)) };
}

test("the list is data: a workspace admin adds a category and it joins the org's list", async () => {
  const { state, service } = build([row()]);
  const created = await service.create(owner, { name: "Kerbs & footways" }, "usr_1");
  assert.equal(created.name, "Kerbs & footways");
  assert.equal(created.scope, "organization");
  assert.equal(created.sortOrder, 1);
  assert.equal(state.rows.length, 2);
  assert.equal(state.rows[1]!.organization_id, "org_1");
  assert.equal(state.rows[1]!.project_id, null);
});

test("a category added for one job stays on that job", async () => {
  const { state, service } = build();
  const created = await service.create(owner, { name: "Tunnel lining", scope: "project" }, "usr_1");
  assert.equal(created.scope, "project");
  assert.equal(state.rows[0]!.project_id, "prj_1");
  assert.equal(state.rows[0]!.organization_id, null);
});

test("a project with no workspace keeps its own list", async () => {
  const { state, service } = build();
  await service.create({ projectId: "prj_2", organizationId: null }, { name: "Piling" }, "usr_1");
  assert.equal(state.rows[0]!.project_id, "prj_2");
  assert.equal(state.rows[0]!.organization_id, null);
});

test("the same category cannot be added twice, whatever the casing", async () => {
  const { service } = build([row()]);
  await assert.rejects(service.create(owner, { name: "drainage" }, "usr_1"), /already on the list/i);
});

test("adding a name that is archived points at restoring it", async () => {
  const { service } = build([row({ active: false })]);
  await assert.rejects(service.create(owner, { name: "Drainage" }, "usr_1"), /archived/i);
});

test("a blank name is refused", async () => {
  const { service } = build();
  await assert.rejects(service.create(owner, { name: "   " }, "usr_1"), /name/i);
});

test("renaming a category reads through to the inspections that hold it", async () => {
  const { state, service } = build([row()], new Map([["insc_1", 3]]));
  const updated = await service.update(owner, "insc_1", { name: "Drainage & culverts" });
  assert.equal(updated.name, "Drainage & culverts");
  assert.deepEqual(state.renamed, [{ id: "insc_1", name: "Drainage & culverts" }]);
});

test("a rename onto another category's name is refused", async () => {
  const { service } = build([row(), row({ id: "insc_2", name: "Pavement" })]);
  await assert.rejects(
    service.update(owner, "insc_2", { name: "Drainage" }),
    /already on the list/i,
  );
});

test("a category in use is archived, not deleted, so its records keep their meaning", async () => {
  const { state, service } = build([row()], new Map([["insc_1", 2]]));
  const result = await service.remove(owner, "insc_1");
  assert.equal(result.archived, true);
  assert.equal(state.removed.length, 0);
  assert.equal(state.rows[0]!.active, false);
});

test("an unused category is deleted outright", async () => {
  const { state, service } = build([row()]);
  const result = await service.remove(owner, "insc_1");
  assert.equal(result.archived, false);
  assert.deepEqual(state.removed, ["insc_1"]);
});

test("archived categories stay out of the picker but can be listed", async () => {
  const { service } = build([row(), row({ id: "insc_2", name: "Old trade", active: false })]);
  assert.equal((await service.list(owner)).length, 1);
  assert.equal((await service.list(owner, true)).length, 2);
});

test("an inspection cannot be filed against an archived category", async () => {
  const { service } = build([row({ active: false })]);
  await assert.rejects(service.resolve(owner, "insc_1"), /archived/i);
});

test("resolving an unknown category is a 404, not a silent default", async () => {
  const { service } = build([row()]);
  await assert.rejects(service.resolve(owner, "insc_missing"), /not found/i);
});

test("usage counts ride along so the UI can say what is safe to remove", async () => {
  const { service } = build([row()], new Map([["insc_1", 7]]));
  const [only] = await service.list(owner);
  assert.equal(only?.usageCount, 7);
});

// --- BuildPanda's service catalogue ----------------------------------------

function globalRow(over: Partial<InspectionCategoryRow> = {}): InspectionCategoryRow {
  return row({
    id: "insc_g1",
    organization_id: null,
    project_id: null,
    name: "Materials testing",
    created_by_id: null,
    ...over,
  });
}

test("every project sees BuildPanda's catalogue as well as its own workspace's list", async () => {
  const { service } = build([globalRow(), row()]);
  const names = (await service.list(owner)).map((c) => c.name).sort();
  assert.deepEqual(names, ["Drainage", "Materials testing"]);
});

test("a project with a workspace no longer loses the catalogue", async () => {
  const { service } = build([globalRow()]);
  assert.equal((await service.list(owner)).length, 1);
  assert.equal((await service.list({ projectId: "prj_9", organizationId: null }))[0]?.scope, "global");
});

test("a catalogue row and a workspace row of the same name show once, workspace wording winning", async () => {
  const { service } = build([
    globalRow({ id: "insc_g2", name: "Drainage" }),
    row({ id: "insc_o1", name: "Drainage" }),
  ]);
  const listed = await service.list(owner);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.id, "insc_o1");
  assert.equal(listed[0]?.scope, "organization");
});

test("a workspace cannot rename BuildPanda's catalogue out from under other customers", async () => {
  const { service } = build([globalRow()]);
  await assert.rejects(
    service.update(owner, "insc_g1", { name: "Our own wording" }),
    /only buildpanda can change it/i,
  );
  await assert.rejects(service.remove(owner, "insc_g1"), /only buildpanda can change it/i);
});

test("a platform admin adds to the catalogue and every project gets it", async () => {
  const { state, service } = build([]);
  const created = await service.create(catalogue, { name: "Piling integrity" }, "usr_admin");
  assert.equal(created.scope, "global");
  assert.equal(state.rows[0]!.organization_id, null);
  assert.equal(state.rows[0]!.project_id, null);
  assert.equal((await service.list(owner))[0]?.name, "Piling integrity");
});

test("a platform admin renames and archives a catalogue row", async () => {
  const { state, service } = build([globalRow()], new Map([["insc_g1", 4]]));
  const renamed = await service.update(catalogue, "insc_g1", { name: "Materials & lab testing" });
  assert.equal(renamed.name, "Materials & lab testing");
  assert.deepEqual(state.renamed, [{ id: "insc_g1", name: "Materials & lab testing" }]);
  const removed = await service.remove(catalogue, "insc_g1");
  assert.equal(removed.archived, true);
  assert.equal(state.rows[0]!.active, false);
});

test("a catalogue row is reordered, not just renamed", async () => {
  const { service } = build([globalRow()]);
  assert.equal((await service.update(catalogue, "insc_g1", { sortOrder: 7 })).sortOrder, 7);
});

test("a workspace adding a name BuildPanda already offers is pointed at the catalogue", async () => {
  const { service } = build([globalRow()]);
  await assert.rejects(
    service.create(owner, { name: "materials testing" }, "usr_1"),
    /buildpanda's inspection catalogue/i,
  );
});

test("the catalogue only ever shows the platform's own rows", async () => {
  const { service } = build([globalRow(), row(), row({ id: "insc_p1", project_id: "prj_1", organization_id: null, name: "Tunnel lining" })]);
  const listed = await service.list(catalogue, true);
  assert.deepEqual(listed.map((c) => c.id), ["insc_g1"]);
});
