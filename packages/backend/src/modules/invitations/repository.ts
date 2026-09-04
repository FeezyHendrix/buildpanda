import type { Knex } from "knex";
import type { InvitationWithOrgRow } from "./types.ts";

export interface InvitationsRepository {
  pendingById(id: string): Promise<InvitationWithOrgRow | undefined>;
  markRejected(id: string): Promise<number>;
}

export function invitationsRepository(db: Knex): InvitationsRepository {
  return {
    // "Pending" means the same thing here as in lib/auth.ts's
    // hasPendingInvitation: not yet resolved, and either open-ended or unexpired.
    pendingById: (id) =>
      db("invitation as i")
        .join("organization as o", "o.id", "i.organizationId")
        .where("i.id", id)
        .andWhere("i.status", "pending")
        .andWhere((q) => q.whereNull("i.expiresAt").orWhere("i.expiresAt", ">", new Date()))
        .first<InvitationWithOrgRow | undefined>(
          "i.id as id",
          "i.organizationId as organizationId",
          "i.email as email",
          "i.role as role",
          "i.status as status",
          "i.expiresAt as expiresAt",
          "i.inviterId as inviterId",
          "o.name as organizationName",
        ),

    // Guarded on status so a double-submit cannot resurrect and re-reject an
    // invitation that was accepted in between.
    markRejected: (id) =>
      db("invitation").where({ id, status: "pending" }).update({ status: "rejected" }),
  };
}
