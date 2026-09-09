/** Row shape of better-auth's `invitation` table (20260603_organization_schema). */
export interface InvitationRow {
  id: string;
  organizationId: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date | string | null;
  inviterId: string;
}

export interface InvitationWithOrgRow extends InvitationRow {
  organizationName: string;
}

/**
 * What an unauthenticated caller is allowed to see. Deliberately omits
 * inviterId and every other column: the only credential here is the invitation
 * id, so the response must not become a way to enumerate people in an org.
 */
export interface PublicInvitation {
  organizationName: string;
  email: string;
  role: string;
  status: string;
}
