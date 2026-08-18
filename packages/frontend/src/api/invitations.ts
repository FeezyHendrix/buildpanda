import api from "./client";

// Public — no session required. The invited person has no account yet, and
// better-auth's own organization.get-invitation / reject-invitation both demand
// a session (checked inline in their handlers, not just via middleware), so
// these read/decline paths go through our own endpoints instead.

export interface PublicInvitation {
  organizationName: string;
  email: string;
  role: string;
  status: string;
}

export const invitationsApi = {
  getPublic: (invitationId: string) =>
    api.get<PublicInvitation>(`/v2/invitations/${invitationId}`).then((r) => r.data),

  declinePublic: (invitationId: string) =>
    api.post(`/v2/invitations/${invitationId}/decline`).then(() => undefined),
};
