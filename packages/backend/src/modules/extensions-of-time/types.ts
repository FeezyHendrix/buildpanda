export const EOT_STATUSES = ["Draft", "Submitted", "Approved", "Rejected"] as const;
export type EotStatus = (typeof EOT_STATUSES)[number];

export const EOT_DECISIONS = ["Approved", "Rejected"] as const;
export type EotDecision = (typeof EOT_DECISIONS)[number];

/** One delay cited on a claim, with the attribution that made it claimable. */
export interface EotClaimDelay {
  id: string;
  activityId: string;
  activityName: string;
  reasonCode: string;
  daysLost: number;
  culpability: string;
  eotClaimable: boolean;
  startedAt: string;
}

export interface EotClaim {
  id: string;
  projectId: string;
  number: number;
  reference: string;
  title: string;
  daysClaimed: number;
  daysAwarded: number | null;
  status: EotStatus;
  reason: string | null;
  delayIds: string[];
  delays: EotClaimDelay[];
  changeRequestId: string | null;
  decidedById: string | null;
  decidedAt: string | null;
  submittedAt: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EotClaimRow {
  id: string;
  project_id: string;
  number: number;
  title: string;
  days_claimed: number;
  days_awarded: number | null;
  applied_days: number;
  status: EotStatus;
  reason: string | null;
  delay_ids: string[] | string;
  change_request_id: string | null;
  decided_by_id: string | null;
  decided_at: Date | string | null;
  submitted_at: Date | string | null;
  notes: string | null;
  created_by_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface NewEotClaimRecord {
  id: string;
  project_id: string;
  number: number;
  title: string;
  days_claimed: number;
  status: EotStatus;
  reason: string | null;
  delay_ids: string;
  change_request_id: string | null;
  notes: string | null;
  created_by_id: string | null;
}

export interface EotClaimPatch {
  title?: string;
  days_claimed?: number;
  days_awarded?: number | null;
  applied_days?: number;
  status?: EotStatus;
  reason?: string | null;
  delay_ids?: string;
  change_request_id?: string | null;
  decided_by_id?: string | null;
  decided_at?: string | null;
  submitted_at?: string | null;
  notes?: string | null;
}

export interface CreateEotClaimInput {
  title: string;
  daysClaimed?: number;
  reason?: string | null;
  delayIds?: string[];
  changeRequestId?: string | null;
  notes?: string | null;
}

export interface UpdateEotClaimInput {
  title?: string;
  daysClaimed?: number;
  reason?: string | null;
  delayIds?: string[];
  changeRequestId?: string | null;
  notes?: string | null;
}

export interface DecideEotClaimInput {
  decision: EotDecision;
  daysAwarded?: number;
  notes?: string | null;
}

/** Aggregate EOT position for the schedule snapshot and Panda AI. */
export interface EotPosition {
  daysApproved: number;
  daysPending: number;
  claimCount: number;
}
