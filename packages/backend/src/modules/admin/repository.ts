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
  "signup_ip as signupIp",
  "signup_country as signupCountry",
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
      unassignedLeads,
      importJobs,
      failedImportJobs,
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
          released: "amount_paid_to_date",
        })
        .first(),
      db("leads").whereNull("org_id").count<{ count: string }[]>("id as count").first(),
      db
        .from(
          db
            .unionAll(
              [
                db("programme_import_jobs").select("id"),
                db("boq_import_jobs").select("id"),
              ],
              true,
            )
            .as("all_jobs"),
        )
        .count<{ count: string }[]>("id as count")
        .first(),
      db
        .from(
          db
            .unionAll(
              [
                db("programme_import_jobs").where({ status: "failed" }).select("id"),
                db("boq_import_jobs").where({ status: "failed" }).select("id"),
              ],
              true,
            )
            .as("failed_jobs"),
        )
        .count<{ count: string }[]>("id as count")
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
        unassignedLeads: num(unassignedLeads),
        importJobs: num(importJobs),
        failedImportJobs: num(failedImportJobs),
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
      .select("id", "name", "slug", "logo", "metadata", "default_currency", "createdAt", "updatedAt")
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

  // --- Leads ---

  async function listLeads(params: ListParams) {
    const base = db("leads as l").leftJoin("organization as o", "o.id", "l.org_id");
    if (params.search) {
      const like = `%${params.search}%`;
      base.where((qb) => {
        qb.whereILike("l.name", like).orWhereILike("l.email", like);
      });
    }
    if (params.status) base.where("l.status", params.status);
    const totalRow = await base.clone().count<{ count: string }[]>("l.id as count").first();
    const rows = await base
      .clone()
      .select(
        "l.id",
        "l.org_id",
        "l.name",
        "l.email",
        "l.phone",
        "l.location",
        "l.project_type",
        "l.source",
        "l.status",
        "l.created_at",
        "o.name as organizationName",
      )
      .orderBy("l.created_at", "desc")
      .limit(params.limit)
      .offset(params.offset);
    return { total: Number(totalRow?.count ?? 0), rows };
  }

  async function assignLead(leadId: string, orgId: string, adoptedBy: string) {
    const org = await db("organization").where({ id: orgId }).first();
    if (!org) return null;
    await db("leads").where({ id: leadId }).update({
      org_id: orgId,
      adopted_by: adoptedBy,
      adopted_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
    const lead = await db("leads as l")
      .leftJoin("organization as o", "o.id", "l.org_id")
      .where("l.id", leadId)
      .select("l.*", "o.name as organizationName")
      .first();
    return lead ?? null;
  }

  async function listImportJobs(params: ListParams) {
    const programme = db("programme_import_jobs as j")
      .leftJoin("user as u", "u.id", "j.requested_by")
      .leftJoin("organization as o", "o.id", "j.organization_id")
      .select(
        "j.id",
        db.raw("'programme' as kind"),
        "j.status",
        "j.file_name as fileName",
        "j.used_ai as usedAi",
        "j.error",
        "j.created_at as createdAt",
        "j.updated_at as updatedAt",
        "u.name as requestedByName",
        "u.email as requestedByEmail",
        "o.name as organizationName",
        db.raw("j.activity_count as item_count"),
      );
    const boq = db("boq_import_jobs as j")
      .leftJoin("projects as p", "p.id", "j.project_id")
      .leftJoin("user as u", "u.id", "j.requested_by")
      .select(
        "j.id",
        db.raw("'boq' as kind"),
        "j.status",
        "j.file_name as fileName",
        "j.used_ai as usedAi",
        "j.error",
        "j.created_at as createdAt",
        "j.updated_at as updatedAt",
        "u.name as requestedByName",
        "u.email as requestedByEmail",
        "p.name as organizationName",
        db.raw("j.material_count as item_count"),
      );

    if (params.status) {
      programme.where("j.status", params.status);
      boq.where("j.status", params.status);
    }
    if (params.search) {
      const like = `%${params.search}%`;
      programme.whereILike("j.file_name", like);
      boq.whereILike("j.file_name", like);
    }

    const union = db
      .unionAll([programme, boq], true)
      .as("jobs");
    const base = db.from(union);

    const totalRow = await base.clone().count<{ count: string }[]>("id as count").first();
    const rows = await base
      .clone()
      .select("*")
      .orderBy("createdAt", "desc")
      .limit(params.limit)
      .offset(params.offset);
    return { total: Number(totalRow?.count ?? 0), rows };
  }

  async function getImportJob(kind: string, id: string) {
    const table = kind === "boq" ? "boq_import_jobs" : "programme_import_jobs";
    const job = await db(table).where({ id }).first();
    return job ?? null;
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
    listLeads,
    assignLead,
    listImportJobs,
    getImportJob,
  };
}

export type AdminRepository = ReturnType<typeof adminRepository>;
