import api from "./client";
import type { Culpability } from "@/lib/project-types";

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
  culpability: Culpability | string;
  eotClaimable: boolean;
  startedAt: string;
}

export interface EotClaim {
  id: string;
  projectId: string;
  number: number;
  /** "EOT-001" — the reference the claim is argued under. */
  reference: string;
  title: string;
  daysClaimed: number;
  /** Null until decided; 0 when rejected. */
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

export interface UpsertEotClaimInput {
  title: string;
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

/** The offending delay ids a 400 names when a claim cites a contractor-culpable delay. */
export interface EotClaimableDetails {
  delayIds?: string[];
}

const base = (projectId: string) => `/projects/${projectId}/extensions-of-time`;

export const extensionsOfTimeApi = {
  list: (projectId: string) => api.get<EotClaim[]>(base(projectId)).then((r) => r.data),

  create: (projectId: string, body: UpsertEotClaimInput) =>
    api.post<EotClaim>(base(projectId), body).then((r) => r.data),

  update: (projectId: string, claimId: string, body: Partial<UpsertEotClaimInput>) =>
    api.patch<EotClaim>(`${base(projectId)}/${claimId}`, body).then((r) => r.data),

  submit: (projectId: string, claimId: string) =>
    api.post<EotClaim>(`${base(projectId)}/${claimId}/submit`).then((r) => r.data),

  decide: (projectId: string, claimId: string, body: DecideEotClaimInput) =>
    api.post<EotClaim>(`${base(projectId)}/${claimId}/decide`, body).then((r) => r.data),
};
