import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import { ForbiddenError } from "../../lib/errors.ts";
import type { FilesRepository } from "../files/repository.ts";
import type { DocumentsRepository, NewCategoryRecord } from "./repository.ts";
import documentRoutes from "./routes.ts";
import { documentsService } from "./service.ts";

function serviceWith(repo: Partial<DocumentsRepository>) {
  return documentsService(repo as DocumentsRepository, {} as FilesRepository);
}

test("a new category is trimmed, scoped to the project and attributed to the actor", async () => {
  const inserted: NewCategoryRecord[] = [];
  const service = serviceWith({
    findVisibleCategoryByName: async () => undefined,
    insertCategory: async (record) => {
      inserted.push(record);
      return { id: record.id, name: record.name, tone: record.tone, group: record.group };
    },
  });
  const created = await service.createCategory("p_1", { name: "  Legal  ", group: "plan" }, "u_1");
  assert.equal(inserted.length, 1);
  const { id, ...rest } = inserted[0]!;
  assert.deepEqual(rest, { name: "Legal", tone: "brand", group: "plan", project_id: "p_1", created_by: "u_1" });
  assert.deepEqual(created, { id, name: "Legal", tone: "brand", group: "plan", fileCount: 0, totalSize: "0 B" });
});

test("a name the project already sees in that group is refused with 409 and nothing is written", async () => {
  const lookups: unknown[][] = [];
  const service = serviceWith({
    findVisibleCategoryByName: async (...args) => {
      lookups.push(args);
      return { id: "cat_x", name: "Legal", tone: "brand", group: "document" };
    },
    insertCategory: async () => {
      throw new Error("duplicate reached the insert");
    },
  });
  await assert.rejects(
    service.createCategory("p_1", { name: "legal", group: "document" }, "u_1"),
    (err: { statusCode?: number }) => err.statusCode === 409,
  );
  assert.deepEqual(lookups, [["p_1", "document", "legal"]]);
});

test("two members saving the same name at once: the unique index answers 409", async () => {
  const service = serviceWith({
    findVisibleCategoryByName: async () => undefined,
    insertCategory: async () => {
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    },
  });
  await assert.rejects(
    service.createCategory("p_1", { name: "Legal", group: "document" }, "u_1"),
    (err: { statusCode?: number }) => err.statusCode === 409,
  );
});

async function appWith(permit: (resource: string, action: string) => boolean) {
  const app = Fastify({ logger: false });
  const checks: string[] = [];
  app.decorate("db", (() => {
    throw new Error("request reached the database");
  }) as never);
  app.decorate("queue", {} as never);
  app.decorateRequest("requireProjectPermission", (async (id: string, resource: string, action: string) => {
    checks.push(`${resource}:${action}`);
    if (!permit(resource, action)) throw new ForbiddenError();
    return { id };
  }) as never);
  app.decorateRequest("requireAuth", (() => ({ id: "u_1" })) as never);
  await app.register(documentRoutes);
  return { app, checks };
}

test("creating a category needs documents:upload; view alone is refused before any write", async () => {
  const { app, checks } = await appWith((resource, action) => resource === "documents" && action === "view");
  const res = await app.inject({
    method: "POST",
    url: "/projects/p_1/documents/categories",
    payload: { name: "Legal", group: "document" },
  });
  assert.equal(res.statusCode, 403);
  assert.deepEqual(checks, ["documents:upload"]);
  await app.close();
});

test("the body is validated: blank, over 60 characters, other groups and a missing group are 400", async () => {
  const { app } = await appWith(() => true);
  const bad = [
    { name: "   ", group: "document" },
    { name: "x".repeat(61), group: "document" },
    { name: "Legal", group: "media" },
    { name: "Legal" },
  ];
  for (const payload of bad) {
    const res = await app.inject({ method: "POST", url: "/projects/p_1/documents/categories", payload });
    assert.equal(res.statusCode, 400, JSON.stringify(payload));
  }
  await app.close();
});
