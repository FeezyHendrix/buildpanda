import api from "./client";
import type {
  MyProjectCard,
  ParticipantPermissions,
  ParticipantRole,
  ProjectAccess,
  ProjectParticipant,
} from "@/lib/project-types";

export type ParticipantGrants = Record<string, string[]>;

export interface InviteParticipantInput {
  email: string;
  name?: string;
  role?: string;
  permissions?: ParticipantPermissions;
  grants?: ParticipantGrants;
}

export interface UpdateParticipantInput {
  role?: string;
  permissions?: ParticipantPermissions;
  grants?: ParticipantGrants;
}

export interface PermissionCatalog {
  resources: Record<string, string[]>;
  privileged: Record<string, string[]>;
  presets: Record<string, Record<string, string[]>>;
}

export interface ProjectInvitePreview {
  email: string;
  role: ParticipantRole;
  projectName: string;
  inviterName: string | null;
  expired: boolean;
}

export const participantsApi = {
  getCatalog: () =>
    api.get<PermissionCatalog>("/permissions/catalog").then((r) => r.data),

  getAccess: (projectId: string) =>
    api.get<ProjectAccess>(`/projects/${projectId}/access`).then((r) => r.data),

  getMyProjects: () =>
    api.get<MyProjectCard[]>("/me/projects").then((r) => r.data),

  list: (projectId: string) =>
    api.get<ProjectParticipant[]>(`/projects/${projectId}/participants`).then((r) => r.data),

  invite: (projectId: string, body: InviteParticipantInput) =>
    api.post<ProjectParticipant>(`/projects/${projectId}/participants/invite`, body).then((r) => r.data),

  update: (projectId: string, participantId: string, body: UpdateParticipantInput) =>
    api.patch<ProjectParticipant>(`/projects/${projectId}/participants/${participantId}`, body).then((r) => r.data),

  remove: (projectId: string, participantId: string) =>
    api.delete(`/projects/${projectId}/participants/${participantId}`).then((r) => r.data),

  getInvite: (token: string) =>
    api.get<ProjectInvitePreview>(`/project-invites/${token}`).then((r) => r.data),

  acceptInvite: (token: string) =>
    api.post<{ projectId: string; role: string }>(`/project-invites/${token}/accept`).then((r) => r.data),
};
