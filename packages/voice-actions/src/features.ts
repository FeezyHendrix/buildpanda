import { allOf, anyOf, capability, defineFeature, grant, workspaceGrant } from "./access.ts";

const comment = grant("comments", "post");
const orderApproval = anyOf(grant("materials", "approve"), grant("materials", "manage"));

/** Endpoint contracts, never role defaults. Consumers refer to these policies. */
export const features = {
  project: defineFeature("project", {}),
  rfis: defineFeature("rfis", { create: "create", edit: "manage", remove: "manage", transition: "manage", comment,
    respond: "respond", officialResponse: allOf(grant("rfis", "respond"), grant("rfis", "manage")) }),
  changeRequests: defineFeature("change-requests", { create: "manage", edit: "manage", remove: "manage", comment }),
  materialOrders: defineFeature("materials", { create: "request", edit: "request",
    receive: allOf(grant("materials", "request"), orderApproval),
    approve: allOf(grant("materials", "request"), orderApproval), remove: allOf(grant("materials", "request"), orderApproval) }),
  materialApprovals: defineFeature("materials", { create: "request", edit: "request", decide: "approve", reopen: "request", remove: "approve", comment }),
  materialLog: defineFeature("materials", { create: anyOf(grant("materials", "request"), grant("materials", "manage")), usage: "manage", void: "manage" }),
  dailyLog: defineFeature("dailyLog", { create: "create", edit: "create", void: "void" }),
  documents: defineFeature("documents", { create: "upload", edit: "upload", remove: "delete", markup: "markup" }),
  schedule: defineFeature("schedule", { create: "manage", edit: "manage", remove: "manage" }),
  stages: defineFeature("stages", { edit: "manage" }),
  keyDates: defineFeature("key-dates", { edit: "manage" }),
  buildings: defineFeature("buildings", {}),
  participants: defineFeature("participants", {}),
  updates: defineFeature("updates", { create: "post", edit: "post", comment }),
  tasks: defineFeature("tasks", { create: "add", edit: "add", move: "view", remove: "remove", comment },
    allOf(grant("tasks", "view"), capability("canAccessTaskBoard"))),
  expenses: defineFeature("finances", { create: "manage", edit: "manage" }, "viewCosts"),
  messages: defineFeature("messages", { create: "send" }),
  workspaceMessages: defineFeature("messages", { create: workspaceGrant("messages", "send") }, workspaceGrant("messages", "view")),
} as const;

export const messagingAccess = anyOf(features.messages.read, features.workspaceMessages.read);

export const scheduleAccess = anyOf(features.schedule.read, features.stages.read, features.keyDates.read);
/** Staging bytes never authorizes attaching them to a protected record. */
export const uploadAccess = anyOf(features.documents.actions.create, features.documents.actions.markup,
  features.updates.actions.create, features.dailyLog.actions.create, features.materialOrders.actions.create,
  features.expenses.actions.create, features.rfis.actions.create, features.rfis.actions.comment,
  features.changeRequests.actions.create, features.changeRequests.actions.comment);
