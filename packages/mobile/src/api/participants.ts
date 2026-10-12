import { request } from "./client";

export type ParticipantStatus = "invited" | "active" | "revoked";

export const PARTICIPANT_STATUS = {
  INVITED: "invited",
  ACTIVE: "active",
  REVOKED: "revoked",
} as const satisfies Record<string, ParticipantStatus>;

export interface ProjectParticipant {
  id: string;
  projectId: string;
  userId: string | null;
  name: string | null;
  email: string;
  status: ParticipantStatus;
}

export interface CommentAssignee {
  id: string;
  name: string;
}

/** What the signed-in user may do on a project, as the server enforces it. */
export interface ProjectAccess {
  /** Effective resource permissions, e.g. { materials: ["view", "request"] }. */
  permissions: Record<string, string[]>;
}

export const participantsApi = {
  list: (projectId: string) =>
    request<ProjectParticipant[]>(`/projects/${projectId}/participants`),

  access: (projectId: string) => request<ProjectAccess>(`/projects/${projectId}/access`),
};

/** People who can be tagged on a comment: active members with a real account. */
export function toAssignees(participants: ProjectParticipant[]): CommentAssignee[] {
  return participants.flatMap((p) =>
    p.userId && p.status === PARTICIPANT_STATUS.ACTIVE
      ? [{ id: p.userId, name: p.name ?? p.email }]
      : [],
  );
}
