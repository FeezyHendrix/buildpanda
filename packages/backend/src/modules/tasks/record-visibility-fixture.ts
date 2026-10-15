import Fastify, { type FastifyRequest } from "fastify";
import knex from "knex";
import { assertProjectPermission, type EnrichedAccessContext } from "../../lib/authorization.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { resolvePermissionMap } from "../../lib/permissions.ts";
import { computeAccess } from "../participants/access.ts";
import taskRoutes from "./routes.ts";
import transactionRoutes from "../transactions/routes.ts";
import reportingRoutes from "../reporting/routes.ts";
import { fileAccessRepository } from "../files/access-repository.ts";
import { requireFileRead } from "../files/access.ts";
import type { UploadedFileRow } from "../files/types.ts";
import type { ProjectRow } from "../projects/types.ts";
import type { ToolContext } from "../panda-ai/agent/tools.ts";

export const recordTestUrl = process.env.RECORD_TEST_DATABASE_URL;
export const ownGrants = { project: ["view"], tasks: ["view", "add", "remove"], finances: ["view", "viewCosts", "manage"], comments: ["view", "post"] };

export async function recordFixture() {
  const connection = knex({ client: "pg", connection: recordTestUrl });
  const db = await connection.transaction();
  await db("user").insert(["owner", "crew", "other", "empty"].map((id) => ({ id: `scope-${id}`, name: id, email: `${id}@scope.invalid` })));
  await db("organization").insert({ id: "scope-org", name: "Scoped records", slug: "scope-test" });
  await db("projects").insert(["site", "foreign"].map((id) => ({ id: `scope-${id}`, name: id, address: "Fixture", status: "On Track", risk: "Low", currency: "NGN", organization_id: "scope-org", owner_id: "scope-owner" })));
  await db("buildings").insert(["site", "foreign"].map((id) => ({ id: `scope-building-${id}`, project_id: `scope-${id}`, name: id })));
  await db("task_boards").insert(["site", "foreign"].map((id) => ({ id: `scope-board-${id}`, project_id: `scope-${id}`, building_id: `scope-building-${id}`, is_default: true })));
  await db("task_columns").insert(["site", "foreign"].map((id) => ({ id: `scope-column-${id}`, board_id: `scope-board-${id}`, name: "To do", status: "Todo" })));
  await db("tasks").insert(["created", "assigned", "hidden", "foreign"].map((id) => {
    const site = id === "foreign" ? "foreign" : "site";
    return { id: `scope-task-${id}`, title: id, project_id: `scope-${site}`, building_id: `scope-building-${site}`, board_id: `scope-board-${site}`, column_id: `scope-column-${site}`, created_by_id: id === "created" ? "scope-crew" : "scope-other", description: `![Evidence](/files/scope-task-file-${id}/download)` };
  }));
  await db("task_assignees").insert({ task_id: "scope-task-assigned", assignee_id: "scope-crew" });
  await db("uploaded_files").insert(["created", "hidden", "receipt"].map((id) => ({ id: `scope-expense-file-${id}`, project_id: "scope-site", owner_id: "scope-crew", file_name: "Receipt.png", mime_type: "image/png", size_bytes: 100, storage_path: `fixture/${id}` })));
  await db("project_transactions").insert(["created", "hidden", "foreign"].map((id, i) => ({ id: `scope-expense-${id}`, project_id: id === "foreign" ? "scope-foreign" : "scope-site", title: `${id} expense`, category: "materials", amount: (i + 1) * 100, transacted_at: "2026-10-15", created_by_id: id === "created" ? "scope-crew" : "scope-other", description: `![Evidence](/files/scope-expense-file-${id}/download)`, receipt_file_id: id === "hidden" ? "scope-expense-file-receipt" : null })));
  const project = { id: "scope-site", ownerId: "scope-owner", organizationId: "scope-org" };
  let ctx: EnrichedAccessContext;
  function asParticipant(grants: Record<string, readonly string[]> = ownGrants, role = "quantity_surveyor", userId = "scope-crew") {
    ctx = { userId, orgRoles: new Map(), orgPermissions: new Map(), projectRoles: new Map([[project.id, role]]), projectGrants: new Map([[project.id, grants]]), projectSectionPermissions: new Map() };
  }
  function asOrganization(role: string) {
    ctx = { userId: "scope-crew", orgRoles: new Map([["scope-org", role]]), orgPermissions: new Map([["scope-org", resolvePermissionMap(role, [])]]), projectRoles: new Map(), projectGrants: new Map(), projectSectionPermissions: new Map() };
  }
  asParticipant();
  const user = () => ({ id: ctx.userId, name: "Crew", email: "crew@scope.invalid", emailVerified: true, image: null, role: "user" });
  async function permission(id: string, resource: string, action: string): Promise<ProjectRow> {
    const row = await db<ProjectRow>("projects").where({ id }).first();
    if (!row) throw new NotFoundError("Project");
    assertProjectPermission({ id, ownerId: row.owner_id, organizationId: row.organization_id }, ctx, resource, action);
    return row;
  }
  const request = () => ({ ...ctx, user: user(), requireAuth: user, requireProjectPermission: permission, requireProjectAccess: (id: string) => permission(id, "project", "view") }) as unknown as FastifyRequest;
  const app = Fastify({ logger: false });
  app.decorate("db", db);
  app.decorateRequest("requireAuth", user);
  app.decorateRequest("requireProjectPermission", permission);
  app.decorateRequest("requireProjectAccess", (id: string) => permission(id, "project", "view"));
  app.addHook("onRequest", async (request) => { Object.assign(request, ctx, { user: user() }); });
  await app.register(taskRoutes);
  await app.register(transactionRoutes);
  await app.register(reportingRoutes);
  const files = fileAccessRepository(db);
  return { db, app, project, asParticipant, asOrganization,
    context: () => ctx,
    access: () => computeAccess({ id: project.id, owner_id: project.ownerId, organization_id: project.organizationId }, request()),
    toolContext: (): ToolContext => ({ db, projectId: project.id, caller: { ...ctx, projectRoles: ctx.projectRoles ?? new Map(), projectSectionPermissions: ctx.projectSectionPermissions ?? new Map(), projectGrants: ctx.projectGrants ?? new Map(), user: user(), project } }),
    readFile: (id: string) => requireFileRead(request(), { id, project_id: project.id, owner_id: "scope-crew" } as UploadedFileRow, files),
    async close() { await app.close(); await db.rollback(); await connection.destroy(); },
  };
}
