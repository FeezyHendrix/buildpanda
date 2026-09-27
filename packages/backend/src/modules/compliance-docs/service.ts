import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { ComplianceDocsRepository } from "./repository.ts";
import {
  COMPLIANCE_EXPIRING_WINDOW_DAYS,
  type ComplianceDoc,
  type ComplianceDocRow,
  type ComplianceDocStatus,
  type CreateComplianceDocInput,
  type UpdateComplianceDocInput,
} from "./types.ts";

/** What the service needs from the files module: a stored file by id. */
export interface StoredFileLookup {
  (fileId: string): Promise<{ id: string; file_name: string; storage_path: string; owner_id: string } | undefined>;
}

function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const target = new Date(String(date).slice(0, 10)).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function complianceStatus(expiryDate: Date | string | null): {
  status: ComplianceDocStatus;
  daysUntilExpiry: number | null;
} {
  const days = daysUntil(expiryDate);
  if (days === null) return { status: "no_expiry", daysUntilExpiry: null };
  if (days < 0) return { status: "expired", daysUntilExpiry: days };
  if (days <= COMPLIANCE_EXPIRING_WINDOW_DAYS) return { status: "expiring", daysUntilExpiry: days };
  return { status: "valid", daysUntilExpiry: days };
}

export function toComplianceDoc(r: ComplianceDocRow): ComplianceDoc {
  const { status, daysUntilExpiry } = complianceStatus(r.expiry_date);
  return {
    id: r.id,
    docType: r.doc_type,
    fileName: r.file_name,
    fileId: r.file_id,
    reference: r.reference,
    notes: r.notes,
    expiryDate: r.expiry_date ? String(r.expiry_date).slice(0, 10) : null,
    status,
    daysUntilExpiry,
    uploadedBy: r.uploaded_by,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export function complianceDocsService(repo: ComplianceDocsRepository, findFile: StoredFileLookup) {
  async function assertOwned(orgId: string, id: string): Promise<ComplianceDocRow> {
    const row = await repo.byId(id);
    if (!row || row.org_id !== orgId) throw new NotFoundError("Compliance document");
    return row;
  }

  return {
    async list(orgId: string): Promise<ComplianceDoc[]> {
      return (await repo.listByOrg(orgId)).map(toComplianceDoc);
    },

    async get(orgId: string, id: string): Promise<ComplianceDoc> {
      return toComplianceDoc(await assertOwned(orgId, id));
    },

    // The file is uploaded first through /files; the document row points at it
    // so the same storage, presigning and cleanup rules apply.
    async create(orgId: string, userId: string, input: CreateComplianceDocInput): Promise<ComplianceDoc> {
      const file = await findFile(input.fileId);
      if (!file) throw new NotFoundError("Uploaded file");
      if (file.owner_id !== userId) throw new BadRequestError("Upload the file yourself before filing it");
      const row = await repo.insert({
        id: generateId("pcd"),
        org_id: orgId,
        file_name: file.file_name,
        storage_path: file.storage_path,
        file_id: file.id,
        doc_type: input.docType,
        reference: input.reference?.trim() || null,
        notes: input.notes?.trim() || null,
        expiry_date: input.expiryDate ?? null,
        uploaded_by: userId,
      });
      return toComplianceDoc(row);
    },

    async update(orgId: string, id: string, input: UpdateComplianceDocInput): Promise<ComplianceDoc> {
      await assertOwned(orgId, id);
      const patch: Parameters<ComplianceDocsRepository["update"]>[1] = {};
      if (input.docType !== undefined) patch.doc_type = input.docType;
      if (input.reference !== undefined) patch.reference = input.reference?.trim() || null;
      if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
      if (input.expiryDate !== undefined) {
        patch.expiry_date = input.expiryDate;
        // a new expiry date restarts the reminder cycle
        patch.expiring_notified_at = null;
        patch.expired_notified_at = null;
      }
      const updated = await repo.update(id, patch);
      return toComplianceDoc(updated!);
    },

    async remove(orgId: string, id: string): Promise<{ ok: true }> {
      await assertOwned(orgId, id);
      await repo.delete(id, orgId);
      return { ok: true };
    },

    async storagePathFor(orgId: string, id: string): Promise<{ storagePath: string; fileName: string }> {
      const row = await assertOwned(orgId, id);
      return { storagePath: row.storage_path, fileName: row.file_name };
    },
  };
}
