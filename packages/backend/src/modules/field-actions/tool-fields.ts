import type { VoiceReviewField } from "@buildpanda/voice-actions";

const sources: Record<string, string> = {
  buildingId: "buildings", stageId: "stages", phaseId: "stages", activityId: "activities", activityIds: "activities",
  taskId: "tasks", columnId: "taskColumns", rfiId: "rfis", changeRequestId: "changeRequests", orderId: "materialOrders", materialOrderId: "materialOrders",
  approvalId: "materialApprovals", documentId: "documents", supersedesId: "documents", documentVersionId: "documentVersions", versionId: "documentVersions",
  templateId: "templates", supplierId: "suppliers", assigneeId: "assignees", assigneeTeamMemberId: "teamMembers", requestedReviewerId: "reviewers", receivedById: "assignees", ballInCourtId: "assignees",
  fileId: "files", fileIds: "files", receiptFileId: "files", audioFileId: "files", channelId: "sendableChannels", messageId: "replyTargets", parentMessageId: "replyTargets", quotedMessageId: "replyTargets",
  userId: "workspaceMembers", categoryId: "documentCategories", markupId: "markups", sourceMarkupId: "markups", lookAheadId: "lookAheads",
};

/** Canonical schemas define keys and types; shared form hints supply compatible labels and rich mirrors. */
export function canonicalToolFields(kind: string, schema: object, original: VoiceReviewField[]): VoiceReviewField[] {
  const legacy = new Map(original.map((field) => [field.name, field]));
  const fields = new Map<string, VoiceReviewField>();
  function visit(value: unknown, path = "") {
    if (!value || typeof value !== "object") return;
    const node = value as { properties?: Record<string, unknown>; required?: string[]; oneOf?: unknown[]; anyOf?: unknown[]; items?: unknown };
    for (const [name, property] of Object.entries(node.properties ?? {})) {
      const fullName = path ? `${path}.${name}` : name;
      const detail = property as { type?: string | string[]; enum?: unknown[]; const?: unknown; minLength?: number; maxLength?: number; minimum?: number; maximum?: number; pattern?: string };
      const types = typeof detail.type === "string" ? [detail.type] : detail.type ?? (typeof detail.const === "string" ? ["string"] : []);
      const base = types.find((type) => type !== "null");
      const old = legacy.get(fullName);
      const source = /(^|\.)assignees\[\]\.id$/.test(fullName) ? "taskAssignees" : name === "entryId" ? kind === "void_daily_log_entry" ? "dailyLogEntries" : "ledgerEntries" : sources[name];
      const choices = detail.enum?.filter((entry): entry is string => typeof entry === "string");
      if (!fields.has(fullName) && base && ["string", "number", "integer", "boolean"].includes(base)) {
        const paired = name === "bodyText" ? "bodyHtml" : name === "body" ? node.properties?.bodyHtml ? "bodyHtml" : "contentHtml" : name === "reason" && node.properties?.notesHtml ? "notesHtml" : `${name}Html`;
        const htmlField = base === "string" && node.properties?.[paired] ? path ? `${path}.${paired}` : paired : undefined;
        const type = base === "boolean" ? "boolean" : base === "number" || base === "integer" ? "number" : /(?:^fileId$|FileId$)/.test(name) ? "file" : source || choices?.length ? "select" : htmlField ? "rich_text" : old?.type === "date" || detail.pattern?.includes("\\d{4}") ? "date" : old?.type === "long_text" || (detail.maxLength ?? 0) > 300 ? "long_text" : "text";
        fields.set(fullName, { name: fullName, label: old?.label ?? name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/Ids?$/, "").replace(/^./, (letter) => letter.toUpperCase()), type,
          required: node.required?.includes(name) ?? false, ...(source ? { source } : {}), ...(/(^|\.)assignees\[\]\.id$/.test(fullName) ? { sourceBy: { field: "kind", sources: { user: "assignees", team: "teamMembers" } } } : {}), ...(choices?.length ? { choices } : {}), ...(htmlField ? { htmlField } : {}),
          ...(old?.images !== undefined ? { images: old.images } : {}), ...(old?.helpText ? { helpText: old.helpText } : {}), ...(detail.minimum !== undefined ? { min: detail.minimum } : {}), ...(detail.maximum !== undefined ? { max: detail.maximum } : {}) });
      }
      visit(property, fullName);
    }
    for (const branch of [...node.oneOf ?? [], ...node.anyOf ?? []]) visit(branch, path);
    if (node.items) visit(node.items, `${path}[]`);
  }
  visit(schema);
  return [...fields.values()];
}
