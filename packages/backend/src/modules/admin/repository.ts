import type { Knex } from "knex";

export interface ListParams {
  search?: string;
  status?: string;
  limit: number;
  offset: number;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
}

const USER_FIELDS = [
  "id",
  "name",
  "email",
  "role",
  "banned",
  "emailVerified",
  "accountType",
  "country",
  "phone",
  "profession",
  "image",
  "createdAt",
  "updatedAt",
] as const;

export function adminRepository(db: Knex) {
  async function overview() {
    const [
      users,
      organizations,
      projects,
      inspections,
      documents,
      openDisputes,
      finance,
    ] = await Promise.all([
      db("user").count<{ count: string }[]>("id as count").first(),
      db("organization").count<{ count: string }[]>("id as count").first(),
      db("projects").count<{ count: string }[]>("id as count").first(),
      db("inspections").count<{ count: string }[]>("id as count").first(),
      db("project_documents").count<{ count: string }[]>("id as count").first(),
      db("milestone_disputes")
        .where({ status: "Open" })
        .count<{ count: string }[]>("id as count")
        .first(),
      db("project_finances")
        .sum<{ budget: string; released: string }[]>({
          budget: "total_budget",
          released: "funds_released",
        })
        .first(),
    ]);

    const recentUsers = await db("user")
      .select("id", "name", "email", "role", "createdAt")
      .orderBy("createdAt", "desc")
      .limit(6);

    const recentProjects = await db("projects as p")
      .leftJoin("user as u", "u.id", "p.owner_id")
      .leftJoin("organization as o", "o.id", "p.organization_id")
      .select(
        "p.id",
        "p.name",
        "p.status",
        "p.progress_percent",
        "p.created_at",
        "u.name as ownerName",
        "o.name as organizationName",
      )
      .orderBy("p.created_at", "desc")
      .limit(6);

    const num = (v: { count?: string } | undefined) => Number(v?.count ?? 0);
    return {
      counts: {
        users: num(users),
        organizations: num(organizations),
        projects: num(projects),
        inspections: num(inspections),
        documents: num(documents),
        openDisputes: num(openDisputes),
      },
      finance: {
        totalBudget: Number(finance?.budget ?? 0),
        fundsReleased: Number(finance?.released ?? 0),
      },
      recentUsers,
      recentProjects,
    };
  }

  async function listUsers(params: ListParams) {
    const base = db("user");
    if (params.search) {
      const like = `%${params.search}%`;
      base.where((qb) => {
        qb.whereILike("name", like).orWhereILike("email", like);
      });
    }
    const totalRow = await base.clone().count<{ count: string }[]>("id as count").first();
    const rows = await base
      .clone()
      .select(...USER_FIELDS)
      .orderBy("createdAt", "desc")
      .limit(params.limit)
      .offset(params.offset);

    const ids = rows.map((r) => r.id as string);
    const projectCounts = ids.length
      ? await db("projects")
          .whereIn("owner_id", ids)
          .groupBy("owner_id")
          .select("owner_id")
          .count<{ owner_id: string; count: string }[]>("id as count")
      : [];
    const orgCounts = ids.length
      ? await db("member")
          .whereIn("userId", ids)
          .groupBy("userId")
          .select("userId")
          .count<{ userId: string; count: string }[]>("id as count")
      : [];
    const pById = new Map(projectCounts.map((r) => [r.owner_id, Number(r.count)]));
    const oById = new Map(orgCounts.map((r) => [r.userId, Number(r.count)]));

    return {
      total: Number(totalRow?.count ?? 0),
      rows: rows.map((r) => ({
        ...r,
        projectCount: pById.get(r.id as string) ?? 0,
        organizationCount: oById.get(r.id as string) ?? 0,
      })),
    };
  }

  async function getUser(id: string) {
    const user = await db("user").select(...USER_FIELDS).where({ id }).first();
    if (!user) return null;
    const memberships = await db("member as m")
      .leftJoin("organization as o", "o.id", "m.organizationId")
      .where("m.userId", id)
      .select("o.id as organizationId", "o.name as organizationName", "m.role", "m.createdAt");
    const projects = await db("projects")
      .where({ owner_id: id })
      .select("id", "name", "status", "progress_percent", "created_at")
      .orderBy("created_at", "desc");
    return { ...user, memberships, projects };
  }

  async function updateUser(
    id: string,
    patch: { role?: string; banned?: boolean; banReason?: string | null },
  ) {
    const update: Record<string, unknown> = {};
    if (patch.role !== undefined) update["role"] = patch.role;
    if (patch.banned !== undefined) {
      update["banned"] = patch.banned;
      update["banReason"] = patch.banned ? (patch.banReason ?? null) : null;
      update["banExpires"] = null;
    }
    if (Object.keys(update).length > 0) {
      await db("user").where({ id }).update(update);
    }
    return getUser(id);
  }

  async function deleteUser(id: string) {
    await db("user").where({ id }).del();
  }

  async function listOrganizations(params: ListParams) {
    const base = db("organization");
    if (params.search) {
      const like = `%${params.search}%`;
      base.where((qb) => {
        qb.whereILike("name", like).orWhereILike("slug", like);
      });
    }
    const totalRow = await base.clone().count<{ count: string }[]>("id as count").first();
    const rows = await base
      .clone()
      .select("id", "name", "slug", "logo", "createdAt")
      .orderBy("createdAt", "desc")
      .limit(params.limit)
      .offset(params.offset);

    const ids = rows.map((r) => r.id as string);
    const memberCounts = ids.length
      ? await db("member")
          .whereIn("organizationId", ids)
          .groupBy("organizationId")
          .select("organizationId")
          .count<{ organizationId: string; count: string }[]>("id as count")
      : [];
    const projectCounts = ids.length
      ? await db("projects")
          .whereIn("organization_id", ids)
          .groupBy("organization_id")
          .select("organization_id")
          .count<{ organization_id: string; count: string }[]>("id as count")
      : [];
    const mById = new Map(memberCounts.map((r) => [r.organizationId, Number(r.count)]));
    const pById = new Map(projectCounts.map((r) => [r.organization_id, Number(r.count)]));

    return {
      total: Number(totalRow?.count ?? 0),
      rows: rows.map((r) => ({
        ...r,
        memberCount: mById.get(r.id as string) ?? 0,
        projectCount: pById.get(r.id as string) ?? 0,
      })),
    };
  }

  async function getOrganization(id: string) {
    const org = await db("organization")
      .select("id", "name", "slug", "logo", "metadata", "createdAt", "updatedAt")
      .where({ id })
      .first();
    if (!org) return null;
    const members = await db("member as m")
      .leftJoin("user as u", "u.id", "m.userId")
      .where("m.organizationId", id)
      .select("u.id as userId", "u.name", "u.email", "m.role", "m.createdAt")
      .orderBy("m.createdAt", "asc");
    const projects = await db("projects as p")
      .leftJoin("user as u", "u.id", "p.owner_id")
      .where("p.organization_id", id)
      .select("p.id", "p.name", "p.status", "p.progress_percent", "u.name as ownerName")
      .orderBy("p.created_at", "desc");
    return { ...org, members, projects };
  }

  async function listProjects(params: ListParams) {
    const base = db("projects as p")
      .leftJoin("user as u", "u.id", "p.owner_id")
      .leftJoin("organization as o", "o.id", "p.organization_id");
    if (params.search) {
      const like = `%${params.search}%`;
      base.where((qb) => {
        qb.whereILike("p.name", like).orWhereILike("p.address", like);
      });
    }
    if (params.status) base.where("p.status", params.status);

    const totalRow = await base.clone().count<{ count: string }[]>("p.id as count").first();
    const rows = await base
      .clone()
      .select(
        "p.id",
        "p.name",
        "p.address",
        "p.status",
        "p.risk",
        "p.progress_percent",
        "p.budget_total",
        "p.budget_used",
        "p.currency",
        "p.created_at",
        "u.name as ownerName",
        "u.email as ownerEmail",
        "o.name as organizationName",
      )
      .orderBy("p.created_at", "desc")
      .limit(params.limit)
      .offset(params.offset);
    return { total: Number(totalRow?.count ?? 0), rows };
  }

  async function getProject(id: string) {
    const project = await db("projects as p")
      .leftJoin("user as u", "u.id", "p.owner_id")
      .leftJoin("organization as o", "o.id", "p.organization_id")
      .where("p.id", id)
      .select(
        "p.*",
        "u.name as ownerName",
        "u.email as ownerEmail",
        "o.name as organizationName",
      )
      .first();
    if (!project) return null;

    const finances = await db("project_finances").where({ project_id: id }).first();
    const [insp, docs, acts, upds, risks, logs, miles] = await Promise.all([
      db("inspections").where({ project_id: id }).count<{ count: string }[]>("id as count").first(),
      db("project_documents").where({ project_id: id }).count<{ count: string }[]>("id as count").first(),
      db("activities").where({ project_id: id }).count<{ count: string }[]>("id as count").first(),
      db("project_updates").where({ project_id: id }).count<{ count: string }[]>("id as count").first(),
      db("risk_factors").where({ project_id: id }).count<{ count: string }[]>("id as count").first(),
      db("daily_logs").where({ project_id: id }).count<{ count: string }[]>("project_id as count").first(),
      db("milestone_payments").where({ project_id: id }).count<{ count: string }[]>("id as count").first(),
    ]);
    const n = (v: { count?: string } | undefined) => Number(v?.count ?? 0);
    return {
      ...project,
      finances: finances ?? null,
      counts: {
        inspections: n(insp),
        documents: n(docs),
        activities: n(acts),
        updates: n(upds),
        risks: n(risks),
        dailyLogs: n(logs),
        milestones: n(miles),
      },
    };
  }

  // Generic read-only drill-down for a project's related collection.
  function projectCollection(table: string, projectId: string, orderBy: string, dir: "asc" | "desc" = "desc") {
    return db(table).where({ project_id: projectId }).orderBy(orderBy, dir);
  }

  return {
    overview,
    listUsers,
    getUser,
    updateUser,
    deleteUser,
    listOrganizations,
    getOrganization,
    listProjects,
    getProject,
    projectCollection,
  };
}

export type AdminRepository = ReturnType<typeof adminRepository>;
