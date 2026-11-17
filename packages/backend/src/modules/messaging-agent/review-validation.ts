import { htmlFromText, plainTextFromHtml, referencedFileIds, textWithoutImages } from "@buildpanda/rich-content";
import { BadRequestError } from "../../lib/errors.ts";
import { sanitizeHtmlFields, sanitizeRichText } from "../../lib/rich-text.ts";
import { stripHtml } from "../daily-logs/mappers.ts";
import { validateDailyLogCommand } from "../field-actions/index.ts";
import { fieldToolDescriptor, isFieldToolKind, validateFieldTool, fieldToolSchemas } from "../field-actions/tools.ts";
import type { DailyLogCommand } from "../field-actions/types.ts";
import type { FieldToolKind } from "../field-actions/tool-types.ts";
import { validateFieldPayload } from "../field-actions/tool-schema.ts";
import { projectToday } from "./dates.ts";
import { MessagingClarificationError } from "./draft-errors.ts";
import { materialReviewCommand } from "./material-review.ts";
import type { MessagingDraftScope, MessagingReviewAction } from "./management-types.ts";
import type { MessagingScope } from "./types.ts";

export function reviewCommand(action: MessagingReviewAction, scope: MessagingScope): DailyLogCommand {
  if (!scope.buildingId) throw new MessagingClarificationError("Choose a building in Panda Agent before recording a daily-log update.");
  const { logDate, buildingId, ...payload } = action.payload;
  if (buildingId !== scope.buildingId) throw new BadRequestError("The reviewed building has changed. Choose the building again.");
  const command = validateDailyLogCommand({ kind: action.kind, projectId: scope.projectId, buildingId, logDate, payload });
  if (command.kind === "daily_log" && !command.payload.templateId && !stripHtml(command.payload.bodyHtml ?? "")) throw new BadRequestError("Add a daily-log note before confirming this review.");
  if (command.kind === "update_daily_log" && !Object.entries(command.payload).some(([key, value]) => key !== "buildingId" && value !== undefined)) throw new BadRequestError("Choose at least one daily-log header field to update.");
  return command;
}

function mirrors(payload: Record<string, unknown>, schema: { properties?: Record<string, unknown> }): Record<string, unknown> {
  const result = structuredClone(payload);
  const pairs = Object.keys(schema.properties ?? {}).filter((key) => key.endsWith("Html")).map((html) => {
    const candidates = html === "bodyHtml" ? ["bodyText", "body"] : html === "contentHtml" ? ["body", "content"] : html === "notesHtml" ? ["reason", "notes"] : [html.slice(0, -4)];
    return [candidates.find((key) => schema.properties?.[key]), html];
  });
  for (const [plain, html] of pairs) {
    if (!plain) continue;
    if (result[html!] == null && typeof result[plain!] === "string") result[html!] = htmlFromText(result[plain!] as string);
    else if (result[html!] === undefined && result[plain!] === null) result[html!] = null;
    else if (typeof result[html!] === "string" && schema.properties?.[plain!]) {
      const text = plainTextFromHtml(sanitizeRichText(result[html!] as string).replace(/<img\b[^>]*>/gi, ""));
      if (typeof result[plain!] === "string" && plainTextFromHtml(htmlFromText(textWithoutImages(result[plain!] as string))) !== text) throw new BadRequestError(`The ${plain} field and its formatted content disagree. Review both before saving.`);
      if (result[plain!] === undefined) result[plain!] = text;
    }
  }
  for (const [key, value] of Object.entries(result)) {
    if (value && typeof value === "object" && !Array.isArray(value) && schema.properties?.[key]) result[key] = mirrors(value as Record<string, unknown>, schema.properties[key] as { properties?: Record<string, unknown> });
  }
  return sanitizeHtmlFields(result) as Record<string, unknown>;
}

