import type { MessagingActionRow, MessagingConversationRow, MessagingProposalRow, MessagingScope } from "./types.ts";
import { BadRequestError } from "../../lib/errors.ts";
import { stripHtml } from "../daily-logs/mappers.ts";
import { hasComplexContent } from "./draft.ts";

function actionDescription(action: MessagingActionRow): string {
  const payload = action.payload;
  if (action.kind === "daily_log") return String(payload.bodyText ?? stripHtml(String(payload.bodyHtml ?? "")));
  const labels: Record<string, string> = { weatherCondition: "Weather", temperatureC: "Temperature (°C)",
    precipitationMm: "Precipitation (mm)", windKph: "Wind (km/h)", workersExpected: "Workers expected",
    workersPresent: "Workers present", totalHours: "Total hours", summary: "Summary" };
  return Object.entries(payload).filter(([key]) => !["buildingId", "logDate", "summaryHtml"].includes(key))
    .map(([key, value]) => `${labels[key] ?? key}: ${value === null ? "clear" : value}`).join("; ");
}

export function conversationScope(conversation: MessagingConversationRow): MessagingScope {
  return { projectId: conversation.project_id, organizationId: conversation.organization_id, buildingId: conversation.building_id };
}

export function proposalDto(proposal: MessagingProposalRow, actions: MessagingActionRow[]) {
  const result = actions.find((action) => action.result)?.result;
  return {
    id: proposal.id, version: proposal.version, status: proposal.status,
    title: actions.length === 1 ? actions[0]!.title ?? "Daily-log review" : `Review ${actions.length} daily-log actions`,
    summary: actions.map((action) => `${action.payload.logDate}: ${actionDescription(action)}`).join("\n"),
    sourceText: proposal.source_text,
    createdAt: new Date(proposal.created_at).toISOString(),
    actions: actions.map((action) => ({ kind: action.kind, title: action.title ?? "Daily-log action", payload: action.payload, missing: [] })),
    ...(result ? { result: { recordId: result.recordId, message: "Saved in BuildPanda" } } : {}),
  };
}

export function proposalReceipt(proposal: MessagingProposalRow, actions: MessagingActionRow[]): string {
  if (proposal.status === "completed") return `Saved ${actions.length} daily-log action(s). Reference: ${proposal.id}.`;
  if (proposal.status === "cancelled") return "Review cancelled. No new daily-log records were saved.";
  if (actions.some(hasComplexContent)) throw new BadRequestError("This review contains templates, files or rich content. Review those details in BuildPanda; Messaging confirmation is not enabled for them yet.");
  const receipt = [
    `Review ${proposal.id} · version ${proposal.version}`,
    ...actions.map((action, index) => {
      const payload = action.payload;
      const details = actionDescription(action);
      return `${index + 1}. ${action.title ?? action.kind} (${payload.logDate}): ${details}`;
    }),
    `Reply CONFIRM ${proposal.id} ${proposal.version} to save, CANCEL ${proposal.id} ${proposal.version} to cancel, or send a correction.`,
  ].join("\n");
  return receipt;
}
