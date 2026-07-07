// Bump when the data-protection commitment text changes materially; owners are
// re-prompted to accept the new version. Kept in code so a deploy carries it.
export const CURRENT_COMMITMENT_VERSION = "1.0";

export interface DataCommitmentStatus {
  version: string;
  accepted: boolean;
  acceptedAt: string | null;
  acceptedByName: string | null;
}

export interface OrgDataCommitmentRow {
  id: string;
  org_id: string;
  version: string;
  accepted_by_user_id: string | null;
  accepted_by_name: string;
  accepted_at: Date | string;
}
