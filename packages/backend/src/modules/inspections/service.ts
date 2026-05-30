import { generateId } from "../../lib/ids.ts";
import type { InspectionsRepository } from "./repository.ts";
import type {
  InspectionCategory,
  InspectionMediaRow,
  InspectionReport,
  InspectionRow,
} from "./types.ts";
import type { MediaItem } from "../updates/types.ts";

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
  };
}

export type InspectionsService = ReturnType<typeof inspectionsService>;
