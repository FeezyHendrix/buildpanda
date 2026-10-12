import { request } from "./client";

export const TEMPLATE_FIELD_TYPES = ["section", "short_text", "long_text", "number", "select", "yes_no"] as const;
export type TemplateFieldType = (typeof TEMPLATE_FIELD_TYPES)[number];

/** One question on an admin's daily log form; the shape the web builder saves. */
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
  scope: "organization" | "project";
  fields: TemplateField[];
  isDefault: boolean;
  active: boolean;
}

/** Templates are built on the web; the field app only reads the active ones. */
export const dailyLogTemplatesApi = {
  list: (projectId: string) => request<DailyLogTemplate[]>(`/projects/${projectId}/daily-log-templates`),
};
