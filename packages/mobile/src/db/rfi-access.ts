import { and, eq, inArray, type SQL } from "drizzle-orm";
import { AccessDeniedError, projectAccess } from "@/lib/project-access-store";
import { features } from "@/lib/feature-access";
import type { Db } from "./client";
import { repositoryAccess } from "./permissions";
import { rfiComments, rfis } from "./schema";

const access = repositoryAccess(features.rfis);
const canViewInternal = () => projectAccess.getState().snapshot?.capabilities.canViewInternalRfis === true;

/** Visibility is independent of workflow status: an open RFI may still be internal. */
export function rfiReadWhere(db: Db, ...conditions: (SQL | undefined)[]) {
  return access.where(db, rfis.projectId, ...conditions, canViewInternal() ? undefined : eq(rfis.visibility, "shared"));
}

export function rfiCommentReadWhere(db: Db, ...conditions: (SQL | undefined)[]) {
  const visibleParents = db.select({ id: rfis.id }).from(rfis).where(rfiReadWhere(db));
  return access.where(db, rfiComments.projectId, ...conditions, inArray(rfiComments.rfiId, visibleParents),
    canViewInternal() ? undefined : eq(rfiComments.isProposedResponse, false));
}

export function requireRfiRead(db: Db, projectId: string, id: string) {
  access.require(db, projectId);
  const row = db.select().from(rfis).where(and(rfiReadWhere(db), eq(rfis.id, id), eq(rfis.projectId, projectId))).get();
  if (!row) throw new AccessDeniedError("This RFI is not available in the selected project.");
  return row;
}
