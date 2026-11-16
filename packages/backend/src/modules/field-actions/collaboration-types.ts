import type { SendMessageInput } from "../messaging/types.ts";
import type { CreateUpdateInput, EditUpdateInput } from "../updates/service.ts";
import type { AddCommentInput } from "../updates/types.ts";
import type { AddVersionInput, CreateDocumentInput, EditDocumentInput } from "../documents/types.ts";
import type { CreateCommentInput, CreateMarkupInput } from "../drawing-markup/types.ts";
import type { CreateRfiInput } from "../rfis/types.ts";
import type { CreateMaterialApprovalInput } from "../approvals/material-types.ts";

export type DrawingFollowUp = { kind: "rfi"; payload: Omit<CreateRfiInput, "sourceMarkupId"> }
  | { kind: "create_material_approval"; payload: Omit<CreateMaterialApprovalInput, "sourceMarkupId"> };

export interface CollaborationPayloads {
  send_message: SendMessageInput & ({ channelId: string; projectGeneral?: never } | { projectGeneral: true; channelId?: never });
  send_direct_message: SendMessageInput & { userId: string };
  reply_message: SendMessageInput & { messageId: string };
  create_project_update: CreateUpdateInput;
  edit_project_update: EditUpdateInput & { updateId: string };
  delete_project_update: { updateId: string };
  comment_project_update: AddCommentInput & { updateId: string };
  upload_document: CreateDocumentInput & { fileId: string };
  rename_document: EditDocumentInput & { documentId: string };
  upload_document_version: AddVersionInput & { documentId: string };
  download_document: { documentId: string; versionId?: string };
  open_document: { documentId: string; versionId?: string };
  delete_document: { documentId: string };
  annotate_drawing: CreateMarkupInput & { pageNo: number; comment?: CreateCommentInput; followUp?: DrawingFollowUp };
  comment_drawing: CreateCommentInput & { markupId: string };
  resolve_drawing: { markupId: string; resolved: boolean };
  delete_drawing: { markupId: string };
}
