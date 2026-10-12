import type { TemplateAnswer, TemplateField, TemplateResponses } from "@/api/daily-log-templates";

/**
 * The form rules the server applies when a template entry syncs, mirrored so a
 * crew member offline sees the same required fields and the same rendered
 * entry. The server stays the authority; this only keeps the two in step.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isBlank(value: TemplateAnswer | undefined): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

/** Labels of the required questions still unanswered. */
export function missingRequired(fields: readonly TemplateField[], responses: TemplateResponses): string[] {
  return fields.filter((f) => f.type !== "section" && f.required && isBlank(responses[f.id])).map((f) => f.label);
}

/** Answers ready to send: trimmed, numbers parsed, blanks and unknown keys dropped. */
export function cleanResponses(fields: readonly TemplateField[], raw: TemplateResponses): TemplateResponses {
  const out: TemplateResponses = {};
  for (const field of fields) {
    if (field.type === "section") continue;
    const value = raw[field.id];
    if (isBlank(value)) continue;
    if (field.type === "number") {
      const n = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
      if (Number.isFinite(n)) out[field.id] = n;
    } else if (field.type === "yes_no") {
      if (typeof value === "boolean") out[field.id] = value;
    } else if (field.type === "select") {
      if (field.options.includes(String(value))) out[field.id] = String(value);
    } else {
      out[field.id] = String(value).trim();
    }
  }
  return out;
}

function display(field: TemplateField, value: TemplateAnswer): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field.type === "number" && field.unit) return `${value} ${field.unit}`;
  return String(value);
}

/** Same output as the server's renderResponses: answered questions only, under their section. */
export function renderResponses(
  fields: readonly TemplateField[],
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
      html.push(`<p><strong>${escapeHtml(field.label)}</strong></p><p>${shown.split(/\n+/).map(escapeHtml).join("<br>")}</p>`);
      text.push(`${field.label}:\n${shown}`);
    } else {
      html.push(`<p><strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(shown)}</p>`);
      text.push(`${field.label}: ${shown}`);
    }
  }
  return { html: html.join(""), text: text.join("\n") };
}

/** The whole entry as the server will store it: the form, then any notes or photos. */
export function composeEntryBody(
  fields: readonly TemplateField[],
  responses: TemplateResponses,
  notesHtml: string | null,
  notesText: string | null,
): { html: string; text: string } {
  const form = renderResponses(fields, responses);
  return {
    html: form.html + (notesHtml ? `<h3>Notes</h3>${notesHtml}` : ""),
    text: [form.text, notesText ? `NOTES\n${notesText}` : null].filter(Boolean).join("\n"),
  };
}
