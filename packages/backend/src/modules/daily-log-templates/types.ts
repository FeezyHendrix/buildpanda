/**
 * The building blocks of a site diary form. "section" is a heading that groups
 * the questions under it and takes no answer.
 */
export const TEMPLATE_FIELD_TYPES = [
  "section",
  "short_text",
  "long_text",
  "number",
  "select",
  "yes_no",
] as const;
export type TemplateFieldType = (typeof TEMPLATE_FIELD_TYPES)[number];

export const TEMPLATE_SCOPES = ["organization", "project"] as const;
export type TemplateScope = (typeof TEMPLATE_SCOPES)[number];

export const MAX_TEMPLATE_FIELDS = 80;
export const MAX_SELECT_OPTIONS = 40;

export interface TemplateField {
  /** Stable within the template, so an answer stays tied to its question across edits. */
  id: string;
  type: TemplateFieldType;
  label: string;
  helpText: string | null;
  required: boolean;
  /** select only. */
  options: string[];
  /** number only — "workers", "m³", "hrs". */
  unit: string | null;
}

export type TemplateAnswer = string | number | boolean | null;
export type TemplateResponses = Record<string, TemplateAnswer>;

export interface DailyLogTemplateRow {
  id: string;
  organization_id: string | null;
  project_id: string | null;
  name: string;
  description: string | null;
  fields: TemplateField[];
  is_default: boolean;
  active: boolean;
  created_by_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DailyLogTemplate {
  id: string;
  name: string;
  description: string | null;
  scope: TemplateScope;
  fields: TemplateField[];
  isDefault: boolean;
  active: boolean;
  /** Entries filled against it — a template in use is archived, never deleted. */
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateOwner {
  projectId: string;
  organizationId: string | null;
}

export interface TemplateFieldInput {
  id?: string;
  type: TemplateFieldType;
  label: string;
  helpText?: string | null;
  required?: boolean;
  options?: string[];
  unit?: string | null;
}

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  scope?: TemplateScope;
  fields: TemplateFieldInput[];
  isDefault?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  fields?: TemplateFieldInput[];
  isDefault?: boolean;
  active?: boolean;
}

/** A filled form, ready to be stored on a diary entry. */
export interface FilledTemplate {
  templateId: string;
  templateName: string;
  fields: TemplateField[];
  responses: TemplateResponses;
  html: string;
  text: string;
}
