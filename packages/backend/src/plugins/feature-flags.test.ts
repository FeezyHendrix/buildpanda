import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import fp from "fastify-plugin";
import type { Knex } from "knex";
import type { EnrichedAccessContext } from "../lib/authorization.ts";
import { computeAccess } from "../modules/participants/access.ts";
import buildingsRoutes from "../modules/buildings/routes.ts";
import authContext from "./auth-context.ts";
import errorHandler from "./error-handler.ts";
import featureFlags from "./feature-flags.ts";

const project = { id: "site", owner_id: "owner", organization_id: "workspace" };
const building = { id: "building", project_id: "site", name: "Main building", kind: "real", status: "active", code: null, progress_percent: 0, sort_order: 0 };
const participant = (grants: Record<string, string[]> = {}): EnrichedAccessContext => ({
  userId: "crew", orgRoles: new Map(), orgPermissions: new Map(),
  projectRoles: new Map([["site", "client"]]), projectSectionPermissions: new Map(),
  projectGrants: new Map([["site", grants]]),
});

/** Real feature/auth middleware and building routes; only identity and database I/O are fixtures. */
async function fixture(flags: Record<string, boolean> = {}) {
  const state = { caller: participant({ buildings: ["view"] }) as EnrichedAccessContext | null, reads: 0 };
  const db = ((table: string) => {
    let where: Record<string, unknown> = {};
    return {
      where(value: Record<string, unknown>) { where = value; return this; },
      select() { return this; }, groupBy() { return this; },
      async first() {
        if (table === "platform_settings") return { feature_flags: flags };
        if (table === "projects") return where.id === "site" ? project : { ...project, id: "foreign", owner_id: "other", organization_id: "elsewhere" };
        throw new Error(`Unexpected lookup: ${table}`);
      },
      async orderBy() { assert.equal(table, "buildings"); assert.deepEqual(where, { project_id: "site", kind: "real" }); state.reads++; return [building]; },
      async avg() { assert.equal(table, "project_phases"); return []; },
    };
  }) as unknown as Knex;
  const app = Fastify({ logger: false });
  await app.register(fp(async (instance) => { instance.decorate("db", db); }, { name: "database" }));
  await app.register(fp(async (instance) => {
    instance.decorate("accessCache", { load: async () => { throw new Error("No session lookup expected"); }, invalidate: async () => {} });
  }, { name: "access-cache" }));
  await app.register(authContext);
  await app.register(errorHandler);
  await app.register(featureFlags);
  // The auth provider has no cookie in this fixture; supply verified identity at its boundary.
  app.addHook("onRequest", async (request) => {
    if (state.caller) request.user = { id: state.caller.userId, name: "Fixture", email: "fixture@example.invalid", role: "user", emailVerified: true, image: null };
  });
  app.addHook("preHandler", async (request) => {
    if (!state.caller) return;
    const ctx = state.caller;
    request.orgRoles = ctx.orgRoles;
    request.orgPermissions = ctx.orgPermissions;
    request.projectRoles = ctx.projectRoles ?? new Map();
    request.projectSectionPermissions = ctx.projectSectionPermissions ?? new Map();
    request.projectGrants = ctx.projectGrants ?? new Map();
    request.activeOrganizationId = "workspace";
  });
  await app.register(buildingsRoutes);
  app.get("/projects/site/access", async (request) => computeAccess(project, request));
  app.get("/projects/site/rfis", async () => { throw new Error("Disabled feature reached its handler"); });
  await app.ready();
  return { app, state };
}

test("building discovery works with multiple-building management disabled and preserves real RBAC", async () => {
  const { app, state } = await fixture({ "projects.multiBuilding": false });
  try {
    const callers = [
      { ...participant(), userId: "owner" },
      { ...participant(), orgRoles: new Map([["workspace", "owner"]]), orgPermissions: new Map([["workspace", new Map([["buildings", new Set(["view", "manage"])]])]]) },
      participant({ buildings: ["view"] }),
      participant({}),
      { ...participant(), projectRoles: new Map(), projectGrants: new Map() },
    ];
    for (const caller of callers) {
      state.caller = caller;
      const access = (await app.inject("/projects/site/access")).json();
      const allowed = access.permissions.buildings?.includes("view") === true;
      const response = await app.inject("/projects/site/buildings");
      assert.equal(response.statusCode, allowed ? 200 : 403, response.body);
      if (allowed) assert.equal(response.json()[0].id, "building");
      else assert.equal(response.json().code, "forbidden");
    }
    state.caller = participant({ buildings: ["view"] });
    assert.equal((await app.inject("/projects/foreign/buildings")).statusCode, 403);
    state.caller = null;
    assert.equal((await app.inject("/projects/site/buildings")).statusCode, 401);
    assert.equal(state.reads, 3, "denied requests never read building records");
  } finally { await app.close(); }
});

test("disabled building writes and other disabled features return an explicit feature error", async () => {
  const { app, state } = await fixture({ "projects.multiBuilding": false, "workflow.rfis": false });
  state.caller = { ...participant(), userId: "owner" };
  try {
    for (const [method, suffix, payload] of [
      ["POST", "", { name: "Block B" }], ["PATCH", "/building", { name: "Block C" }],
      ["DELETE", "/building", undefined], ["POST", "/building/clone-programme", { fromBuildingId: "source" }],
      ["PATCH", "/reorder", { buildingIds: ["building"] }],
    ] as const) {
      const response = await app.inject({ method, url: `/projects/site/buildings${suffix}`, payload });
      assert.equal(response.statusCode, 403, response.body);
      assert.equal(response.json().code, "feature_disabled");
      assert.deepEqual(response.json().details, { feature: "projects.multiBuilding" });
    }
    const response = await app.inject("/projects/site/rfis");
    assert.equal(response.json().code, "feature_disabled");
    assert.equal(state.reads, 0);
  } finally { await app.close(); }
});

test("enabling multiple buildings never grants management permission", async () => {
  const { app } = await fixture({ "projects.multiBuilding": true });
  try {
    assert.equal((await app.inject("/projects/site/buildings")).statusCode, 200);
    const response = await app.inject({ method: "POST", url: "/projects/site/buildings", payload: { name: "Block B" } });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "forbidden");
  } finally { await app.close(); }
});
