import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify, { type FastifyRequest } from "fastify";
import { assertProjectPermission, canProjectPermission, type EnrichedAccessContext } from "./authorization.ts";
import { resolvePermissionMap, statement } from "./permissions.ts";
import { computeAccess } from "../modules/participants/access.ts";
import { requireConversationPermission } from "../modules/messaging/permission.ts";
import { requireFileRead } from "../modules/files/access.ts";
import { referencedFileIds, requireProjectFileReferences } from "../modules/files/attachment-access.ts";
import type { FilesRepository } from "../modules/files/repository.ts";
import type { FileAccessRepository } from "../modules/files/access-repository.ts";
import type { UploadedFileRow } from "../modules/files/types.ts";
import { voiceReportRepository } from "../modules/panda-ai/voice-report/repository.ts";
import { resolveAccessContext } from "../modules/access-context/service.ts";
import { conversationAccess } from "../modules/messaging/realtime-access.ts";
import { messagingAccessRepository } from "../modules/messaging/access-repository.ts";
import { RealtimeHub } from "./realtime/index.ts";
import type { WebSocket } from "ws";
import type { Knex } from "knex";

const project = { id: "site", ownerId: "owner", organizationId: "workspace" };
const projectRow = { id: project.id, owner_id: project.ownerId, organization_id: project.organizationId };
function context(grants: Record<string, string[]> = {}): EnrichedAccessContext {
  return { userId: "crew", orgRoles: new Map(), orgPermissions: new Map(), projectRoles: new Map([["site", "client"]]),
    projectGrants: new Map([["site", grants]]), projectSectionPermissions: new Map() };
}
function requestFor(ctx: EnrichedAccessContext): FastifyRequest {
  return { ...ctx, user: { id: ctx.userId }, activeOrganizationId: "workspace", requireAuth: () => ({ id: ctx.userId }),
    requireProjectPermission: async (id: string, resource: string, action: string) => {
      assertProjectPermission({ ...project, id }, ctx, resource, action); return projectRow;
    },
  } as unknown as FastifyRequest;
}

test("access response agrees with API authorization for owner, viewer, employee and participant overrides", () => {
  const participant = context({ rfis: ["view"], materials: ["view", "approve"] });
  const hidden = context({});
  const legacy = { ...context(), projectGrants: new Map(), projectSectionPermissions: new Map([["site", { rfis: "hidden" as const }]]) };
  const viewer = { ...context(), projectRoles: new Map(), orgRoles: new Map([["workspace", "viewer"]]), orgPermissions: new Map([["workspace", new Map([["documents", new Set(["view"])]])]]) };
  const employee = { ...viewer, orgRoles: new Map([["workspace", "employee"]]) };
  for (const ctx of [participant, hidden, legacy, viewer, employee, { ...context(), userId: "owner" }]) {
    const response = computeAccess(projectRow, requestFor(ctx));
    for (const [resource, actions] of Object.entries(statement)) for (const action of actions) {
      assert.equal(response.permissions[resource]?.includes(action) === true, canProjectPermission(project, ctx, resource, action), `${ctx.userId}: ${resource}:${action}`);
    }
    assert.equal(response.userId, ctx.userId);
    assert.equal(response.organizationId, "workspace");
  }
  assert.equal(canProjectPermission({ ...project, id: "foreign", organizationId: "elsewhere" }, participant, "materials", "approve"), false);
  assert.equal(canProjectPermission(project, context({ documents: ["manage"] }), "documents", "upload"), false);
});

test("employees can read the building scope required by their permitted field records", () => {
  const orgPermissions = resolvePermissionMap("employee", []);
  const employee = {
    ...context(),
    projectRoles: new Map(),
    orgRoles: new Map([["workspace", "employee"]]),
    orgPermissions: new Map([["workspace", orgPermissions]]),
  };
  const access = computeAccess(projectRow, requestFor(employee));

  assert.equal(access.permissions.buildings?.includes("view"), true);
  assert.equal(canProjectPermission(project, employee, "buildings", "view"), true);
  assert.equal(canProjectPermission(project, employee, "buildings", "manage"), false);
  assert.equal(canProjectPermission(project, employee, "tasks", "viewAll"), false);
});

