import api from "./client";

export const TEMPLATE_FIELD_TYPES = [
  "section",
  "short_text",
  "long_text",
  "number",
  "select",
  "yes_no",
] as const;
export type TemplateFieldType = (typeof TEMPLATE_FIELD_TYPES)[number];

export type TemplateScope = "organization" | "project";

export interface TemplateField {
  id: string;
  type: TemplateFieldType;
  label: string;
  helpText: string | null;
  required: boolean;
  options: string[];
  unit: string | null;
}

export type TemplateAnswer = string | number | boolean | null;
export type TemplateResponses = Record<string, TemplateAnswer>;

export interface DailyLogTemplate {
  id: string;
  name: string;
  description: string | null;
  scope: TemplateScope;
  fields: TemplateField[];
  isDefault: boolean;
  active: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

/** A field as the builder sends it; the server assigns ids to new fields. */
export type TemplateFieldInput = Omit<TemplateField, "id"> & { id?: string };

export interface CreateDailyLogTemplateInput {
  name: string;
  description?: string | null;
  scope?: TemplateScope;
  fields: TemplateFieldInput[];
  isDefault?: boolean;
}

export type UpdateDailyLogTemplateInput = Partial<Omit<CreateDailyLogTemplateInput, "scope">> & {
  active?: boolean;
};

export const dailyLogTemplatesApi = {
  list: (projectId: string, includeArchived = false) =>
    api
      .get<DailyLogTemplate[]>(`/projects/${projectId}/daily-log-templates`, {
        params: includeArchived ? { includeArchived } : undefined,
      })
      .then((r) => r.data),

  create: (projectId: string, body: CreateDailyLogTemplateInput) =>
    api.post<DailyLogTemplate>(`/projects/${projectId}/daily-log-templates`, body).then((r) => r.data),

  update: (projectId: string, templateId: string, body: UpdateDailyLogTemplateInput) =>
    api
      .patch<DailyLogTemplate>(`/projects/${projectId}/daily-log-templates/${templateId}`, body)
      .then((r) => r.data),

  remove: (projectId: string, templateId: string) =>
    api
      .delete<{ archived: boolean }>(`/projects/${projectId}/daily-log-templates/${templateId}`)
      .then((r) => r.data),
};
