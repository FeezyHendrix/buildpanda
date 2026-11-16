import { ForbiddenError } from "../../lib/errors.ts";
import { fieldToolRequirements, isFieldToolKind } from "../field-actions/tools.ts";
import type { FieldToolRequirement } from "../field-actions/tool-types.ts";
import { materialLogPermissionActions } from "../materials-ledger/permissions.ts";
import { materialsPermissionActions } from "../materials-equipment/permissions.ts";
import { TOOL_PERMISSIONS } from "../panda-ai/agent/tool-permissions.ts";
import { MESSAGING_READ_TOOLS, messagingReadResourceEnabled } from "./tool-discovery-policy.ts";
import type { MessagingAccess, MessagingCapabilities, MessagingFeatures, MessagingProposalCapabilities, MessagingReviewAction } from "./management-types.ts";
import type { MessagingActionRow, MessagingProposalRow } from "./types.ts";

export const messagingActionPolicies = fieldToolRequirements;
const readKinds = new Set(["open_document", "download_document"]);
const featureEnabled = (features: MessagingFeatures, key: string) => features.enabled?.[key] ??
  (key === "quality.dailyLogs" ? features.dailyLogs : ["commercial.materialsLedger", "commercial.materialsEquipment"].includes(key) ? features.materialLogs : false);

function eligible(permissions: Record<string, string[]>, workspace: Record<string, string[]>, features: MessagingFeatures, requirements: FieldToolRequirement) {
  if (!requirements.features.every((key) => featureEnabled(features, key))) return false;
  const allowed = (grants: Record<string, string[]>) => requirements.permissions.every(([resource, action]) => grants[resource]?.includes(action)) &&
    (!requirements.anyPermissions || requirements.anyPermissions.some(([resource, action]) => grants[resource]?.includes(action)));
  return requirements.permissionScope === "workspace" ? allowed(workspace) : requirements.permissionScope === "either" ? allowed(permissions) || allowed(workspace) : allowed(permissions);
}

export function messagingCapabilities(permissions: Record<string, string[]>, features: MessagingFeatures, workspace: Record<string, string[]> = {}): MessagingCapabilities {
  const actions = Object.fromEntries(Object.entries(fieldToolRequirements).map(([kind, requirement]) => [kind, eligible(permissions, workspace, features, requirement)]));
  const dailyLogCreate = actions.daily_log === true;
  const materialReceipt = features.materialLogs && materialLogPermissionActions("IN").some((action) => permissions.materials?.includes(action));
  const materialUsage = features.materialLogs && materialLogPermissionActions("USED").some((action) => permissions.materials?.includes(action));
  const access = { permissions, workspacePermissions: workspace, features } as MessagingAccess;
  return { capture: Object.entries(actions).some(([kind, allowed]) => allowed && !readKinds.has(kind)),
    read: Object.keys(fieldToolRequirements).some((kind) => canReadMessagingAction(access, kind)) || Object.entries(TOOL_PERMISSIONS).some(([name, rule]) => MESSAGING_READ_TOOLS.has(name) && rule && messagingReadResourceEnabled(features, rule.resource) && permissions[rule.resource]?.includes(rule.action)), dailyLogCreate, materialReceipt, materialUsage, actions };
}

export function canReadMessagingAction(access: MessagingAccess, kind: string): boolean {
  if (!isFieldToolKind(kind)) return false;
  const policy: FieldToolRequirement = fieldToolRequirements[kind];
  if (!policy.features.every((key) => featureEnabled(access.features, key))) return false;
  const resources = [...new Set([...policy.permissions, ...policy.anyPermissions ?? []].map(([resource]) => resource).filter((resource) => resource !== "comments"))];
  const required = policy.readPermissions ?? resources.map((resource) => [resource, resource === "finances" ? "viewCosts" : "view"] as const);
  const allowed = (grants: Record<string, string[]>) => required.length > 0 && required.every(([resource, action]) => grants[resource]?.includes(action));
  return policy.permissionScope === "workspace" ? allowed(access.workspacePermissions ?? {}) : policy.permissionScope === "either" ? allowed(access.permissions) || allowed(access.workspacePermissions ?? {}) : allowed(access.permissions);
}

export function canWriteMessagingAction(access: MessagingAccess, action: Pick<MessagingReviewAction | MessagingActionRow, "kind" | "payload">): boolean {
  if (!isFieldToolKind(action.kind)) return false;
  if (!eligible(access.permissions, access.workspacePermissions ?? {}, access.features, fieldToolRequirements[action.kind])) return false;
  if (action.kind === "annotate_drawing" && action.payload.followUp) {
    const followUp = action.payload.followUp as { kind?: string; payload?: Record<string, unknown> };
    if (!["rfi", "create_material_approval"].includes(followUp.kind ?? "") || !canWriteMessagingAction(access, { kind: followUp.kind!, payload: followUp.payload ?? {} })) return false;
  }
  const has = (resource: string, verb: string) => access.permissions[resource]?.includes(verb) === true;
  if (action.kind === "material_log") return action.payload.entryType === "USED" ? access.capabilities.materialUsage : action.payload.entryType === "IN" && access.capabilities.materialReceipt;
  const status = action.payload.status ?? (action.payload.patch as Record<string, unknown> | undefined)?.status;
  if (["material_order", "update_material_order"].includes(action.kind) && ["Approved", "Ordered", "PartiallyDelivered", "Delivered", "Rejected"].includes(String(status)) && !materialsPermissionActions("approve").some((action) => has("materials", action))) return false;
  if (action.kind === "respond_rfi" && action.payload.official === true && !has("rfis", "manage")) return false;
  if (action.kind === "log_activity" && (action.payload.delay || action.payload.delayReasonCode) && (!has("schedule", "manage") || !featureEnabled(access.features, "projects.schedule"))) return false;
  return true;
}

export function canReadMessagingReviewAction(access: MessagingAccess, action: Pick<MessagingReviewAction | MessagingActionRow, "kind" | "payload">): boolean {
  if (!canReadMessagingAction(access, action.kind)) return false;
  const followUp = action.kind === "annotate_drawing" ? action.payload.followUp as { kind?: string } | undefined : undefined;
  return !followUp || (typeof followUp.kind === "string" && canReadMessagingAction(access, followUp.kind));
}

export function requireMessagingActions(access: MessagingAccess, actions: Pick<MessagingReviewAction | MessagingActionRow, "kind" | "payload">[]): void {
  if (actions.some((action) => !canWriteMessagingAction(access, action))) throw new ForbiddenError("Your current permissions do not allow these field actions.");
}

export function proposalCapabilities(access: MessagingAccess, proposal: MessagingProposalRow, actions: MessagingActionRow[]): MessagingProposalCapabilities {
  const writable = actions.every((action) => canWriteMessagingAction(access, action));
  const draft = proposal.status === "draft";
  return { edit: draft && writable && actions.length > 0, confirm: draft && writable && actions.length > 0 && !proposal.clarification, cancel: draft && (access.capabilities.capture || access.capabilities.read) };
}
