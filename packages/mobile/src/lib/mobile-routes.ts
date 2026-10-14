import { anyOf, DENY, VERIFIED, type AccessRequirement, type FeatureAccess } from "./access-requirement";
import { captureAccess, features, messagingAccess, scheduleAccess } from "./feature-access";

/** Specific prefixes precede their parent. A new protected route needs a policy. */
const featureRoutes: readonly [string, FeatureAccess][] = [
  ["tools/schedule/stages", features.stages], ["tools/schedule/key-dates", features.keyDates],
  ["tools/schedule", features.schedule], ["tools/look-aheads", features.schedule],
  ["tools/rfis", features.rfis], ["tools/change-requests", features.changeRequests],
  ["tools/materials", features.materialOrders], ["tools/material-approvals", features.materialApprovals],
  ["tools/material-log", features.materialLog], ["tools/daily-log", features.dailyLog],
  ["tools/documents", features.documents], ["tools/plan-review", features.documents],
  ["tools/updates", features.updates], ["tools/tasks", features.tasks],
  ["tools/expenses", features.expenses], ["tools/panda-ai", features.project],
  ["messages", features.messages],
];
const pages: Readonly<Record<string, AccessRequirement>> = {
  "": features.documents.read, index: features.documents.read,
  "tools/documents/view": anyOf(features.documents.read, messagingAccess),
  overview: VERIFIED, tools: VERIFIED, sync: VERIFIED, "tools/customise-home": VERIFIED,
  messages: messagingAccess, "messages/new": features.workspaceMessages.actions.create,
  schedule: scheduleAccess, capture: captureAccess, record: captureAccess,
};
const routeActions: Readonly<Record<string, string>> = {
  new: "create", upload: "create", edit: "edit", deliver: "receive", "log-activity": "create", fill: "create",
};

export function routePermission(path: string): AccessRequirement {
  const parts = path.split("?")[0]!.split("/").filter(Boolean).filter((p) => !p.startsWith("("));
  const route = parts.join("/");
  if (Object.hasOwn(pages, route)) return pages[route]!;
  const entry = featureRoutes.find(([prefix]) => route === prefix || route.startsWith(`${prefix}/`));
  if (!entry) return DENY;
  const [prefix, feature] = entry;
  const action = parts.slice(prefix.split("/").length).map((part) => routeActions[part]).find(Boolean);
  if (prefix === "messages") return action ? features.workspaceMessages.actions.create : messagingAccess;
  return action ? feature.actions[action] ?? DENY : feature.read;
}