test("direct message reads require workspace view; sends also require send, independent of project grants", async () => {
  const app = Fastify({ logger: false });
  let ctx = context({ messages: ["view", "send"] });
  let sideEffects = 0;
  app.get("/channels/dm/messages", async () => { await requireConversationPermission(requestFor(ctx), { projectId: null, organizationId: null }, "view"); return ["message"]; });
  app.post("/channels/dm/messages", async () => { await requireConversationPermission(requestFor(ctx), { projectId: null, organizationId: null }, "send"); sideEffects++; return { ok: true }; });
  app.get("/channels/project/messages", async () => { await requireConversationPermission(requestFor(ctx), { projectId: "site", organizationId: null }, "view"); return ["message"]; });
  await app.ready();
  try {
    assert.equal((await app.inject("/channels/dm/messages")).statusCode, 403);
    assert.equal((await app.inject("/channels/project/messages")).statusCode, 200);
    ctx.orgRoles = new Map([["workspace", "member"]]);
    ctx.orgPermissions = new Map([["workspace", new Map([["messages", new Set(["view"])]])]]);
    assert.equal((await app.inject("/channels/dm/messages")).statusCode, 200);
    assert.equal((await app.inject({ method: "POST", url: "/channels/dm/messages" })).statusCode, 403);
    assert.equal(sideEffects, 0);
    ctx.orgPermissions = new Map([["workspace", new Map([["messages", new Set(["view", "send"])]])]]);
    assert.equal((await app.inject({ method: "POST", url: "/channels/dm/messages" })).statusCode, 200);
    assert.equal(sideEffects, 1);
    ctx = context();
    assert.equal((await app.inject("/channels/project/messages")).statusCode, 403);
  } finally { await app.close(); }
});

test("file downloads require the containing resource and scope, including RFI visibility and conversation restrictions", async () => {
  const file = { id: "file", project_id: "site", owner_id: "someone" } as UploadedFileRow;
  const references: Awaited<ReturnType<FileAccessRepository["projectReferences"]>> = [{ project_id: "site", resource: "documents", action: "view" }];
  const conversations: Awaited<ReturnType<FileAccessRepository["messageReferences"]>> = [];
  const repository: FileAccessRepository = { projectReferences: async () => references, messageReferences: async () => conversations, organizationReferences: async () => [] };
  const app = Fastify({ logger: false });
  let ctx = context({ rfis: ["view"] }); let reads = 0;
  app.get("/files/file/download", async () => { await requireFileRead(requestFor(ctx), file, repository); reads++; return "bytes"; });
  await app.ready();
  try {
    assert.equal((await app.inject("/files/file/download")).statusCode, 403);
    assert.equal(reads, 0);
    ctx = context({ documents: ["view"] });
    assert.equal((await app.inject("/files/file/download")).statusCode, 200);
    references[0]!.project_id = "foreign";
    assert.equal((await app.inject("/files/file/download")).statusCode, 403);
    references[0] = { project_id: "site", resource: "rfis", action: "view", visibility: "internal" };
    ctx = context({ rfis: ["view"] });
    assert.equal((await app.inject("/files/file/download")).statusCode, 403);
    references[0].visibility = "shared";
    assert.equal((await app.inject("/files/file/download")).statusCode, 200);
    references[0].is_proposed_response = true;
    assert.equal((await app.inject("/files/file/download")).statusCode, 403);
    references.length = 0; file.project_id = null; file.owner_id = "crew";
    conversations.push({ projectId: null, organizationId: null, memberId: null });
    assert.equal((await app.inject("/files/file/download")).statusCode, 403, "Uploader cannot bypass revoked conversation membership");
  } finally { await app.close(); }
});

test("voice classification never reads denied resource tables", async () => {
  const touched: string[] = [];
  const db = ((table: string) => {
    touched.push(table);
    if (table !== "rfis") throw new Error(`Forbidden data read: ${table}`);
    const query = { where: () => query, whereNotIn: () => query, orderBy: () => query, limit: () => query,
      modify: (apply: (query: unknown) => void) => { apply(query); return query; },
      select: async () => [{ id: "rfi", number: 1, subject: "Allowed", status: "Open" }] };
    return query;
  }) as unknown as Knex;
  const empty = await voiceReportRepository(db).snapshot("site", () => false, true);
  assert.deepEqual(touched, []);
  assert.deepEqual(empty.rfis, []);
  const visible = await voiceReportRepository(db).snapshot("site", (resource) => resource === "rfis", true);
  assert.deepEqual(touched, ["rfis"]);
  assert.equal(visible.rfis[0]?.subject, "Allowed");
  assert.deepEqual(visible.materialOrders, []);
});


