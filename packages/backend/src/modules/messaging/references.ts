import type { Knex } from "knex";
import { assertCanAccessProject } from "../../lib/authorization.ts";

export interface ReferenceContext {
  userId: string;
  orgRoles: ReadonlyMap<string, string>;
  projectRoles: ReadonlyMap<string, string>;
}

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
  table: string;
  titleColumn: string;
  path: (projectId: string, id: string) => string;
}

const ENTITY_CONFIG: Record<string, EntityConfig> = {
  rfi: { table: "rfis", titleColumn: "subject", path: (p, id) => `/project/${p}/rfis?open=${id}` },
  action_item: { table: "action_items", titleColumn: "title", path: (p, id) => `/project/${p}/action-items?open=${id}` },
  query: { table: "queries", titleColumn: "subject", path: (p, id) => `/project/${p}/queries?open=${id}` },
  change_request: { table: "change_requests", titleColumn: "title", path: (p, id) => `/project/${p}/change-requests?open=${id}` },
  activity: { table: "activities", titleColumn: "name", path: (p, id) => `/project/${p}/activities?open=${id}` },
};

export function referenceableTypes(): string[] {
  return Object.keys(ENTITY_CONFIG);
}

export function referenceResolver(db: Knex) {
  async function loadRow(
    type: string,
    id: string,
  ): Promise<{ project_id: string | null; title: string; status: string | null; owner_id: string | null; organization_id: string | null } | null> {
    const cfg = ENTITY_CONFIG[type];
    if (!cfg) return null;
    const row = await db(`${cfg.table} as e`)
      .leftJoin("projects as p", "p.id", "e.project_id")
      .where("e.id", id)
      .first<{ project_id: string | null; title: string; status: string | null; owner_id: string | null; organization_id: string | null }>(
        "e.project_id as project_id",
        `e.${cfg.titleColumn} as title`,
        "e.status as status",
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
      assertCanAccessProject(
        { id: row.project_id, ownerId: row.owner_id, organizationId: row.organization_id },
        ctx,
      );
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
  ): Promise<{ type: string; id: string; label: string; projectId: string }[]> {
    if (projectIds.length === 0 || !query.trim()) return [];
    const wanted = (types && types.length > 0 ? types : Object.keys(ENTITY_CONFIG)).filter(
      (t) => ENTITY_CONFIG[t],
    );
    const results: { type: string; id: string; label: string; projectId: string }[] = [];
    for (const type of wanted) {
      const cfg = ENTITY_CONFIG[type]!;
      const rows = await db(cfg.table)
        .whereIn("project_id", projectIds)
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
