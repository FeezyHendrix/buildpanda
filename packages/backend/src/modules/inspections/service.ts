import { generateId } from "../../lib/ids.ts";
import type { InspectionsRepository } from "./repository.ts";
import type {
  InspectionCategory,
  InspectionMediaRow,
  InspectionReport,
  InspectionRow,
  InspectionStatus,
} from "./types.ts";
import type { MediaItem } from "../updates/types.ts";
import type { RiskLevel } from "../projects/types.ts";
import { NotFoundError, ConflictError } from "../../lib/errors.ts";

export interface RequestInspectionInput {
  title: string;
  category: InspectionCategory;
  description: string;
  scheduledAt: string;
  inspector?: {
    id?: string;
    name: string;
    role: string;
  };
}

export interface EditInspectionInput {
  title?: string;
  category?: InspectionCategory;
  description?: string;
  scheduledAt?: string;
  status?: InspectionStatus;
  riskLevel?: RiskLevel;
  inspector?: {
    id?: string;
    name: string;
    role: string;
  };
}

function toMedia(row: InspectionMediaRow): MediaItem {
  return { id: row.id, type: row.type, url: row.url };
}

function toReport(row: InspectionRow, media: InspectionMediaRow[]): InspectionReport {
  const report: InspectionReport = {
    id: row.id,
    projectId: row.project_id,
    inspector: {
      id: row.inspector_id,
      name: row.inspector_name,
      role: row.inspector_role,
      initialsTone: row.inspector_initials_tone,
      ...(row.inspector_avatar_url ? { avatarUrl: row.inspector_avatar_url } : {}),
    },
    title: row.title,
    category: row.category,
    description: row.description,
    status: row.status,
    riskLevel: row.risk_level,
    scheduledAt: row.scheduled_at,
    media: media.map(toMedia),
  };
  if (row.report_url) report.reportUrl = row.report_url;
  return report;
}

export function inspectionsService(repository: InspectionsRepository) {
  async function loadProjectInspection(
    projectId: string,
    inspectionId: string,
  ): Promise<InspectionRow> {
    const row = await repository.findById(inspectionId);
    if (!row || row.project_id !== projectId) {
      throw new NotFoundError("Inspection");
    }
    return row;
  }

  return {
    async listByProject(projectId: string): Promise<InspectionReport[]> {
      const rows = await repository.listByProject(projectId);
      if (rows.length === 0) return [];
      const media = await repository.mediaForInspections(rows.map((r) => r.id));
      const grouped = new Map<string, InspectionMediaRow[]>();
      for (const m of media) {
        const list = grouped.get(m.inspection_id) ?? [];
        list.push(m);
        grouped.set(m.inspection_id, list);
      }
      return rows.map((row) => toReport(row, grouped.get(row.id) ?? []));
    },

    async request(
      projectId: string,
      input: RequestInspectionInput,
    ): Promise<InspectionReport> {
      const row = await repository.create({
        id: generateId("insp"),
        project_id: projectId,
        inspector_id: input.inspector?.id ?? generateId("person"),
        inspector_name: input.inspector?.name ?? "Pending assignment",
        inspector_role: input.inspector?.role ?? "Independent Inspector",
        inspector_initials_tone: "brand",
        title: input.title,
        category: input.category,
        description: input.description,
        status: "Scheduled",
        risk_level: "Low",
        scheduled_at: input.scheduledAt,
      });
      return toReport(row, []);
    },

    async edit(
      projectId: string,
      inspectionId: string,
      input: EditInspectionInput,
    ): Promise<InspectionReport> {
      await loadProjectInspection(projectId, inspectionId);

      const patch: Parameters<typeof repository.update>[1] = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.category !== undefined) patch.category = input.category;
      if (input.description !== undefined) patch.description = input.description;
      if (input.scheduledAt !== undefined) patch.scheduled_at = input.scheduledAt;
      if (input.status !== undefined) patch.status = input.status;
      if (input.riskLevel !== undefined) patch.risk_level = input.riskLevel;
      if (input.inspector !== undefined) {
        if (input.inspector.id !== undefined) patch.inspector_id = input.inspector.id;
        patch.inspector_name = input.inspector.name;
        patch.inspector_role = input.inspector.role;
      }

      const updated = await repository.update(inspectionId, patch);
      if (!updated) throw new ConflictError("Inspection update failed");
      const media = await repository.mediaForInspections([inspectionId]);
      return toReport(updated, media);
    },

    async remove(projectId: string, inspectionId: string): Promise<void> {
      await loadProjectInspection(projectId, inspectionId);
      await repository.deleteInspection(inspectionId);
    },
  };
}

export type InspectionsService = ReturnType<typeof inspectionsService>;
