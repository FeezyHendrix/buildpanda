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

export const participantsApi = {
  list: (projectId: string) =>
    request<ProjectParticipant[]>(`/projects/${projectId}/participants`),
};

/** People who can be tagged on a comment: active members with a real account. */
export function toAssignees(participants: ProjectParticipant[]): CommentAssignee[] {
  return participants.flatMap((p) =>
    p.userId && p.status === PARTICIPANT_STATUS.ACTIVE
      ? [{ id: p.userId, name: p.name ?? p.email }]
      : [],
  );
}
