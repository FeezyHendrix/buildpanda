import { allOf, DENY, type AccessRequirement, type FeatureAccess } from "./access-requirement";
import { features } from "./feature-access";

export const approvalTierStatus = (status: unknown) =>
  typeof status === "string" && ["Approved", "Ordered", "PartiallyDelivered", "Delivered", "Rejected"].includes(status);

const endpoints: Readonly<Record<string, FeatureAccess>> = {
  rfis: features.rfis, "change-requests": features.changeRequests, materials: features.materialOrders,
  "material-approvals": features.materialApprovals, documents: features.documents,
  "drawing-markups": features.documents, "daily-logs": features.dailyLog, "daily-log-templates": features.dailyLog,
  updates: features.updates, activities: features.schedule, "look-aheads": features.schedule,
  stages: features.stages, "key-dates": features.keyDates, buildings: features.buildings,
  participants: features.participants, tasks: features.tasks, transactions: features.expenses,
  channels: features.messages, ai: features.project,
};

/** Resolves transport details to the same policies used by views and queues. */
export function apiRequirement(path: string, method = "GET", body: Record<string, unknown> = {}): AccessRequirement | null {
  const [, , , endpoint, ...tail] = path.split("?")[0]!.split("/");
  if (endpoint === "access") return null;
  if (!endpoint) return features.project.read;
  const feature: FeatureAccess | undefined = endpoint === "materials" && ["ledger", "stock", "catalog"].includes(tail[0] ?? "")
    ? features.materialLog : endpoints[endpoint];
  if (!feature) return DENY;
  if (method === "GET" || endpoint === "ai") return feature.read;
  let operation = method === "DELETE" ? "remove" : method === "POST" && tail.length === 0 ? "create" : "edit";
  if (tail.includes("comments")) operation = "comment";
  if (tail.includes("void")) operation = "void";
  if (endpoint === "updates" && method === "DELETE") operation = "edit";
  if (endpoint === "tasks" && tail.includes("move")) operation = "move";
  if (endpoint === "drawing-markups") operation = "markup";
  if (endpoint === "rfis" && tail.includes("respond")) operation = body.official ? "officialResponse" : "respond";
  if (endpoint === "rfis" && tail.includes("transition")) operation = "transition";
  if (endpoint === "materials" && tail[0] === "ledger" && !tail.includes("void")) operation = body.entryType === "USED" ? "usage" : "create";
  if (endpoint === "materials" && tail[0] === "orders" && approvalTierStatus(body.status)) operation = "approve";
  if (endpoint === "materials" && tail.includes("deliveries")) operation = "receive";
  if (endpoint === "material-approvals" && body.status !== undefined) operation = body.status === "Pending" ? "reopen" : "decide";
  const policy = feature.actions[operation] ?? DENY;
  return endpoint === "material-approvals" && body.requestedReviewerId !== undefined && method === "PATCH"
    ? allOf(policy, features.materialApprovals.actions.decide) : policy;
}
