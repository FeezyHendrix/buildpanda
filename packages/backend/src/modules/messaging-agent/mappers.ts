import type { MessagingActionRow, MessagingConversationRow, MessagingProposalRow, MessagingReplyButton, MessagingReviewContext, MessagingScope } from "./types.ts";
import { stripHtml } from "../daily-logs/mappers.ts";
import { referencedFileIds } from "@buildpanda/rich-content";
import type { MessagingProposalCapabilities } from "./management-types.ts";
import { messagingDocumentArtifacts } from "./artifacts.ts";

function actionDescription(action: MessagingActionRow, separator = "; "): string {
  const payload = action.payload;
  if (action.kind === "daily_log") return payload.templateId ? action.summary ?? [`Template: ${payload.templateId}`, `Answers: ${JSON.stringify(payload.responses ?? {}, null, 2)}`, payload.bodyText].filter(Boolean).join(separator) : String(payload.bodyText ?? stripHtml(String(payload.bodyHtml ?? "")));
  if (action.kind === "material_log") return [
    `Movement: ${payload.entryType === "USED" ? "Used" : "Received"}`,
    `Material: ${payload.materialName}`, `Quantity: ${payload.quantity} ${payload.unit}`,
    ...["occurredAt", "supplier", "deliveryNote", "locationKey"].filter((key) => payload[key]).map((key) => `${({ occurredAt: "Occurred at", supplier: "Supplier", deliveryNote: "Delivery note", locationKey: "Location" } as Record<string, string>)[key]}: ${payload[key]}`),
    ...(payload.reason ? [String(payload.reason)] : []),
  ].join(separator);
  const labels: Record<string, string> = { weatherCondition: "Weather", temperatureC: "Temperature (°C)",
    precipitationMm: "Precipitation (mm)", windKph: "Wind (km/h)", workersExpected: "Workers expected",
    workersPresent: "Workers present", totalHours: "Total hours", summary: "Summary" };
  return Object.entries(payload).filter(([key]) => !["buildingId", "logDate"].includes(key) && !(key.endsWith("Html") && Object.hasOwn(payload, key === "contentHtml" ? "body" : key === "bodyHtml" ? "bodyText" : key.slice(0, -4))))
    .map(([key, value]) => `${labels[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase())}: ${value === null ? "clear" : key.endsWith("Html") ? stripHtml(String(value)) : typeof value === "object" ? JSON.stringify(value, null, 2) : value}`).join(separator);
}

export function conversationScope(conversation: MessagingConversationRow): MessagingScope {
  return { projectId: conversation.project_id, organizationId: conversation.organization_id, buildingId: conversation.building_id };
}

export function proposalDto(proposal: MessagingProposalRow, actions: MessagingActionRow[], capabilities: MessagingProposalCapabilities = { edit: false, confirm: false, cancel: false }) {
  const result = actions.find((action) => action.result)?.result;
  return {
    id: proposal.id, version: proposal.version, status: proposal.status,
    title: proposal.clarification ? "A few details are needed" : actions.length === 1 ? actions[0]!.title ?? "Field review" : `Review ${actions.length} field actions`,
    summary: proposal.clarification ?? actions.map((action) => `${action.payload.logDate ?? action.title ?? "Field action"}: ${actionDescription(action)}`).join("\n"),
    clarification: proposal.clarification ?? null, capabilities,
    artifacts: messagingDocumentArtifacts(actions),
    sourceText: proposal.source_text,
    createdAt: new Date(proposal.created_at).toISOString(),
    actions: actions.map((action) => ({ kind: action.kind, title: action.title ?? "Field action", payload: action.payload, missing: [],
      ...(action.result ? { result: { recordId: action.result.recordId, message: action.result.message ?? "Saved in BuildPanda" } } : {}) })),
    ...(result ? { result: { recordId: result.recordId, message: result.message ?? "Saved in BuildPanda" } } : {}),
  };
}

