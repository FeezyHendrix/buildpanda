import { sendMessageBody } from "../messaging/route-schemas.ts";
import { createUpdateBody, editUpdateBody, updateCommentBody } from "../updates/route-schemas.ts";
import { createDocumentBody, editDocumentBody, addVersionBody } from "../documents/route-schemas.ts";
import { createMarkupBody, createCommentBody, resolveBody } from "../drawing-markup/route-schemas.ts";
import { createBody as createRfiBody } from "../rfis/route-schemas.ts";
import { createBody as createMaterialApprovalBody } from "../approvals/material-schemas.ts";

const id = { type: "string", minLength: 1, maxLength: 100 } as const;
function target<T extends { properties: object; required?: readonly string[] }>(schema: T, key: string) {
  return { ...schema, required: [...(schema.required ?? []), key], properties: { ...schema.properties, [key]: id } } as const;
}
function onlyTarget(key: string) {
  return { type: "object", required: [key], additionalProperties: false, properties: { [key]: id } } as const;
}
const documentRead = { ...onlyTarget("documentId"), properties: { documentId: id, versionId: id } } as const;
const { sourceMarkupId: _rfiSource, ...rfiFields } = createRfiBody.properties;
const { sourceMarkupId: _approvalSource, ...approvalFields } = createMaterialApprovalBody.properties;
const followUp = { oneOf: [
  { type: "object", required: ["kind", "payload"], additionalProperties: false, properties: { kind: { const: "rfi" }, payload: { ...createRfiBody, properties: rfiFields } } },
  { type: "object", required: ["kind", "payload"], additionalProperties: false, properties: { kind: { const: "create_material_approval" }, payload: { ...createMaterialApprovalBody, properties: approvalFields } } },
] } as const;

/** Canonical REST fields remain the validation source; only explicit targets are added. */
export const collaborationSchemas = {
  send_message: { ...sendMessageBody, description: "Send the stated message to an authorized existing channel. Only when the user explicitly chooses this project's General channel, set projectGeneral:true and omit channelId; General is ensured only after confirmation. Never choose an unstated recipient.",
    properties: { ...sendMessageBody.properties, channelId: id, projectGeneral: { type: "boolean", enum: [true] } }, oneOf: [{ required: ["channelId"] }, { required: ["projectGeneral"] }] },
  send_direct_message: target(sendMessageBody, "userId"),
  reply_message: target(sendMessageBody, "messageId"),
  create_project_update: createUpdateBody,
  edit_project_update: { ...target(editUpdateBody, "updateId"), minProperties: 2 },
  delete_project_update: onlyTarget("updateId"),
  comment_project_update: target(updateCommentBody, "updateId"),
  upload_document: { ...createDocumentBody, required: ["fileId"] },
  rename_document: { ...target(editDocumentBody, "documentId"), minProperties: 2 },
  upload_document_version: target(addVersionBody, "documentId"),
  download_document: documentRead,
  open_document: documentRead,
  delete_document: onlyTarget("documentId"),
  annotate_drawing: { ...createMarkupBody, required: [...createMarkupBody.required, "pageNo"], properties: { ...createMarkupBody.properties, comment: createCommentBody, followUp } },
  comment_drawing: target(createCommentBody, "markupId"),
  resolve_drawing: target(resolveBody, "markupId"),
  delete_drawing: onlyTarget("markupId"),
} as const;