test("empty participant grants survive context resolution as authoritative denial", () => {
  const rows = { memberRows: [], customRoleRows: [], participantRows: [{ project_id: "site", role: "client", permissions: null, grants: {} }] };
  const ctx = resolveAccessContext("crew", rows);
  assert.equal(ctx.projectGrants?.has("site"), true);
  for (const [resource, actions] of Object.entries(statement)) for (const action of actions) assert.equal(canProjectPermission(project, ctx, resource, action), false);
});

test("realtime reauthorizes conversation membership and workspace grants before each delivery", async () => {
  let ctx = context({ messages: ["view"] });
  let member = true;
  const repository = {
    memberChannel: async () => member ? { project_id: null, organization_id: null } : undefined,
    projectScope: async () => projectRow,
  } as unknown as ReturnType<typeof messagingAccessRepository>;
  const authorize = conversationAccess(repository, async () => ctx);
  assert.equal(await authorize("dm", "crew", "workspace"), false);
  ctx.orgRoles = new Map([["workspace", "member"]]);
  ctx.orgPermissions = new Map([["workspace", new Map([["messages", new Set(["view"])]])]]);
  const app = Fastify({ logger: false });
  const hub = new RealtimeHub(null, app.log);
  const received: string[] = [];
  const socket = hub.register("crew", { readyState: 1, OPEN: 1, send: (body: string) => received.push(body) } as unknown as WebSocket,
    () => authorize("dm", "crew", "workspace"));
  hub.subscribeChannel(socket, "dm");
  hub.publish({ event: "message.created", channelId: "dm", data: { body: "Allowed" } });
  await socket.delivery;
  assert.equal(received.length, 1);
  ctx.orgPermissions = new Map();
  hub.publish({ event: "message.created", channelId: "dm", data: { body: "Revoked" } });
  await socket.delivery;
  assert.equal(received.length, 1);
  assert.equal(socket.channels.has("dm"), false);
  member = false;
  assert.equal(await authorize("dm", "crew", "workspace"), false);
  hub.unregister(socket); await hub.close(); await app.close();
});

test("attaching a protected file cannot create permission to read it", async () => {
  assert.deepEqual(referencedFileIds({ profileId: "unrelated", receiptFileId: "receipt", files: [{ fileId: "photo" }],
    bodyHtml: '<img src="https://api.example/files/photo/view">', fileIds: ["drawing"] }), ["receipt", "photo", "drawing"]);
  const file = { id: "receipt", owner_id: "someone", project_id: "site", mime_type: "image/png", size_bytes: 128 } as UploadedFileRow;
  const files = { findByIds: async () => [file] } as unknown as FilesRepository;
  const access: FileAccessRepository = {
    projectReferences: async () => [{ project_id: "site", resource: "finances", action: "viewCosts" }],
    messageReferences: async () => [], organizationReferences: async () => [],
  };
  let ctx = context({ rfis: ["view", "create"] }); let writes = 0;
  const app = Fastify({ logger: false });
  app.post("/projects/site/rfis", async (request) => {
    const authorized = requestFor(ctx);
    authorized.body = request.body;
    authorized.requireProjectAccess = async () => projectRow as Awaited<ReturnType<FastifyRequest["requireProjectAccess"]>>;
    await requireProjectFileReferences(authorized, "site", files, access);
    writes++; return { ok: true };
  });
  try {
    const input = { method: "POST" as const, url: "/projects/site/rfis", payload: { questionHtml: '<img src="/files/receipt/download">' } };
    assert.equal((await app.inject(input)).statusCode, 403);
    assert.equal(writes, 0);
    ctx = context({ rfis: ["view", "create"], finances: ["viewCosts"] });
    assert.equal((await app.inject(input)).statusCode, 200);
    file.project_id = "foreign";
    assert.equal((await app.inject(input)).statusCode, 403);
    assert.equal(writes, 1);
  } finally { await app.close(); }
});
