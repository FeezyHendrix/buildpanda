import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleProjectService } from "./service.ts";
import type { SampleProjectRepository } from "./repository.ts";
import type { SampleProjectDataset } from "./types.ts";

interface Captured {
  dataset: SampleProjectDataset;
  financePatch: { projectId: string; patch: Record<string, unknown> };
}

function fakeRepo(options: {
  hasSample?: boolean;
  categories?: string[];
  captured?: Captured[];
}): SampleProjectRepository {
  return {
    hasSampleProject: async () => options.hasSample ?? false,
    existingDocumentCategoryIds: async () => new Set(options.categories ?? []),
    insertDataset: async (dataset, financePatch) => {
      options.captured?.push({ dataset, financePatch });
    },
  };
}

function rowsFor(dataset: SampleProjectDataset, table: string): Record<string, unknown>[] {
  return dataset.find((e) => e.table === table)?.rows ?? [];
}

test("skips a workspace that already has a sample project", async () => {
  const captured: Captured[] = [];
  const svc = sampleProjectService(fakeRepo({ hasSample: true, captured }));

  const result = await svc.provisionFor({ organizationId: "org_1", ownerId: "u_1" });

  assert.equal(result.created, false);
  assert.equal(captured.length, 0, "must not write anything for an existing sample");
});

test("provisions a project owned by the workspace and flagged as a sample", async () => {
  const captured: Captured[] = [];
  const svc = sampleProjectService(fakeRepo({ captured }));

  const result = await svc.provisionFor({ organizationId: "org_1", ownerId: "u_1" });

  assert.equal(result.created, true);
  assert.equal(captured.length, 1);

  const projects = rowsFor(captured[0]!.dataset, "projects");
  assert.equal(projects.length, 1);
  assert.equal(projects[0]!["id"], result.projectId);
  assert.equal(projects[0]!["organization_id"], "org_1");
  assert.equal(projects[0]!["owner_id"], "u_1");
  assert.equal(projects[0]!["is_sample"], true, "is_sample is what makes this idempotent");
  assert.equal(captured[0]!.financePatch.projectId, result.projectId);
});

test("two workspaces never collide on any id", async () => {
  const captured: Captured[] = [];
  const svc = sampleProjectService(fakeRepo({ captured }));

  await svc.provisionFor({ organizationId: "org_1", ownerId: "u_1" });
  await svc.provisionFor({ organizationId: "org_2", ownerId: "u_2" });

  const idsOf = (c: Captured): string[] =>
    c.dataset.flatMap((entry) =>
      entry.rows
        .map((row) => row["id"])
        .filter((id): id is string => typeof id === "string")
        .map((id) => `${entry.table}:${id}`),
    );

  const first = new Set(idsOf(captured[0]!));
  const overlap = idsOf(captured[1]!).filter((id) => first.has(id));
  assert.deepEqual(overlap, [], "a second sample project must share no primary key");
  assert.ok(first.size > 50, "expected a data-rich sample, got a stub");
});

test("retired document categories are remapped, unknown ones nulled", async () => {
  const withCategories: Captured[] = [];
  await sampleProjectService(
    fakeRepo({ captured: withCategories, categories: ["cat_doc_permits", "cat_plan_architectural"] }),
  ).provisionFor({ organizationId: "org_1", ownerId: "u_1" });

  const docs = rowsFor(withCategories[0]!.dataset, "project_documents");
  assert.ok(docs.length > 0, "sample project should ship documents");

  for (const doc of docs) {
    const category = doc["category_id"];
    assert.ok(
      category === null || category === "cat_doc_permits" || category === "cat_plan_architectural",
      `category_id must resolve to an existing row or null, got ${String(category)}`,
    );
  }
  assert.ok(
    docs.some((d) => d["category_id"] === "cat_plan_architectural"),
    "cat-architectural should map onto the current architectural plan category",
  );
});
