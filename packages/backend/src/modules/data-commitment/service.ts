import type { DataCommitmentRepository } from "./repository.ts";
import { CURRENT_COMMITMENT_VERSION, type DataCommitmentStatus, type OrgDataCommitmentRow } from "./types.ts";

function toStatus(row: OrgDataCommitmentRow | undefined): DataCommitmentStatus {
  return {
    version: CURRENT_COMMITMENT_VERSION,
    accepted: Boolean(row),
    acceptedAt: row ? new Date(row.accepted_at).toISOString() : null,
    acceptedByName: row?.accepted_by_name ?? null,
  };
}

export function dataCommitmentService(repository: DataCommitmentRepository) {
  return {
    async status(orgId: string): Promise<DataCommitmentStatus> {
      const row = await repository.findForOrgVersion(orgId, CURRENT_COMMITMENT_VERSION);
      return toStatus(row);
    },

    async accept(orgId: string, actor: { id: string; name: string }): Promise<DataCommitmentStatus> {
      const row = await repository.accept({
        orgId,
        version: CURRENT_COMMITMENT_VERSION,
        acceptedByUserId: actor.id,
        acceptedByName: actor.name,
      });
      return toStatus(row);
    },
  };
}

export type DataCommitmentService = ReturnType<typeof dataCommitmentService>;
