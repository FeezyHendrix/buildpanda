import { asc, eq } from "drizzle-orm";
import type { DailyLogTemplate, TemplateField } from "@/api/daily-log-templates";
import type { Db } from "./client";
import { dailyLogTemplates, type DailyLogTemplateRow } from "./schema";

export interface LocalDailyLogTemplate {
  id: string;
  name: string;
  description: string | null;
  scope: DailyLogTemplate["scope"];
  fields: TemplateField[];
  isDefault: boolean;
}

function parseFields(json: string): TemplateField[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as TemplateField[]) : [];
  } catch {
    return [];
  }
}

export function toTemplate(row: DailyLogTemplateRow): LocalDailyLogTemplate {
  return {
    id: row.templateId,
    name: row.name,
    description: row.description,
    scope: row.scope === "organization" ? "organization" : "project",
    fields: parseFields(row.fields),
    isDefault: row.isDefault,
  };
}

/** A project's own default beats the workspace's; with neither there is no default. */
export function defaultTemplate<T extends { isDefault: boolean; scope: string }>(templates: readonly T[]): T | null {
  return (
    templates.find((t) => t.isDefault && t.scope === "project") ??
    templates.find((t) => t.isDefault && t.scope === "organization") ??
    null
  );
}

export const dailyLogTemplatesRepository = {
  listQuery: (db: Db, projectId: string) =>
    db
      .select()
      .from(dailyLogTemplates)
      .where(eq(dailyLogTemplates.projectId, projectId))
      .orderBy(asc(dailyLogTemplates.position)),

  async list(db: Db, projectId: string): Promise<LocalDailyLogTemplate[]> {
    const rows = await dailyLogTemplatesRepository.listQuery(db, projectId);
    return rows.map(toTemplate);
  },

  /** The server list is the whole truth: archived or deleted forms drop out here. */
  async replaceFromServer(db: Db, projectId: string, templates: readonly DailyLogTemplate[]): Promise<void> {
    await db.transaction((tx) => {
      tx.delete(dailyLogTemplates).where(eq(dailyLogTemplates.projectId, projectId)).run();
      templates
        .filter((t) => t.active)
        .forEach((t, position) => {
          tx.insert(dailyLogTemplates).values({
            id: `${projectId}:${t.id}`,
            templateId: t.id,
            projectId,
            name: t.name,
            description: t.description,
            scope: t.scope,
            fields: JSON.stringify(t.fields),
            isDefault: t.isDefault,
            position,
          }).run();
        });
    });
  },
};