export function proposalReceipt(proposal: MessagingProposalRow, actions: MessagingActionRow[]): string {
  const label = actions.every((action) => ["daily_log", "update_daily_log"].includes(action.kind)) ? "daily-log action" : actions.every((action) => action.kind === "material_log") ? "material log" : "field action";
  if (proposal.status === "completed") return [
    `${actions.every((action) => ["daily_log", "update_daily_log", "material_log"].includes(action.kind)) ? "Saved" : "Completed"} ${actions.length} ${label}${actions.length === 1 ? "" : "s"}.`,
    ...actions.flatMap((action) => typeof action.result?.message === "string" ? [action.result.message] : []), `Reference: ${proposal.id}`,
    ...messagingDocumentArtifacts(actions).map((artifact) => `${artifact.download ? "Download" : "Open"} ${artifact.fileName} (BuildPanda sign-in required):\n${artifact.url}`),
  ].join("\n\n");
  if (proposal.status === "cancelled") return "Review cancelled.\n\nNo new records were saved.";
  if (proposal.clarification) return `A few details are needed\n\n${proposal.clarification}\n\nReply with the missing details, or use Cancel below. Nothing has been saved.`;
  const receipt = [
    `Review before saving\nReference: ${proposal.id} · version ${proposal.version}`,
    ...actions.map((action, index) => {
      const payload = action.payload;
      const details = actionDescription(action, "\n");
      const files = referencedFileIds(payload);
      return `${index + 1}. ${action.title ?? action.kind}${payload.logDate ? `\nDate: ${payload.logDate}` : ""}\n\n${details}${files.length ? `\nAttachments: ${files.join(", ")}` : ""}`;
    }),
    "Use Confirm or Cancel below.\nTo change the details, send a correction.",
  ].join("\n\n");
  return receipt;
}

export function proposalButtons(proposal: MessagingProposalRow): MessagingReplyButton[] | undefined {
  if (proposal.status !== "draft") return undefined;
  if (proposal.clarification) return [{ label: "Cancel", command: `CANCEL ${proposal.id} ${proposal.version}` }];
  return [
    { label: "Confirm", command: `CONFIRM ${proposal.id} ${proposal.version}` },
    { label: "Cancel", command: `CANCEL ${proposal.id} ${proposal.version}` },
  ];
}

export function proposalMessage(proposal: MessagingProposalRow, actions: MessagingActionRow[], context: MessagingReviewContext): string {
  return [
    `Project: ${context.projectName}${context.buildingName ? `\nBuilding: ${context.buildingName}` : ""}`,
    ...(context.voiceNote ? ["Voice note translated to English for review."] : []),
    proposalReceipt(proposal, actions),
  ].join("\n\n");
}

export const MESSAGING_HELP = [
  "Panda Agent",
  "Use Field Tools by text or voice: materials, daily logs, tasks, RFIs, changes, scheduling, expenses, messages, updates, documents and drawings.",
  "How it works\n1. Sign in to Panda Agent and select your project and building.\n2. Connect this messaging account.\n3. Send your update and review the details.",
  "Tap Confirm to save or Cancel to discard the review. To change the details, send a correction before confirming.",
  "Reply STOP to opt out. Reconnect in Panda Agent to resume.",
  "Forward a receipt, invoice, purchase order, plan or other document. Panda will suggest its section and ask for missing details before preparing a review.",
  "Ask about project records to read the information your current access allows. Attach files for evidence; drawing marks need an exact revision and position.",
].join("\n\n");

export function connectionReceipt(projectName: string, buildingName?: string | null): string {
  return [
    "Connected to Panda.",
    `Project: ${projectName}${buildingName ? `\nBuilding: ${buildingName}` : ""}`,
    "Send your update by text or voice. Panda will prepare a review before saving.",
    "Tap Confirm or Cancel on the review. To change the details, send a correction.",
    "Reply STOP to opt out.",
  ].join("\n\n");
}
