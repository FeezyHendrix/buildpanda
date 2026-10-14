import type { Knex } from "knex";
import { logger } from "../../../lib/logger.ts";
import { normaliseResponses, renderResponses } from "../../daily-log-templates/form.ts";
import type { TemplateField, TemplateResponses } from "../../daily-log-templates/types.ts";
import type { DailyLogPayload, MissingField, ProjectSnapshot, SnapshotDailyLogForm } from "./types.ts";

/**
 * Voice filling of the daily log form an admin built on the web. The model is
 * shown the project's default form and answers its questions from the speech;
 * everything it returns is checked against that form here, and a required
 * question nobody spoke to comes back as a field for the reviewer to fill.
 */

/** Prefix for a form answer collected on the review screen. */
export const RESPONSE_FIELD_PREFIX = "response:";

interface TemplatePick {
  id: string;
  name: string;
  fields: TemplateField[];
}

/** The project's own default form, else the workspace's; null when neither exists. */
export async function loadDefaultForm(db: Knex, projectId: string): Promise<SnapshotDailyLogForm | null> {
  const row = await db<TemplatePick & { project_id: string | null }>("daily_log_templates")
    .where({ active: true, is_default: true })
    .andWhere((q) =>
      q
        .where("project_id", projectId)
        .orWhere("organization_id", db("projects").select("organization_id").where("id", projectId)),
    )
    .orderByRaw("project_id IS NULL")
    .first("id", "name", "fields")
    // the form is an extra: a failed lookup must not cost the crew the whole voice note
    .catch((error: unknown) => {
      logger.warn({ err: error, projectId }, "voice-report: daily log form lookup failed");
      return undefined;
    });
  return row ? { id: row.id, name: row.name, fields: row.fields } : null;
}

export function formPrompt(form: SnapshotDailyLogForm | null): string[] {
  if (!form) return [];
  const lines = [
    "",
    `DAILY LOG FORM "${form.name}" (templateId ${form.id}). When the speaker reports on their day, the daily_log action fills this form:`,
    'payload { templateId, responses: { "<question id>": answer }, bodyText }. Key every answer by the question id shown before',
    'the question (e.g. "weather"), never by its label. Answer only questions the speaker actually addressed;',
    "leave the rest out. number answers are plain numbers, yes_no answers are true/false, select answers must be one of the listed options.",
    "bodyText holds anything said about the day that no question covers (empty string if nothing).",
  ];
  for (const field of form.fields) {
    if (field.type === "section") {
      lines.push(`  [${field.label}]`);
      continue;
    }
    const extra = field.type === "select" ? ` options: ${field.options.join(" | ")}` : field.unit ? ` unit: ${field.unit}` : "";
    lines.push(`  - id "${field.id}" (${field.type}${field.required ? ", required" : ""}): ${field.label}${extra}`);
  }
  return lines;
}

/**
 * Keeps answers that fit their question; a wrong type or unknown option is
 * dropped, not guessed at. Models sometimes key answers by the question's label
 * instead of its id, so a label (any case) finds its question too.
 */
function lenientResponses(fields: TemplateField[], raw: TemplateResponses): TemplateResponses {
  const byKey = new Map<string, TemplateField>();
  for (const field of fields) {
    if (field.type === "section") continue;
    byKey.set(field.label.trim().toLowerCase(), field);
    byKey.set(field.id.toLowerCase(), field);
  }
  const out: TemplateResponses = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = byKey.get(key.trim().toLowerCase());
    if (!field || value === undefined || field.id in out) continue;
    try {
      Object.assign(out, normaliseResponses([{ ...field, required: false }], { [field.id]: value }));
    } catch {
      // not a usable answer for this question
    }
  }
  return out;
}

/** What the model sent, before checking: responses may be null. */
type SpokenDailyLog = Omit<DailyLogPayload, "responses"> & { responses?: TemplateResponses | null };

export function normalizeDailyLogForm(payload: SpokenDailyLog, snapshot: ProjectSnapshot): DailyLogPayload {
  const form = snapshot.dailyLogForm;
  if (!form || payload.templateId !== form.id) {
    return { buildingId: payload.buildingId, bodyText: payload.bodyText };
  }
  const responses = lenientResponses(form.fields, payload.responses ?? {});
  return {
    buildingId: payload.buildingId,
    bodyText: payload.bodyText,
    templateId: form.id,
    templateName: form.name,
    templateFields: form.fields,
    responses,
    formText: renderResponses(form.fields, responses).text,
  };
}

export function formReviewFields(payload: DailyLogPayload, snapshot: ProjectSnapshot): MissingField[] {
  const form = snapshot.dailyLogForm;
  if (!form || payload.templateId !== form.id) return [];
  return form.fields
    .filter((f) => f.type !== "section")
    .map((f): MissingField => {
      const name = `${RESPONSE_FIELD_PREFIX}${f.id}`;
      const common = { name, required: f.required, helpText: f.helpText ?? undefined };
      if (f.type === "number") return { ...common, label: f.unit ? `${f.label} (${f.unit})` : f.label, type: "number" };
      if (f.type === "select") return { ...common, label: f.label, type: "select", options: f.options.map((o) => ({ value: o, label: o })) };
      if (f.type === "yes_no") return { ...common, label: f.label, type: "boolean" };
      return { ...common, label: f.label, type: f.type === "long_text" ? "long_text" : "text" };
    });
}
