import { useMutation, useQuery } from "@tanstack/react-query";
import { invitationsApi } from "@/api/invitations";

// For a signed-out visitor viewing/declining an invitation before they have
// an account — see useInvitation/useRejectInvitation in use-organization.ts
// for the authenticated (better-auth) equivalents used once signed in.

export function usePublicInvitation(invitationId: string | undefined, options: { enabled: boolean }) {
  return useQuery({
    queryKey: ["invitations", "public", invitationId ?? "__none__"],
    queryFn: () => invitationsApi.getPublic(invitationId!),
    enabled: Boolean(invitationId) && options.enabled,
    retry: false,
  });
}

export function useDeclinePublicInvitation() {
  return useMutation({
    mutationFn: (invitationId: string) => invitationsApi.declinePublic(invitationId),
  });
}
