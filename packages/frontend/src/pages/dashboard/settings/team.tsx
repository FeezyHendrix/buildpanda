import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PageHeader } from "@/components/molecules/page-header";
import { InviteMemberDialog } from "@/components/molecules/invite-member-dialog";
import { RoleBuilderDialog } from "@/components/molecules/role-builder-dialog";
import { authClient } from "@/lib/auth-client";
import { STATIC_ROLE_NAMES } from "@/lib/permissions";
import {
  useActiveOrganizationId,
  useCancelInvitation,
  useCreateRole,
  useDeleteRole,
  useInvitations,
  useInviteMember,
  useMembers,
  useRemoveMember,
  useRoles,
  useUpdateMemberRole,
} from "@/hooks/use-organization";

import { MembersSection } from "./team/members-section";
import { InvitationsSection } from "./team/invitations-section";
import { RolesSection } from "./team/roles-section";
import { formatRoleLabel } from "./team/utils";
import type { Member, CustomRole } from "./team/types";

export default function TeamSettings() {
  const { data: session } = authClient.useSession();
  const organizationId = useActiveOrganizationId();
  const currentUserId = session?.user.id;

  const membersQuery = useMembers(organizationId);
  const invitationsQuery = useInvitations(organizationId);
  const rolesQuery = useRoles(organizationId);

  const inviteMember = useInviteMember(organizationId ?? "");
  const cancelInvitation = useCancelInvitation(organizationId ?? "");
  const updateMemberRole = useUpdateMemberRole(organizationId ?? "");
  const removeMember = useRemoveMember(organizationId ?? "");
  const createRole = useCreateRole(organizationId ?? "");
  const deleteRole = useDeleteRole(organizationId ?? "");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleBuilderOpen, setRoleBuilderOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<CustomRole | null>(null);

  const members = membersQuery.data?.members ?? [];
  const customRoles = rolesQuery.data ?? [];
  const pendingInvitations = (invitationsQuery.data ?? []).filter(
    (invitation) => invitation.status === "pending",
  );

  const customRoleNames = useMemo(
    () => customRoles.map((role) => role.role),
    [customRoles],
  );

  const assignableRoles = useMemo(
    () => [
      ...STATIC_ROLE_NAMES.filter((name) => name !== "owner"),
      ...customRoleNames,
    ],
    [customRoleNames],
  );

  const currentRole = useMemo(
    () => members.find((member) => member.userId === currentUserId)?.role ?? "",
    [members, currentUserId],
  );
  const canManage = currentRole === "owner" || currentRole === "admin";

  function handleInvite(input: { email: string; role: string }): void {
    inviteMember.mutate(input, { onSuccess: () => setInviteOpen(false) });
  }

  function handleCreateRole(input: {
    role: string;
    permission: Record<string, string[]>;
  }): void {
    createRole.mutate(input, { onSuccess: () => setRoleBuilderOpen(false) });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Team settings"
        description="Manage members, invitations, and custom roles."
        actions={
          canManage && (
            <Button onClick={() => setInviteOpen(true)}>Invite member</Button>
          )
        }
      />

      <MembersSection
        members={members}
        isLoading={membersQuery.isPending}
        currentUserId={currentUserId}
        canManage={canManage}
        assignableRoles={assignableRoles}
        isUpdatingRole={updateMemberRole.isPending}
        onChangeRole={(memberId, role) =>
          updateMemberRole.mutate({ memberId, role })
        }
        onRemove={setMemberToRemove}
      />

      {(canManage || pendingInvitations.length > 0) && (
        <InvitationsSection
          invitations={pendingInvitations}
          isCancelling={cancelInvitation.isPending}
          onCancel={(id) => cancelInvitation.mutate(id)}
        />
      )}

      <RolesSection
        roles={customRoles}
        canManage={canManage}
        isDeleting={deleteRole.isPending}
        onCreate={() => setRoleBuilderOpen(true)}
        onDelete={setRoleToDelete}
      />

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        roleOptions={assignableRoles.map((role) => ({
          value: role,
          label: formatRoleLabel(role),
        }))}
        isSubmitting={inviteMember.isPending}
        error={inviteMember.error?.message ?? null}
        onSubmit={handleInvite}
      />

      <RoleBuilderDialog
        open={roleBuilderOpen}
        onOpenChange={setRoleBuilderOpen}
        existingRoleNames={[...STATIC_ROLE_NAMES, ...customRoleNames]}
        isSubmitting={createRole.isPending}
        error={createRole.error?.message ?? null}
        onSubmit={handleCreateRole}
      />

      <ConfirmDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        title="Remove member"
        description={
          memberToRemove
            ? `Remove ${memberToRemove.user.name} from this company? They will lose access immediately.`
            : ""
        }
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => {
          if (memberToRemove) removeMember.mutate(memberToRemove.id);
        }}
      />

      <ConfirmDialog
        open={roleToDelete !== null}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
        title="Delete role"
        description={
          roleToDelete
            ? `Delete the "${formatRoleLabel(roleToDelete.role)}" role? Members with only this role will need a new one.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (roleToDelete) deleteRole.mutate(roleToDelete.role);
        }}
      />
    </div>
  );
}
