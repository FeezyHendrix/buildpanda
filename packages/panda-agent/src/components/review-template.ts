import type { ToolCatalog, ToolDescriptor, ToolField, ToolSchema } from "../api/tool-types";

const schemas = new WeakMap<ToolDescriptor, WeakMap<object, ToolDescriptor>>();

/** The selected backend form supplies its own question IDs, types and required answers. */
export function templateReview(tool: ToolDescriptor, payload: Record<string, unknown>, catalog: ToolCatalog): ToolDescriptor | undefined {
  if (tool.kind !== "daily_log" || typeof payload.templateId !== "string" || !payload.templateId) return tool;
  const targets = catalog.targets ?? {};
  const options = (targets.voiceOptions as Record<string, unknown> | undefined)?.templates ?? (targets.options as Record<string, unknown> | undefined)?.templates ?? targets.templates;
  const template = Array.isArray(options) ? options.find((value) => value && typeof value === "object" && (value.value === payload.templateId || value.id === payload.templateId)) : undefined;
  if (!template || !Array.isArray(template.fields)) return undefined;
  const cached = schemas.get(tool)?.get(template);
  if (cached) return cached;
  const properties: Record<string, ToolSchema> = Object.create(null), required: string[] = [], hints: ToolField[] = [];
  let section = "";
  for (const item of template.fields) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || ["__proto__", "prototype", "constructor"].includes(item.id) || typeof item.type !== "string" || typeof item.label !== "string") return undefined;
    if (item.type === "section") { section = item.label; continue; }
    const type = item.type === "number" ? "number" : item.type === "yes_no" ? "boolean" : ["short_text", "long_text", "select"].includes(item.type) ? "string" : undefined;
    if (!type || (item.type === "select" && (!Array.isArray(item.options) || item.options.some((choice: unknown) => typeof choice !== "string")))) return undefined;
    properties[item.id] = { type: item.required ? type : [type, "null"], ...(type === "string" ? { maxLength: 20000, ...(item.required ? { minLength: 1 } : {}) } : {}), ...(item.type === "select" ? { enum: item.options } : {}) };
    if (item.required === true) required.push(item.id);
    hints.push({ name: `responses.${item.id}`, label: `${section ? `${section} · ` : ""}${item.label}${typeof item.unit === "string" && item.unit ? ` (${item.unit})` : ""}`, type: item.type === "long_text" ? "long_text" : item.type === "select" ? "select" : type === "number" ? "number" : type === "boolean" ? "boolean" : "text", helpText: typeof item.helpText === "string" ? item.helpText : undefined });
  }
  const reviewed = { ...tool, schema: { ...tool.schema, required: [...new Set([...(tool.schema.required ?? []), "responses"])], properties: { ...tool.schema.properties,
    responses: { type: "object", properties, required, additionalProperties: false, minProperties: 1 },
  } }, fields: [...tool.fields, ...hints] };
  const cache = schemas.get(tool) ?? new WeakMap<object, ToolDescriptor>();
  cache.set(template, reviewed); schemas.set(tool, cache);
  return reviewed;
}
