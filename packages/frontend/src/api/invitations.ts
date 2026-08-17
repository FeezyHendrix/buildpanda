import api from "./client";

// Public — no session required. See docs/invitation-public-decline-backend.md
// for the backend contract; neither endpoint exists on the backend yet.
// better-auth's own organization.get-invitation/reject-invitation both
// require a session (checked inline in their handlers, not just via
// middleware), so a person without an account can't use them.

// ── TEMPORARY LOCAL MOCK ─────────────────────────────────────────────────────
// Dev-only stand-in until the backend ships GET /v2/invitations/:id and
// POST /v2/invitations/:id/decline (see docs/invitation-public-decline-backend.md).
// Remove this block and the mock branches once those endpoints exist. The mock
// never runs in production builds; no network call is made when it is active,
// so stale invitation data can't leak into real usage.
const MOCK_PUBLIC_INVITATION: PublicInvitation = {
  organizationName: "Shalom Construction Ltd.",
  email: "invited@team.com",
  role: "member",
  status: "pending",
};

const useMockPublicInvitation = import.meta.env.DEV;

export interface PublicInvitation {
  organizationName: string;
  email: string;
  role: string;
  status: string;
}

export const invitationsApi = {
  getPublic: (invitationId: string) => {
    if (useMockPublicInvitation) {
      return Promise.resolve({ ...MOCK_PUBLIC_INVITATION });
    }
    return api
      .get<PublicInvitation>(`/v2/invitations/${invitationId}`)
      .then((r) => r.data);
  },
  declinePublic: (invitationId: string) => {
    if (useMockPublicInvitation) {
      return Promise.resolve(undefined);
    }
    return api.post(`/v2/invitations/${invitationId}/decline`).then(() => undefined);
  },
};
