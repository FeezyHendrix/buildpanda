import type { Knex } from "knex";
import { assertProjectPermission, canProjectPermission, canSeeAllTasks, type EnrichedAccessContext, type ProjectScope } from "../../lib/authorization.ts";

export type ReferenceContext = EnrichedAccessContext;

export interface ResolvedReference {
  type: string;
  id: string;
  restricted: boolean;
  title?: string;
  status?: string | null;
  projectId?: string | null;
  url?: string;
}

interface EntityConfig {
  resource: string;
  table: string;
  titleColumn: string;
  // tasks have no status column of their own — it lives on the joined task_columns row.
  statusJoin?: { table: string; on: string; statusColumn: string };
  path: (projectId: string, id: string) => string;
}

const ENTITY_CONFIG: Record<string, EntityConfig> = {
  rfi: { resource: "rfis", table: "rfis", titleColumn: "subject", path: (p, id) => `/project/${p}/rfis?open=${id}` },
  change_request: { resource: "change-requests", table: "change_requests", titleColumn: "title", path: (p, id) => `/project/${p}/change-requests?open=${id}` },
  activity: { resource: "schedule", table: "activities", titleColumn: "name", path: (p, id) => `/project/${p}/activities?open=${id}` },
  task: {
    resource: "tasks",
    table: "tasks",
    titleColumn: "title",
    statusJoin: { table: "task_columns", on: "column_id", statusColumn: "status" },
    path: (p, id) => `/project/${p}/tasks?task=${id}`,
  },
};

export function referenceableTypes(): string[] {
  return Object.keys(ENTITY_CONFIG);
}

function companyAccess(project: ProjectScope, ctx: ReferenceContext) {
  return project.ownerId === ctx.userId || Boolean(project.organizationId && ctx.orgRoles.has(project.organizationId));
}

export function referenceResolver(db: Knex) {
  async function loadRow(
    type: string,
    id: string,
  ): Promise<{ project_id: string | null; title: string; status: string | null; visibility?: string; owner_id: string | null; organization_id: string | null } | null> {
    const cfg = ENTITY_CONFIG[type];
    if (!cfg) return null;
    const statusColumn = cfg.statusJoin ? "s.status as status" : "e.status as status";
    let q = db(`${cfg.table} as e`)
      .leftJoin("projects as p", "p.id", "e.project_id")
      .where("e.id", id);
    if (cfg.statusJoin) {
      q = q.leftJoin(`${cfg.statusJoin.table} as s`, "s.id", `e.${cfg.statusJoin.on}`);
    }
    if (type === "rfi") q.select("e.visibility");
    const row = await q.first<{ project_id: string | null; title: string; status: string | null; visibility?: string; owner_id: string | null; organization_id: string | null }>(
      "e.project_id as project_id",
      `e.${cfg.titleColumn} as title`,
      statusColumn,
      "p.owner_id as owner_id",
      "p.organization_id as organization_id",
    );
    return row ?? null;
  }

  async function resolve(
    ref: { type: string; id: string; label?: string },
    ctx: ReferenceContext,
  ): Promise<ResolvedReference> {
    const cfg = ENTITY_CONFIG[ref.type];
    const row = cfg ? await loadRow(ref.type, ref.id) : null;
    if (!cfg || !row || !row.project_id) {
      return { type: ref.type, id: ref.id, restricted: true };
    }
    try {
      assertProjectPermission(
        { id: row.project_id, ownerId: row.owner_id, organizationId: row.organization_id },
        ctx, cfg.resource, "view",
      );
      const project = { id: row.project_id, ownerId: row.owner_id, organizationId: row.organization_id };
      if (!companyAccess(project, ctx) && (ref.type === "task" || (ref.type === "rfi" && row.visibility !== "shared"))) throw new Error("Restricted record");
      if (ref.type === "task" && !canSeeAllTasks(project, ctx)) {
        const assigned = await db("task_assignees").where({ task_id: ref.id, assignee_id: ctx.userId }).first("task_id");
        if (!assigned) throw new Error("Restricted record");
      }
    } catch {
      return { type: ref.type, id: ref.id, restricted: true };
    }
    return {
      type: ref.type,
      id: ref.id,
      restricted: false,
      title: row.title,
      status: row.status,
      projectId: row.project_id,
      url: cfg.path(row.project_id, ref.id),
    };
  }

  async function resolveMany(
    refs: { type: string; id: string; label?: string }[],
    ctx: ReferenceContext,
  ): Promise<ResolvedReference[]> {
    return Promise.all(refs.map((ref) => resolve(ref, ctx)));
  }

  async function search(
    query: string,
    projectIds: string[],
    types: string[] | undefined,
    limit: number,
    ctx: ReferenceContext,
  ): Promise<{ type: string; id: string; label: string; projectId: string }[]> {
    if (projectIds.length === 0 || !query.trim()) return [];
    const projects = await db("projects").whereIn("id", projectIds).select<{ id: string; ownerId: string | null; organizationId: string | null }[]>("id", "owner_id as ownerId", "organization_id as organizationId");
    const wanted = (types && types.length > 0 ? types : Object.keys(ENTITY_CONFIG)).filter(
      (t) => ENTITY_CONFIG[t],
    );
    const results: { type: string; id: string; label: string; projectId: string }[] = [];
    for (const type of wanted) {
      const cfg = ENTITY_CONFIG[type]!;
      const allowed = projects.filter((project) => canProjectPermission(project, ctx, cfg.resource, "view") && (type !== "task" || companyAccess(project, ctx)));
      if (!allowed.length) continue;
      const rows = await db(cfg.table)
        .where(function () {
          for (const project of allowed) this.orWhere(function () {
            this.where("project_id", project.id);
            if (type === "rfi" && !companyAccess(project, ctx)) this.where("visibility", "shared");
            if (type === "task" && !canSeeAllTasks(project, ctx)) this.whereIn("id", db("task_assignees").where("assignee_id", ctx.userId).select("task_id"));
          });
        })
        .whereILike(cfg.titleColumn, `%${query.trim()}%`)
        .select<{ id: string; label: string; project_id: string }[]>(
          "id",
          `${cfg.titleColumn} as label`,
          "project_id",
        )
        .limit(limit);
      for (const r of rows) {
        results.push({ type, id: r.id, label: r.label, projectId: r.project_id });
      }
    }
    return results.slice(0, limit);
  }

  return { resolve, resolveMany, search };
}

export type ReferenceResolver = ReturnType<typeof referenceResolver>;
