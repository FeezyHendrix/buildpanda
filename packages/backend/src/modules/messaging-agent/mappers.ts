import type { MessagingActionRow, MessagingConversationRow, MessagingProposalRow, MessagingReplyButton, MessagingReviewContext, MessagingScope } from "./types.ts";
import { BadRequestError } from "../../lib/errors.ts";
import { stripHtml } from "../daily-logs/mappers.ts";
import { hasComplexContent } from "./draft.ts";

function actionDescription(action: MessagingActionRow, separator = "; "): string {
  const payload = action.payload;
  if (action.kind === "daily_log") return String(payload.bodyText ?? stripHtml(String(payload.bodyHtml ?? "")));
  const labels: Record<string, string> = { weatherCondition: "Weather", temperatureC: "Temperature (°C)",
    precipitationMm: "Precipitation (mm)", windKph: "Wind (km/h)", workersExpected: "Workers expected",
    workersPresent: "Workers present", totalHours: "Total hours", summary: "Summary" };
  return Object.entries(payload).filter(([key]) => !["buildingId", "logDate", "summaryHtml"].includes(key))
    .map(([key, value]) => `${labels[key] ?? key}: ${value === null ? "clear" : value}`).join(separator);
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
  if (proposal.status === "completed") return `Saved ${actions.length} daily-log action${actions.length === 1 ? "" : "s"}.\n\nReference: ${proposal.id}`;
  if (proposal.status === "cancelled") return "Review cancelled.\n\nNo new daily-log records were saved.";
  if (actions.some(hasComplexContent)) throw new BadRequestError("This review contains templates, files or rich content. Review those details in BuildPanda; Messaging confirmation is not enabled for them yet.");
  const receipt = [
    `Review before saving\nReference: ${proposal.id} · version ${proposal.version}`,
    ...actions.map((action, index) => {
      const payload = action.payload;
      const details = actionDescription(action, "\n");
      return `${index + 1}. ${action.title ?? action.kind}\nDate: ${payload.logDate}\n\n${details}`;
    }),
    "Use Confirm or Cancel below.\nTo change the details, send a correction.",
  ].join("\n\n");
  return receipt;
}

export function proposalButtons(proposal: MessagingProposalRow): MessagingReplyButton[] | undefined {
  return proposal.status === "draft" ? [
    { label: "Confirm", command: `CONFIRM ${proposal.id} ${proposal.version}` },
    { label: "Cancel", command: `CANCEL ${proposal.id} ${proposal.version}` },
  ] : undefined;
}

export function proposalMessage(proposal: MessagingProposalRow, actions: MessagingActionRow[], context: MessagingReviewContext): string {
  return [
    `Project: ${context.projectName}\nBuilding: ${context.buildingName}`,
    ...(context.voiceNote ? ["Voice note translated to English for review."] : []),
    proposalReceipt(proposal, actions),
  ].join("\n\n");
}

export const MESSAGING_HELP = [
  "Panda Agent",
  "Send a daily site note or daily-log header update by text or voice.",
  "How it works\n1. Sign in to Panda Agent and select your project and building.\n2. Connect this messaging account.\n3. Send your update and review the details.",
  "Tap Confirm to save or Cancel to discard the review. To change the details, send a correction before confirming.",
  "Reply STOP to opt out. Reconnect in Panda Agent to resume.",
  "Other field actions are not enabled yet.",
].join("\n\n");

export function connectionReceipt(projectName: string, buildingName: string): string {
  return [
    "Connected to Panda.",
    `Project: ${projectName}\nBuilding: ${buildingName}`,
    "Send your update by text or voice. Panda will prepare a review before saving.",
    "Tap Confirm or Cancel on the review. To change the details, send a correction.",
    "Reply STOP to opt out.",
  ].join("\n\n");
}
