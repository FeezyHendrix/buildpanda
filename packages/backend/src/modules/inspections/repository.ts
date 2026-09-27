import type { Knex } from "knex";
import { PARTICIPANT_PERMISSIONS } from "../../lib/role-presets.ts";
import { generateId } from "../../lib/ids.ts";
import type {
  AdminInspectionListParams,
  AdminInspectionRow,
  InspectionMediaRow,
  InspectionOutcome,
  InspectionRow,
  InspectionStatus,
  InspectorUser,
  RequesterSide,
  ServiceStatus,
} from "./types.ts";
import type { RiskLevel, Tone } from "../projects/types.ts";

export interface NewInspectionRecord {
  category_id?: string | null;
  id: string;
  project_id: string;
  inspector_id: string;
  inspector_name: string;
  inspector_role: string;
  inspector_initials_tone: Tone;
  inspector_user_id: string | null;
  title: string;
  category: string;
  description: string;
  description_html: string | null;
  status: InspectionStatus;
  service_status: ServiceStatus;
  risk_level: RiskLevel;
  scheduled_at: string;
  activity_id: string | null;
  location: string | null;
  hold_point: boolean;
  requested_by_id: string | null;
  requested_by_side: RequesterSide;
  contractor_name: string | null;
  fee_amount: number | null;
  fee_currency: string | null;
}

export interface InspectionUpdatePatch {
  category_id?: string | null;
  cancellation_reason?: string | null;
  inspector_id?: string;
  inspector_name?: string;
  inspector_role?: string;
  inspector_user_id?: string | null;
  title?: string;
  category?: string;
  description?: string;
  description_html?: string | null;
  status?: InspectionStatus;
  service_status?: ServiceStatus;
  risk_level?: RiskLevel;
  scheduled_at?: string;
  activity_id?: string | null;
  location?: string | null;
  hold_point?: boolean;
  outcome?: InspectionOutcome | null;
  findings?: string | null;
  reinspection_date?: string | null;
  inspected_at?: Date | null;
  inspected_by_id?: string | null;
  inspected_by_name?: string | null;
  contractor_name?: string | null;
  report_issued_at?: Date | null;
  fee_amount?: number | null;
  fee_currency?: string | null;
}

/** The project facts an inspection request inherits: who owns it, who builds it. */
export interface ProjectSubject {
  owner_id: string | null;
  contractor_entity: string | null;
  currency: string | null;
}

/** What an assigned inspector needs on the job: read it, and report on it. */
const INSPECTOR_GRANTS = { inspections: ["view", "request", "manage"] } as const;

const ADMIN_COLUMNS = [
  "inspections.*",
  "projects.name as project_name",
  "projects.organization_id as organization_id",
  "organization.name as organization_name",
  "requester.name as requested_by_name",
  "inspector.name as inspector_user_name",
] as const;

