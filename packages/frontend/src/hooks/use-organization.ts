import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { organizationKeys } from "./query-keys";

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

export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.list(),
    queryFn: async () => unwrap(await authClient.organization.list()),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) =>
      unwrap(
        await authClient.organization.acceptInvitation({ invitationId }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
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
