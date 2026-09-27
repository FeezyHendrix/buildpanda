export const PARTICIPANT_STATUSES = ["invited", "active", "revoked"] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export const PARTICIPANT_SIDES = ["client", "contractor", "consultant"] as const;
export type ParticipantSide = (typeof PARTICIPANT_SIDES)[number];

/** Free-form: a starter preset name ("resident_engineer") or a custom label. */
export type ParticipantRole = string;

export interface ParticipantRow {
  id: string;
  project_id: string;
  user_id: string | null;
  email: string;
  role: ParticipantRole;
  side: ParticipantSide | null;
  status: ParticipantStatus;
  invited_by_id: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  name?: string | null;
  permissions: Record<string, string> | null;
  grants: Record<string, string[]> | null;
  created_at: string;
  updated_at: string;
}

export interface TeamEntry {
  id: string;
  projectId: string;
  userId: string | null;
  name: string | null;
  email: string;
  role: ParticipantRole | "owner";
  /** Which side of the contract they sit on; null until recorded. */
  side: ParticipantSide | null;
  /**
   * "invited" people are assignable — ball-in-court, task assignee, inspector —
   * before they accept. Work is handed to a person, not to a login.
   */
  status: ParticipantStatus;
  permissions: Record<string, string>;
  grants: Record<string, string[]> | null;
  createdAt: string;
}

export interface InviteParticipantBody {
  email: string;
  name?: string;
  role?: ParticipantRole;
  side?: ParticipantSide;
  permissions?: Record<string, string>;
  grants?: Record<string, string[]>;
}

export interface UpdateParticipantBody {
  role?: ParticipantRole;
  side?: ParticipantSide;
  status?: ParticipantStatus;
  permissions?: Record<string, string>;
  grants?: Record<string, string[]>;
}
