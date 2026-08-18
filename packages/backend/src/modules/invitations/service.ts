import { AppError } from "../../lib/errors.ts";
import type { InvitationsRepository } from "./repository.ts";
import type { InvitationWithOrgRow, PublicInvitation } from "./types.ts";

/**
 * One 404 for every failure mode — missing, expired, already accepted, already
 * rejected. Distinguishing them would turn the endpoint into an oracle for
 * probing which invitation ids exist.
 */
function invitationNotFound(): AppError {
  return new AppError("Invitation not found", {
    statusCode: 404,
    code: "invitation_not_found",
  });
}

function toPublicInvitation(row: InvitationWithOrgRow): PublicInvitation {
  return {
    organizationName: row.organizationName,
    email: row.email,
    role: row.role ?? "member",
    status: row.status,
  };
}

export function invitationsService(repo: InvitationsRepository) {
  return {
    async getPublic(id: string): Promise<PublicInvitation> {
      const row = await repo.pendingById(id);
      if (!row) throw invitationNotFound();
      return toPublicInvitation(row);
    },

    async decline(id: string): Promise<{ ok: true }> {
      const row = await repo.pendingById(id);
      if (!row) throw invitationNotFound();
      const updated = await repo.markRejected(id);
      if (updated === 0) throw invitationNotFound();
      return { ok: true };
    },
  };
}
