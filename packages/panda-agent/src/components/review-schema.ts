import Ajv, { type ValidateFunction } from "ajv";
import type { ToolCatalog, ToolDescriptor, ToolField, ToolOption, ToolSchema } from "../api/tool-types";
import type { AgentSession, ProposalAction } from "../api/agent";
import { templateReview } from "./review-template";

const ajv = new Ajv({ strict: false, allErrors: true, removeAdditional: false, coerceTypes: false, useDefaults: false });
const validators = new WeakMap<object, ValidateFunction>();
const controls = new Set(["text", "long_text", "rich_text", "boolean", "number", "date", "select", "file"]);
const types = new Set(["object", "array", "string", "number", "integer", "boolean", "null"]);
ajv.addFormat("email", /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
ajv.addFormat("date", (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
ajv.addKeyword({ keyword: "x-decimalPlaces", type: "number", schemaType: "number", errors: false, validate: (scale: number, value: number) => {
  const [mantissa = "", exponent = "0"] = Math.abs(value).toString().toLowerCase().split("e");
  const places = Math.max(0, (mantissa.split(".")[1]?.length ?? 0) - Number(exponent));
  return Number.isInteger(scale) && scale >= 0 && Number.isFinite(value) && places <= scale;
} });

export function titleCase(name: string) {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export function schemaTypes(schema: ToolSchema): string[] {
  return typeof schema.type === "string" ? [schema.type] : schema.type ?? [];
}

export function supportedSchema(schema: ToolSchema): boolean {
  if (!schema || typeof schema !== "object" || schema.$ref || schema.patternProperties) return false;
  const declared = schemaTypes(schema);
  if (!declared.length && !schema.properties && (schema.oneOf || schema.anyOf)) return (schema.oneOf ?? schema.anyOf)!.every(supportedSchema);
  if (!declared.length && schema.const === undefined && !schema.enum) return false;
  if (declared.some((type) => !types.has(type))) return false;
  if (schema.additionalProperties === true) return false;
  if (declared.includes("object") && Object.values(schema.properties ?? {}).some((field) => !supportedSchema(field))) return false;
  if (schema.additionalProperties && typeof schema.additionalProperties === "object" && !supportedSchema(schema.additionalProperties)) return false;
  if (declared.includes("array") && (!schema.items || !supportedSchema(schema.items))) return false;
  return true;
}

export function reviewTool(action: ProposalAction, catalog: ToolCatalog | undefined): ToolDescriptor | undefined {
  const descriptor = catalog?.tools.find((tool) => tool.kind === action.kind);
  const tool = descriptor && catalog ? templateReview(descriptor, action.payload, catalog) : undefined;
  return tool && supportedSchema(tool.schema) && tool.fields.every((field) => controls.has(field.type)) ? tool : undefined;
}

export function reviewIssues(schema: ToolSchema, payload: unknown): string[] {
  try {
    let validate = validators.get(schema);
    if (!validate) { validate = ajv.compile(schema); validators.set(schema, validate); }
    if (validate(payload)) return [];
    return (validate.errors ?? []).slice(0, 8).map((issue) => `${issue.instancePath.replaceAll("/", " · ").trim() || "Action"} ${issue.keyword === "x-decimalPlaces" ? "has too many decimal places" : issue.message}`);
  } catch { return ["These action fields cannot be validated. Refresh the available tools before continuing."]; }
}

export function knownAction(action: ProposalAction, session: AgentSession): boolean {
  if (session.capabilities?.actions) return session.capabilities.actions[action.kind] === true;
  if (session.capabilities?.capture !== true) return false;
  if (action.kind === "daily_log" || action.kind === "update_daily_log") return session.capabilities.dailyLogCreate === true;
  if (action.kind === "material_log") return session.capabilities.materialReceipt === true || session.capabilities.materialUsage === true;
  return false;
}

export function allowedAction(action: ProposalAction, session: AgentSession): boolean {
  if (!knownAction(action, session)) return false;
  return action.kind !== "material_log" || (action.payload.entryType === "IN" ? session.capabilities.materialReceipt === true : action.payload.entryType === "USED" && session.capabilities.materialUsage === true);
}

export function fieldHint(fields: ToolField[], path: string): ToolField | undefined {
  return fields.find((field) => field.name === path) ?? fields.find((field) => field.name === path.replace(/\.\d+(?=\.|$)/g, "[]"));
}

export function sourcedHint(hint: ToolField | undefined, parent: Record<string, unknown>): ToolField | undefined {
  if (!hint?.sourceBy) return hint;
  const value = parent[hint.sourceBy.field];
  return { ...hint, source: typeof value === "string" ? hint.sourceBy.sources[value] ?? "__unavailable__" : "__unavailable__" };
}

export function reviewActionIssues(tool: ToolDescriptor, payload: unknown, catalog: ToolCatalog): string[] {
  const issues = reviewIssues(tool.schema, payload);
  function parents(value: unknown, parts: string[]): Record<string, unknown>[] {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const record = value as Record<string, unknown>;
    if (parts.length === 1) return [record];
    const [part = "", ...rest] = parts;
    if (part.endsWith("[]")) {
      const rows = record[part.slice(0, -2)];
      return Array.isArray(rows) ? rows.flatMap((row) => parents(row, rest)) : [];
    }
    return parents(record[part], rest);
  }
  for (const field of tool.fields.filter((hint) => hint.sourceBy)) {
    const path = field.name.split("."), key = path.at(-1)!;
    for (const parent of parents(payload, path)) {
      const selected = parent[key];
      if (selected != null && selected !== "" && !toolOptions(catalog, sourcedHint(field, parent)?.source).some((option) => option.value === selected)) {
        issues.push(`${field.label} must match the selected ${field.sourceBy!.field}. Choose an authorized option.`);
      }
    }
  }
  return issues;
}

export function toolOptions(catalog: ToolCatalog, source: string | undefined): ToolOption[] {
  if (!source) return [];
  const targets = catalog.targets ?? {};
  const group = (targets.voiceOptions as Record<string, unknown> | undefined)?.[source] ?? (targets.options as Record<string, unknown> | undefined)?.[source] ?? targets[source];
  if (!Array.isArray(group)) return [];
  return group.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    const id = typeof item.value === "string" ? item.value : typeof item.id === "string" ? item.id : undefined;
    const label = typeof item.label === "string" ? item.label : typeof item.fileName === "string" ? item.fileName : typeof item.name === "string" ? item.name : undefined;
    return id && label ? [{ value: id, label,
      ...(typeof item.parentId === "string" ? { parentId: item.parentId } : {}),
      ...(typeof item.buildingId === "string" ? { buildingId: item.buildingId } : {}),
      ...(typeof item.versionId === "string" ? { versionId: item.versionId } : {}),
    }] : [];
  });
}

export function initialValue(schema: ToolSchema): unknown {
  if (schema.const !== undefined) return schema.const;
  const type = schemaTypes(schema).find((value) => value !== "null");
  if (type === "object") return Object.fromEntries(Object.entries(schema.properties ?? {}).filter(([, field]) => field.const !== undefined).map(([key, field]) => [key, field.const]));
  return type === "array" ? [] : type === "string" ? "" : null;
}

export function selectedVariant(variants: ToolSchema[], value: unknown): number {
  return variants.findIndex((variant) => {
    if (variant.const !== undefined) return variant.const === value;
    const constants = Object.entries(variant.properties ?? {}).filter(([, field]) => field.const !== undefined);
    if (constants.length) return value && typeof value === "object" && constants.every(([key, field]) => (value as Record<string, unknown>)[key] === field.const);
    return schemaTypes(variant).some((type) => type === "null" ? value === null : type === "array" ? Array.isArray(value) : type === "integer" ? typeof value === "number" && Number.isInteger(value) : typeof value === type);
  });
}

export function htmlMirror(properties: Record<string, ToolSchema>, key: string, hint?: ToolField): string | undefined {
  const sibling = hint?.htmlField?.split(".").at(-1);
  if (sibling && properties[sibling]) return sibling;
  const candidates = key === "bodyText" ? ["bodyHtml"] : key === "body" ? ["bodyHtml", "contentHtml"] : key === "reason" ? ["notesHtml"] : [`${key}Html`];
  return candidates.find((field) => properties[field]);
}