export function normalizeReview(actions: unknown, scope: MessagingDraftScope): MessagingReviewAction[] {
  if (!Array.isArray(actions) || actions.length === 0 || actions.length > 10) throw new BadRequestError("Review between one and ten field actions.");
  return actions.map((input) => {
    if (!input || typeof input !== "object" || !isFieldToolKind(input.kind)) throw new BadRequestError("Unknown field action. Describe the action again.");
    if (Object.keys(input).some((key) => !["kind", "title", "summary", "payload", "missing", "reviewId"].includes(key))) throw new BadRequestError("Put every field inside the action payload. Project and workspace destinations must use the selected authorized scope.");
    if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) throw new BadRequestError("The field action needs valid review fields.");
    const kind: FieldToolKind = input.kind;
    let payload = structuredClone(input.payload) as Record<string, unknown>;
    if (kind === "daily_log" && payload.responses === null && !payload.templateId) delete payload.responses;
    if (kind === "daily_log" && payload.responses && !payload.templateId) throw new BadRequestError("Choose a daily-log template before supplying form answers.");
    if (fieldToolDescriptor(kind).requiresBuilding && !scope.buildingId) throw new MessagingClarificationError("Which building does this field action belong to? Choose it in Panda Agent.");
    if (kind === "material_log") {
      if (payload.occurredAt == null && scope.messageSentAt) {
        const originalDay = projectToday(new Date(scope.messageSentAt));
        if (scope.recentMessages?.some((message) => message.role === "user" && message.sentAt && projectToday(new Date(message.sentAt)) !== originalDay)) throw new MessagingClarificationError("Which date did each material movement actually happen? Keep the original arrival date separate from the expected date and later clarification.");
        payload.occurredAt = scope.messageSentAt;
      }
      const details = Object.fromEntries(Object.entries(payload).filter(([key]) => ["entryType", "materialName", "quantity", "unit", "occurredAt"].includes(key)));
      materialReviewCommand({ kind: input.kind, title: "Material log", payload: details }, scope);
    }
    payload = validateFieldTool(kind, mirrors(payload, fieldToolSchemas[kind]));
    if (input.kind === "daily_log" || input.kind === "update_daily_log") {
      const command = reviewCommand({ ...input, payload }, scope);
      payload = { ...command.payload, logDate: command.logDate, buildingId: command.buildingId };
    }
    return { kind: input.kind, title: fieldToolDescriptor(input.kind).label, payload, missing: [] };
  });
}

function knownIds(value: unknown, ids: Set<string>, key = "") {
  if (typeof value === "string" && /(^id$|Id$|^value$)/.test(key)) ids.add(value);
  else if (Array.isArray(value)) for (const item of value) typeof item === "string" && /Ids$/.test(key) ? ids.add(item) : knownIds(item, ids);
  else if (value && typeof value === "object") for (const [name, item] of Object.entries(value)) knownIds(item, ids, name);
}

function preservePayload(previous: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  const result = { ...structuredClone(previous), ...next };
  for (const html of Object.keys(previous).filter((key) => key.endsWith("Html"))) {
    const candidates = html === "bodyHtml" ? ["bodyText", "body"] : html === "contentHtml" ? ["body", "content"] : html === "notesHtml" ? ["reason", "notes"] : [html.slice(0, -4)];
    const plain = candidates.find((key) => Object.hasOwn(next, key));
    if (!plain || Object.hasOwn(next, html) || next[plain] === previous[plain]) continue;
    if (next[plain] === null) result[html] = null;
    else if (typeof previous[plain] === "string" && previous[html] === sanitizeRichText(htmlFromText(previous[plain] as string)) && typeof next[plain] === "string") result[html] = sanitizeRichText(htmlFromText(next[plain] as string));
    else throw new MessagingClarificationError("The correction changes formatted content. Include the updated formatting and attachments, or edit that field in Panda Agent so they are preserved.");
  }
  for (const [key, value] of Object.entries(next)) if (value && typeof value === "object" && !Array.isArray(value) && previous[key] && typeof previous[key] === "object" && !Array.isArray(previous[key])) result[key] = preservePayload(previous[key] as Record<string, unknown>, value as Record<string, unknown>);
  return result;
}

