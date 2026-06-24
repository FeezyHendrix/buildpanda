import type { Knex } from "knex";
import type {
  InspectionCategory,
  InspectionMediaRow,
  InspectionRow,
  InspectionStatus,
} from "./types.ts";
import type { RiskLevel, Tone } from "../projects/types.ts";

export interface NewInspectionRecord {
  id: string;
  project_id: string;
  inspector_id: string;
  inspector_name: string;
  inspector_role: string;
  inspector_initials_tone: Tone;
  title: string;
  category: InspectionCategory;
  description: string;
  description_html: string | null;
  status: InspectionStatus;
  risk_level: RiskLevel;
  scheduled_at: string;
}

export interface InspectionUpdatePatch {
  inspector_id?: string;
  inspector_name?: string;
  inspector_role?: string;
  title?: string;
  category?: InspectionCategory;
  description?: string;
  description_html?: string | null;
  status?: InspectionStatus;
  risk_level?: RiskLevel;
  scheduled_at?: string;
}

export function inspectionsRepository(db: Knex) {
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

    async deleteInspection(id: string): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("inspection_media").where({ inspection_id: id }).del();
        await trx("inspections").where({ id }).del();
      });
    },
  };
}

export type InspectionsRepository = ReturnType<typeof inspectionsRepository>;
