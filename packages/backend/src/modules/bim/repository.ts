import type { Knex } from "knex";
import type {
  BimCoordinationIssueRow,
  BimElementLinkRow,
  BimElementRecord,
  BimIssueStatus,
  BimLinkType,
  BimModelRow,
  BimModelVersionRow,
  BimVersionStatus,
  BimXktStatus,
} from "./types.ts";

export interface NewBimModelRecord {
  id: string;
  project_id: string;
  name: string;
  discipline: string | null;
  created_by_id: string | null;
}

export interface NewBimVersionRecord {
  id: string;
  bim_model_id: string;
  version: number;
  source_storage_path: string;
  source_file_name: string;
  size_bytes: number | null;
  created_by_id: string | null;
}

const MODEL_SELECT = [
  "m.id",
  "m.project_id",
  "m.name",
  "m.discipline",
  "m.current_version_id",
  "v.status",
  "v.element_count",
  "v.xkt_status",
  "m.created_by_id",
  "m.created_at",
  "m.updated_at",
] as const;

export function bimRepository(db: Knex) {
  function modelBase() {
    return db("bim_models as m").leftJoin(
      "bim_model_versions as v",
      "v.id",
      "m.current_version_id",
    );
  }

  return {
    listModels(projectId: string): Promise<BimModelRow[]> {
      return modelBase()
        .where("m.project_id", projectId)
        .select(...MODEL_SELECT)
        .orderBy("m.created_at", "desc");
    },

    findModelById(id: string): Promise<BimModelRow | undefined> {
      return modelBase().where("m.id", id).select(...MODEL_SELECT).first();
    },

    async createModel(record: NewBimModelRecord): Promise<BimModelRow> {
      await db("bim_models").insert(record);
      const row = await this.findModelById(record.id);
      if (!row) throw new Error("Failed to insert BIM model");
      return row;
    },

    async createVersion(record: NewBimVersionRecord): Promise<BimModelVersionRow> {
      const [row] = await db("bim_model_versions").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert BIM version");
      return row as BimModelVersionRow;
    },

    async setCurrentVersion(modelId: string, versionId: string): Promise<void> {
      await db("bim_models")
        .where({ id: modelId })
        .update({ current_version_id: versionId, updated_at: new Date().toISOString() });
    },

    findVersionById(id: string): Promise<BimModelVersionRow | undefined> {
      return db<BimModelVersionRow>("bim_model_versions").where({ id }).first();
    },

    async nextVersionNumber(modelId: string): Promise<number> {
      const row = await db("bim_model_versions")
        .where({ bim_model_id: modelId })
        .max<{ max: number | null }[]>("version as max")
        .first();
      return (row?.max ?? 0) + 1;
    },

    async markVersionStatus(
      id: string,
      status: BimVersionStatus,
      extra: { failure_reason?: string | null; element_count?: number } = {},
    ): Promise<void> {
      await db("bim_model_versions").where({ id }).update({ status, ...extra });
    },

    async setXktStatus(
      id: string,
      xktStatus: BimXktStatus,
      xktStoragePath: string | null = null,
    ): Promise<void> {
      await db("bim_model_versions")
        .where({ id })
        .update({ xkt_status: xktStatus, xkt_storage_path: xktStoragePath });
    },

    async insertElements(records: BimElementRecord[]): Promise<void> {
      if (records.length === 0) return;
      await db.batchInsert("bim_elements", records, 500);
    },

    listElements(versionId: string): Promise<BimElementRecord[]> {
      return db<BimElementRecord>("bim_elements")
        .where({ model_version_id: versionId })
        .orderBy("ifc_type", "asc");
    },

    listIssues(modelId: string, status?: BimIssueStatus): Promise<BimCoordinationIssueRow[]> {
      const q = db<BimCoordinationIssueRow>("bim_coordination_issues").where({
        bim_model_id: modelId,
      });
      if (status) q.andWhere({ status });
      return q.orderBy("created_at", "desc");
    },

    findIssueById(id: string): Promise<BimCoordinationIssueRow | undefined> {
      return db<BimCoordinationIssueRow>("bim_coordination_issues").where({ id }).first();
    },

    async createIssue(record: {
      id: string;
      bim_model_id: string;
      element_guid: string | null;
      position: unknown;
      title: string;
      description: string | null;
      assignee_id: string | null;
      created_by_id: string | null;
    }): Promise<BimCoordinationIssueRow> {
      const [row] = await db("bim_coordination_issues")
        .insert({ ...record, position: record.position ? JSON.stringify(record.position) : null })
        .returning("*");
      if (!row) throw new Error("Failed to insert coordination issue");
      return row as BimCoordinationIssueRow;
    },

    async updateIssue(
      id: string,
      patch: {
        title?: string;
        description?: string | null;
        status?: BimIssueStatus;
        rfi_id?: string | null;
        assignee_id?: string | null;
        updated_at?: string;
      },
    ): Promise<BimCoordinationIssueRow | undefined> {
      await db("bim_coordination_issues").where({ id }).update(patch);
      return this.findIssueById(id);
    },

    listLinks(modelId: string): Promise<BimElementLinkRow[]> {
      return db<BimElementLinkRow>("bim_element_links")
        .where({ bim_model_id: modelId })
        .orderBy("created_at", "desc");
    },

    async createLink(record: {
      id: string;
      bim_model_id: string;
      element_guid: string;
      link_type: BimLinkType;
      target_id: string;
      target_table: string;
    }): Promise<BimElementLinkRow> {
      const [row] = await db("bim_element_links").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert element link");
      return row as BimElementLinkRow;
    },

    async removeLink(id: string, modelId: string): Promise<void> {
      await db("bim_element_links").where({ id, bim_model_id: modelId }).del();
    },
  };
}

export type BimRepository = ReturnType<typeof bimRepository>;
