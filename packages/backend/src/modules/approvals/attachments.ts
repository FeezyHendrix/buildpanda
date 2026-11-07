import { NotFoundError, ValidationError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { ApprovalsDeps } from "./notify.ts";
import type { ApprovalsRepository, AttachmentWithFile } from "./repository.ts";
import type { ApprovalAttachment, ApprovalAttachmentRow } from "./types.ts";

export type AttachmentPick = { fileId: string } | { documentId: string; documentVersionId: string };

// What a request may attach (docs/approval-request-form-backend.md §2.2).
export const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_MIME_TYPES = new Set(["image/png", "image/jpeg", "application/pdf"]);

const fields = (attachments: string) => ({ fields: { attachments } });

export function approvalAttachments(repository: ApprovalsRepository, deps: ApprovalsDeps) {
  async function present(rows: AttachmentWithFile[], viewerMayOpen: boolean): Promise<ApprovalAttachment[]> {
    return Promise.all(
      rows.map(async (a) => ({
        id: a.id,
        fileName: a.file.file_name,
        mimeType: a.file.mime_type,
        sizeBytes: Number(a.file.size_bytes),
        url: viewerMayOpen && deps.files ? await deps.files.presignViewUrl(a.file) : null,
        documentId: a.document_id,
        documentVersionId: a.document_version_id,
        isSuperseded: a.document_version_id !== null && a.current_version_id !== null && a.current_version_id !== a.document_version_id,
      })),
    );
  }

  return {
    present,

    /** Every revision's rows for a page of approvals, grouped, in one query. */
    async rowsFor(approvalIds: string[]): Promise<Map<string, AttachmentWithFile[]>> {
      const grouped = new Map<string, AttachmentWithFile[]>();
      for (const r of await repository.listAttachments(approvalIds)) {
        grouped.set(r.approval_id, [...(grouped.get(r.approval_id) ?? []), r]);
      }
      return grouped;
    },

    /** The current revision's attachments, capped for the list, plus the full count. */
    async current(rows: AttachmentWithFile[] | undefined, revision: number, viewerMayOpen: boolean, limit = Infinity) {
      const mine = (rows ?? []).filter((r) => r.revision === revision);
      return { attachments: await present(mine.slice(0, limit), viewerMayOpen), count: mine.length };
    },

    // The UI checks are convenience; this is the rule. Errors name the file.
    async validate(
      projectId: string,
      approvalId: string,
      userId: string,
      picked: AttachmentPick[],
      revision: number,
    ): Promise<ApprovalAttachmentRow[]> {
      if (picked.length === 0) return [];
      if (picked.length > MAX_ATTACHMENTS) {
        throw new ValidationError(`At most ${MAX_ATTACHMENTS} attachments per request`, fields("too_many"));
      }
      const keys = picked.map((p) => ("fileId" in p ? p.fileId : p.documentVersionId));
      if (new Set(keys).size !== keys.length) throw new ValidationError("The same file is attached twice", fields("duplicate"));

      const fileIds = picked.flatMap((p) => ("fileId" in p ? [p.fileId] : []));
      if (fileIds.length > 0 && !deps.files) {
        throw new ValidationError("File upload is not switched on for approvals", fields("unavailable"));
      }
      const files = new Map((deps.files ? await deps.files.findRows(fileIds) : []).map((f) => [f.id, f]));
      const taken = new Set(await repository.attachedFileIds(fileIds, approvalId));
      const now = new Date().toISOString();
      const rows: ApprovalAttachmentRow[] = [];
      for (const [position, pick] of picked.entries()) {
        const row: ApprovalAttachmentRow = {
          id: generateId("apra"),
          approval_id: approvalId,
          file_id: null,
          document_id: null,
          document_version_id: null,
          position,
          revision,
          created_by: userId,
          created_at: now,
        };
        if ("fileId" in pick) {
          const f = files.get(pick.fileId);
          if (!f || f.project_id !== projectId || f.owner_id !== userId) {
            throw new ValidationError("That file is not one you uploaded to this project", fields(pick.fileId));
          }
          // shortcut: trusts the mime type recorded at upload, sniff the bytes if a mislabelled file ever gets through.
          if (!ATTACHMENT_MIME_TYPES.has(f.mime_type)) {
            throw new ValidationError(`${f.file_name}: only PNG, JPG or PDF files can be attached`, fields(pick.fileId));
          }
          if (Number(f.size_bytes) > MAX_ATTACHMENT_BYTES) {
            throw new ValidationError(`${f.file_name}: attachments must be 10 MB or smaller`, fields(pick.fileId));
          }
          if (taken.has(pick.fileId)) {
            throw new ValidationError(`${f.file_name} is already attached to another request`, fields(pick.fileId));
          }
          row.file_id = pick.fileId;
        } else {
          if (!deps.documents) throw new ValidationError("Document attachments are not available", fields("unavailable"));
          // Proves the version belongs to this document and the document to this project.
          await deps.documents.resolveVersionFile(projectId, pick.documentId, pick.documentVersionId).catch((e) => {
            if (e instanceof NotFoundError) throw new ValidationError("That document is not on this project", fields(pick.documentVersionId));
            throw e;
          });
          row.document_id = pick.documentId;
          row.document_version_id = pick.documentVersionId;
        }
        rows.push(row);
      }
      return rows;
    },
  };
}
