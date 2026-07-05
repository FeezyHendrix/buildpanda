import api from "./client";

export type TeamMemberStatus = "Active" | "Inactive";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  responsibilities: string | null;
  status: TeamMemberStatus;
}

export interface TeamMemberInput {
  name: string;
  role: string;
  company?: string;
  email?: string;
  phone?: string;
  responsibilities?: string;
  status: TeamMemberStatus;
}

export const teamApi = {
  list: (projectId: string) =>
    api.get<TeamMember[]>(`/projects/${projectId}/team-members`).then((r) => r.data),
    
  create: (projectId: string, body: TeamMemberInput) =>
    api.post<TeamMember>(`/projects/${projectId}/team-members`, body).then((r) => r.data),
    
  update: (projectId: string, memberId: string, patch: TeamMemberInput) =>
    api.put<TeamMember>(`/projects/${projectId}/team-members/${memberId}`, patch).then((r) => r.data),
    
  delete: (projectId: string, memberId: string) =>
    api.delete(`/projects/${projectId}/team-members/${memberId}`).then((r) => r.data),
};
