import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { organizationKeys, projectKeys } from "./query-keys";

function unwrap<T>(result: { data: T; error: { message?: string } | null }): T {
  if (result.error) {
    throw new Error(result.error.message ?? "Organization request failed.");
  }
  return result.data;
}

// Static role types are narrowed by the client, but dynamic access control
// allows custom role names (validated server-side), so widen at this boundary.
type InviteRole = Parameters<
  typeof authClient.organization.inviteMember
>[0]["role"];
type UpdateMemberRoleType = Parameters<
  typeof authClient.organization.updateMemberRole
>[0]["role"];

export function useActiveOrganizationId(): string | undefined {
  const { data: session } = authClient.useSession();
  return session?.session.activeOrganizationId ?? undefined;
}

/**
 * Returns the current user's role in their active org (e.g. "owner", "admin",
 * "member", "viewer"). Returns null while loading or if not in an org.
 * Shares the same React Query cache as useMembers(), so pages that already
 * call useMembers() get this for free.
 */
export function useMyOrgRole(): string | null {
  const { data: session } = authClient.useSession();
  const orgId = useActiveOrganizationId();
  const { data: membersData } = useMembers(orgId);
  const userId = session?.user.id;
  if (!userId || !membersData) return null;
  return membersData.members.find((m) => m.userId === userId)?.role ?? null;
}

export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.list(),
    queryFn: async () => unwrap(await authClient.organization.list()),
  });
}

function slugifyOrganizationName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "company"
  );
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const name = input.name.trim();
      const organization = unwrap(
        await authClient.organization.create({
          name,
          slug: slugifyOrganizationName(name),
        }),
      );
      if (!organization) throw new Error("Could not create company.");
      await authClient.organization.setActive({ organizationId: organization.id });
      return organization;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });
}

export function useFullOrganization(organizationId: string | undefined) {
  return useQuery({
    queryKey: organizationId
      ? organizationKeys.full(organizationId)
      : organizationKeys.full("__none__"),
    queryFn: async () =>
      unwrap(
        await authClient.organization.getFullOrganization({
          query: { organizationId: organizationId! },
        }),
      ),
    enabled: Boolean(organizationId),
  });
}

export function useMembers(organizationId: string | undefined) {
  return useQuery({
    queryKey: organizationId
      ? organizationKeys.members(organizationId)
      : organizationKeys.members("__none__"),
    queryFn: async () =>
      unwrap(
        await authClient.organization.listMembers({
          query: { organizationId: organizationId! },
        }),
      ),
    enabled: Boolean(organizationId),
  });
}

export function useInvitations(organizationId: string | undefined) {
  return useQuery({
    queryKey: organizationId
      ? organizationKeys.invitations(organizationId)
      : organizationKeys.invitations("__none__"),
    queryFn: async () =>
      unwrap(
        await authClient.organization.listInvitations({
          query: { organizationId: organizationId! },
        }),
      ),
    enabled: Boolean(organizationId),
  });
}

export function useInvitation(invitationId: string | undefined) {
  return useQuery({
    queryKey: invitationId
      ? [...organizationKeys.all, "invitation", invitationId]
      : [...organizationKeys.all, "invitation", "__none__"],
    queryFn: async () =>
      unwrap(
        await authClient.organization.getInvitation({
          query: { id: invitationId! },
        }),
      ),
    enabled: Boolean(invitationId),
    retry: false,
  });
}

export function useUserInvitations() {
  return useQuery({
    queryKey: organizationKeys.userInvitations(),
    queryFn: async () =>
      unwrap(await authClient.organization.listUserInvitations()),
  });
}

export function useRoles(organizationId: string | undefined) {
  return useQuery({
    queryKey: organizationId
      ? organizationKeys.roles(organizationId)
      : organizationKeys.roles("__none__"),
    queryFn: async () =>
      unwrap(
        await authClient.organization.listRoles({
          query: { organizationId: organizationId! },
        }),
      ),
    enabled: Boolean(organizationId),
  });
}

export function useInviteMember(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; role: string }) =>
      unwrap(
        await authClient.organization.inviteMember({
          email: input.email,
          role: input.role as InviteRole,
          organizationId,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationKeys.invitations(organizationId),
      });
    },
  });
}

export function useCancelInvitation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) =>
      unwrap(
        await authClient.organization.cancelInvitation({ invitationId }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationKeys.invitations(organizationId),
      });
    },
  });
}

export function useUpdateMemberRole(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { memberId: string; role: string }) =>
      unwrap(
        await authClient.organization.updateMemberRole({
          memberId: input.memberId,
          role: input.role as UpdateMemberRoleType,
          organizationId,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationKeys.members(organizationId),
      });
    },
  });
}

export function useRemoveMember(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberIdOrEmail: string) =>
      unwrap(
        await authClient.organization.removeMember({
          memberIdOrEmail,
          organizationId,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationKeys.members(organizationId),
      });
    },
  });
}

export function useCreateRole(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      role: string;
      permission: Record<string, string[]>;
    }) =>
      unwrap(
        await authClient.organization.createRole({
          role: input.role,
          permission: input.permission,
          organizationId,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationKeys.roles(organizationId),
      });
    },
  });
}

export function useUpdateRole(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      roleName: string;
      permission: Record<string, string[]>;
    }) =>
      unwrap(
        await authClient.organization.updateRole({
          roleName: input.roleName,
          data: { permission: input.permission },
          organizationId,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationKeys.roles(organizationId),
      });
    },
  });
}

export function useDeleteRole(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roleName: string) =>
      unwrap(
        await authClient.organization.deleteRole({
          roleName,
          organizationId,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationKeys.roles(organizationId),
      });
    },
  });
}

export function useSetActiveOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (organizationId: string) =>
      unwrap(await authClient.organization.setActive({ organizationId })),
    // The dashboard project list is scoped to the active org server-side, so it
    // must refetch when the active org changes (and any org-scoped data resets).
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const data = unwrap(
        await authClient.organization.acceptInvitation({ invitationId }),
      );
      // Joining a workspace should land you IN it: make it the active org,
      // otherwise the dashboard keeps showing the user's own (empty) org.
      const organizationId =
        data?.invitation?.organizationId ?? data?.member?.organizationId;
      if (organizationId) {
        await authClient.organization.setActive({ organizationId });
      }
      return data;
    },
    // Active org changed, so org-scoped data (projects list) is stale too.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

/** Pending invitations addressed to the signed-in user's email. */
export function usePendingUserInvitations() {
  return useQuery({
    queryKey: [...organizationKeys.all, "user-invitations"] as const,
    queryFn: async () => {
      const invitations = unwrap(
        await authClient.organization.listUserInvitations(),
      );
      return (invitations ?? []).filter((i) => i.status === "pending");
    },
  });
}

export function useRejectInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) =>
      unwrap(
        await authClient.organization.rejectInvitation({ invitationId }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationKeys.userInvitations(),
      });
    },
  });
}