export function inspectionsRepository(db: Knex) {
  function adminQuery() {
    return db("inspections")
      .leftJoin("projects", "projects.id", "inspections.project_id")
      .leftJoin("organization", "organization.id", "projects.organization_id")
      .leftJoin("user as requester", "requester.id", "inspections.requested_by_id")
      .leftJoin("user as inspector", "inspector.id", "inspections.inspector_user_id");
  }

  function applyAdminFilters(
    query: Knex.QueryBuilder,
    params: AdminInspectionListParams,
  ): Knex.QueryBuilder {
    if (params.serviceStatus) query.where("inspections.service_status", params.serviceStatus);
    if (params.unassigned) query.whereNull("inspections.inspector_user_id");
    if (params.search) {
      const like = `%${params.search}%`;
      query.where((builder) => {
        builder
          .whereILike("inspections.title", like)
          .orWhereILike("inspections.contractor_name", like)
          .orWhereILike("projects.name", like);
      });
    }
    return query;
  }

  return {
    listByProject(projectId: string): Promise<InspectionRow[]> {
      return db<InspectionRow>("inspections")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc");
    },

    findById(id: string): Promise<InspectionRow | undefined> {
      return db<InspectionRow>("inspections").where({ id }).first();
    },

    async projectOwnerId(projectId: string): Promise<string | null> {
      const row = await db<{ owner_id: string | null }>("projects")
        .where({ id: projectId })
        .select("owner_id")
        .first();
      return row?.owner_id ?? null;
    },

    /** The contractor entity a request defaults to naming as its subject. */
    projectSubject(projectId: string): Promise<ProjectSubject | undefined> {
      return db("projects")
        .where({ id: projectId })
        .first<ProjectSubject | undefined>("owner_id", "contractor_entity", "currency");
    },

    userById(id: string): Promise<InspectorUser | undefined> {
      return db("user")
        .where({ id })
        .first<InspectorUser | undefined>("id", "name", "email");
    },

    /**
     * An assigned inspector must actually be able to open the job they are
     * inspecting, so assignment attaches them to the project as a consultant
     * participant. Membership is additive: an existing participant keeps their
     * role and simply gains the inspection grants.
     */
    async attachInspectorToProject(
      projectId: string,
      user: InspectorUser,
    ): Promise<void> {
      const existing = await db("project_participants")
        .where({ project_id: projectId, user_id: user.id })
        .first<{ id: string; grants: Record<string, string[]> | null } | undefined>("id", "grants");
      const now = new Date();
      if (existing) {
        await db("project_participants")
          .where({ id: existing.id })
          .update({
            status: "active",
            grants: JSON.stringify({ ...(existing.grants ?? {}), ...INSPECTOR_GRANTS }),
            updated_at: now,
          });
        return;
      }
      await db("project_participants").insert({
        id: generateId("pp"),
        project_id: projectId,
        user_id: user.id,
        email: user.email,
        name: user.name,
        role: "inspector",
        side: "consultant",
        status: "active",
        grants: JSON.stringify({ ...PARTICIPANT_PERMISSIONS["inspector"], ...INSPECTOR_GRANTS }),
        created_at: now,
        updated_at: now,
      });
    },

    mediaForInspections(inspectionIds: string[]): Promise<InspectionMediaRow[]> {
      if (inspectionIds.length === 0) return Promise.resolve([]);
      return db<InspectionMediaRow>("inspection_media")
        .whereIn("inspection_id", inspectionIds)
        .orderBy([
          { column: "inspection_id", order: "asc" },
          { column: "sort_order", order: "asc" },
        ]);
    },

    async create(record: NewInspectionRecord): Promise<InspectionRow> {
      const [row] = await db<InspectionRow>("inspections").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert inspection");
      return row;
    },

    async update(
      id: string,
      patch: InspectionUpdatePatch,
    ): Promise<InspectionRow | undefined> {
      const [row] = await db<InspectionRow>("inspections")
        .where({ id })
        .update(patch)
        .returning("*");
      return row;
    },

    /** Photos attached to an inspection outcome, appended after the existing ones. */
    async addMedia(records: InspectionMediaRow[]): Promise<void> {
      if (records.length === 0) return;
      await db("inspection_media").insert(records);
    },

    async maxMediaOrder(inspectionId: string): Promise<number> {
      const row = await db("inspection_media")
        .where({ inspection_id: inspectionId })
        .max<{ max: number | null }[]>("sort_order as max")
        .first();
      return row?.max ?? 0;
    },

    /** The activity a hold point sits on, so the service can warn if it has not started. */
    async activityProgress(
      activityId: string,
    ): Promise<{ id: string; name: string; status: string; actual_start_at: Date | string | null } | undefined> {
      return db("activities")
        .where({ id: activityId })
        .first<{ id: string; name: string; status: string; actual_start_at: Date | string | null } | undefined>(
          "id",
          "name",
          "status",
          "actual_start_at",
        );
    },

    /** BuildPanda's cross-project queue of service orders. */
    adminList(params: AdminInspectionListParams): Promise<AdminInspectionRow[]> {
      return applyAdminFilters(adminQuery(), params)
        .orderBy("inspections.created_at", "desc")
        .limit(params.limit)
        .offset(params.offset)
        .select(...ADMIN_COLUMNS) as unknown as Promise<AdminInspectionRow[]>;
    },

    async adminCount(params: AdminInspectionListParams): Promise<number> {
      const row = await applyAdminFilters(adminQuery(), params)
        .count<{ count: string }[]>("inspections.id as count")
        .first();
      return Number(row?.count ?? 0);
    },

    async adminFindById(id: string): Promise<AdminInspectionRow | undefined> {
      return adminQuery()
        .where("inspections.id", id)
        .first(...ADMIN_COLUMNS) as unknown as Promise<AdminInspectionRow | undefined>;
    },

    async deleteInspection(id: string): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("inspection_media").where({ inspection_id: id }).del();
        await trx("inspections").where({ id }).del();
      });
    },
  };
}

export type InspectionsRepository = ReturnType<typeof inspectionsRepository>;
