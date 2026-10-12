import { ValidationError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import {
  MAX_SELECT_OPTIONS,
  MAX_TEMPLATE_FIELDS,
  type TemplateAnswer,
  type TemplateField,
  type TemplateFieldInput,
  type TemplateResponses,
} from "./types.ts";

/**
 * Pure form logic shared by the template service (defining a form) and the
 * daily-log service (filling one). No I/O here.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** Trims, drops blanks, gives new fields an id, and rejects a form nobody could fill. */
export function normaliseFields(input: TemplateFieldInput[]): TemplateField[] {
  if (input.length > MAX_TEMPLATE_FIELDS) {
    throw new ValidationError(`A template can hold at most ${MAX_TEMPLATE_FIELDS} fields`);
  }
  const seen = new Set<string>();
  const fields = input.map((field, index): TemplateField => {
    const label = clean(field.label);
    if (!label) throw new ValidationError(`Field ${index + 1} needs a label`);
    const id = clean(field.id) ?? generateId("tf");
    if (seen.has(id)) throw new ValidationError(`Field "${label}" is listed twice`);
    seen.add(id);

    const options =
      field.type === "select"
        ? [...new Set((field.options ?? []).map((o) => o.trim()).filter(Boolean))]
        : [];
    if (field.type === "select" && options.length === 0) {
      throw new ValidationError(`"${label}" is a dropdown — give it at least one option`);
    }
    if (options.length > MAX_SELECT_OPTIONS) {
      throw new ValidationError(`"${label}" can have at most ${MAX_SELECT_OPTIONS} options`);
    }

    return {
      id,
      type: field.type,
      label,
      helpText: clean(field.helpText),
      required: field.type === "section" ? false : Boolean(field.required),
      options,
      unit: field.type === "number" ? clean(field.unit) : null,
    };
  });
  if (!fields.some((f) => f.type !== "section")) {
    throw new ValidationError("Add at least one question to the template");
  }
  return fields;
}

function isBlank(value: TemplateAnswer | undefined): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function coerce(field: TemplateField, raw: TemplateAnswer): TemplateAnswer {
  switch (field.type) {
    case "number": {
      const n = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(n)) throw new ValidationError(`"${field.label}" must be a number`);
      return n;
    }
    case "yes_no":
      if (typeof raw === "boolean") return raw;
      if (raw === "yes" || raw === "true") return true;
      if (raw === "no" || raw === "false") return false;
      throw new ValidationError(`"${field.label}" must be yes or no`);
    case "select": {
      const value = String(raw).trim();
      if (!field.options.includes(value)) {
        throw new ValidationError(`"${value}" is not an option for "${field.label}"`);
      }
      return value;
    }
    default:
      return String(raw).trim();
  }
}

/**
 * Validates answers against the form and returns only answers to its own
 * questions — a stale client cannot slip an unknown key into the record.
 */
export function normaliseResponses(fields: TemplateField[], raw: TemplateResponses): TemplateResponses {
  const responses: TemplateResponses = {};
  const missing: string[] = [];
  for (const field of fields) {
    if (field.type === "section") continue;
    const value = raw[field.id];
    if (isBlank(value)) {
      if (field.required) missing.push(field.label);
      continue;
    }
    responses[field.id] = coerce(field, value as TemplateAnswer);
  }
  if (missing.length > 0) {
    throw new ValidationError(`Fill in the required fields: ${missing.join(", ")}`, { missing });
  }
  if (Object.keys(responses).length === 0) {
    throw new ValidationError("Your daily log entry cannot be empty");
  }
  return responses;
}

function display(field: TemplateField, value: TemplateAnswer): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field.type === "number" && field.unit) return `${value} ${field.unit}`;
  return String(value);
}

/**
 * The readable form of a filled template, stored as the entry body so the PDF
 * report, the period report, the digest and Panda AI read it like any entry.
 * Unanswered optional questions and sections with nothing under them are left
 * out, so the record shows what was reported rather than an empty form.
 */
export function renderResponses(
  fields: TemplateField[],
  responses: TemplateResponses,
): { html: string; text: string } {
  const html: string[] = [];
  const text: string[] = [];
  let pendingSection: TemplateField | null = null;

  for (const field of fields) {
    if (field.type === "section") {
      pendingSection = field;
      continue;
    }
    const value = responses[field.id];
    if (isBlank(value)) continue;
    if (pendingSection) {
      html.push(`<h3>${escapeHtml(pendingSection.label)}</h3>`);
      text.push(pendingSection.label.toUpperCase());
      pendingSection = null;
    }
    const shown = display(field, value as TemplateAnswer);
    if (field.type === "long_text") {
      const paragraphs = shown.split(/\n+/).map((line) => escapeHtml(line)).join("<br>");
      html.push(`<p><strong>${escapeHtml(field.label)}</strong></p><p>${paragraphs}</p>`);
      text.push(`${field.label}:\n${shown}`);
    } else {
      html.push(`<p><strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(shown)}</p>`);
      text.push(`${field.label}: ${shown}`);
    }
  }
  return { html: html.join(""), text: text.join("\n") };
}
