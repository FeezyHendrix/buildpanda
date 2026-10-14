import type { Db } from "./client";
import { requireDbPermission, requireLocalRecord } from "./permissions";
import { projectAccess } from "@/lib/project-access-store";
import { documents, drawingMarkups } from "./schema";

export function requireMaterialApproval(db: Db, projectId: string) {
  // The legacy manage grant is accepted by the orders API, but not approvals.
  if (projectAccess.can(projectId, "materials", "manage")) return requireDbPermission(db, projectId, "materials", "manage");
  return requireDbPermission(db, projectId, "materials", "approve");
}

export function requireDrawingReference(db: Db, projectId: string, reference: {
  documentId?: string | null; documentVersionId?: string | null; sourceMarkupId?: string | null;
}) {
  if (reference.documentId) {
    const doc = requireLocalRecord(db, documents, reference.documentId, projectId, "documents", "view");
    if (reference.documentVersionId && doc.currentVersionId !== reference.documentVersionId) {
      throw new Error("This drawing revision has changed. Reopen the current revision.");
    }
  }
  if (reference.sourceMarkupId) {
    const markup = requireLocalRecord(db, drawingMarkups, reference.sourceMarkupId, projectId, "documents", "view");
    if (markup.documentId !== reference.documentId || markup.documentVersionId !== reference.documentVersionId) {
      throw new Error("The markup must belong to the referenced drawing revision.");
    }
  }
}