function requireGeneratedMirrors(payload: Record<string, unknown>) {
  for (const [key, value] of Object.entries(payload)) {
    if (key.endsWith("Html") && typeof value === "string") {
      const plain = key === "bodyHtml" ? ["bodyText", "body"] : key === "contentHtml" ? ["body", "content"] : key === "notesHtml" ? ["reason", "notes"] : [key.slice(0, -4)];
      if (!plain.some((name) => typeof payload[name] === "string")) throw new BadRequestError("Include the plain-text mirror of formatted content before reviewing it.");
    } else if (Array.isArray(value)) for (const item of value) { if (item && typeof item === "object") requireGeneratedMirrors(item); }
    else if (value && typeof value === "object") requireGeneratedMirrors(value as Record<string, unknown>);
  }
}

export function groundedReview(actions: unknown, scope: MessagingDraftScope, previous: MessagingReviewAction[], source = ""): MessagingReviewAction[] {
  const allowed = new Set((scope.tools ?? Object.keys(fieldToolSchemas).filter(isFieldToolKind).map(fieldToolDescriptor)).map((tool) => tool.kind));
  const ids = new Set([scope.projectId, ...(scope.buildingId ? [scope.buildingId] : [])]);
  knownIds(scope.targets, ids); knownIds(previous, ids);
  for (const id of referencedFileIds(previous)) ids.add(id);
  const removal = /^REMOVE\s+(?:ACTION\s+)?([A-Za-z0-9_-]+)\.?$/i.exec(source.trim());
  const removed = removal ? previous.find((action, index) => action.reviewId === removal[1] || String(index + 1) === removal[1]) : undefined;
  if (Array.isArray(actions) && (actions.length < previous.length - (removed ? 1 : 0) || previous.some((prior) => prior !== removed && prior.reviewId && !actions.some((action) => action?.reviewId === prior.reviewId)))) throw new MessagingClarificationError("The correction left out a pending action. Keep the complete batch, or send REMOVE ACTION followed by its number to discard one pending action.");
  if (Array.isArray(actions)) for (const action of actions) {
    if (!action || !allowed.has(action.kind)) throw new BadRequestError("Your current tools do not allow that action.");
    if (!action.payload || typeof action.payload !== "object" || Array.isArray(action.payload)) throw new BadRequestError("The field action needs its review fields inside payload.");
    const used = new Set<string>(); knownIds(action.payload, used);
    for (const id of referencedFileIds(action.payload)) used.add(id);
    if ([...used].some((id) => !ids.has(id))) throw new MessagingClarificationError("I could not identify an authorized target or attachment. Tell me which record you mean, or choose the file in Panda Agent.");
    let prior = action.reviewId ? previous.find((item) => item.reviewId === action.reviewId) : undefined;
    if (action.reviewId && (!prior || prior.kind !== action.kind)) throw new BadRequestError("This correction does not match a current pending action.");
    if (!prior && !action.reviewId) {
      const matches = previous.filter((item) => item.kind === action.kind && !item.reviewId);
      if (matches.length === 1 && actions.filter((item) => item?.kind === action.kind).length === 1) prior = matches[0];
      else if (matches.length > 1) throw new MessagingClarificationError("There are several pending actions of this type. Identify each action's reviewId so their details stay with the correct record.");
    }
    if (prior && prior.kind === action.kind) action.payload = preservePayload(prior.payload, action.payload);
    requireGeneratedMirrors(action.payload);
  }
  const normalized = normalizeReview(actions, scope);
  for (const action of normalized) {
    const descriptor = scope.tools?.find((tool) => tool.kind === action.kind);
    if (descriptor) validateFieldPayload(descriptor.schema, action.payload);
  }
  return normalized;
}
