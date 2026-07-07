import { useState, useMemo } from "react";
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
  useUpdateRole,
} from "@/hooks/use-organization";
import { toast } from "@/lib/toast";

import { Button } from "@/components/atoms/button";
import { MembersSection } from "../team/members-section";
import { InvitationsSection } from "../team/invitations-section";
import { RolesSection } from "../team/roles-section";
import { formatRoleLabel } from "../team/utils";
import type { Member, CustomRole } from "../team/types";
import { InviteMemberDialog } from "@/components/molecules/invite-member-dialog";
import { RoleBuilderDialog } from "@/components/molecules/role-builder-dialog";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";

export function MembersTab() {
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
  const updateRole = useUpdateRole(organizationId ?? "");
  const deleteRole = useDeleteRole(organizationId ?? "");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleBuilderOpen, setRoleBuilderOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<CustomRole | null>(null);
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
    () => [...STATIC_ROLE_NAMES, ...customRoleNames],
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

  function handleSubmitRole(input: {
    role: string;
    permission: Record<string, string[]>;
  }): void {
    if (roleToEdit) {
      updateRole.mutate(
        { roleName: roleToEdit.role, permission: input.permission },
        {
          onSuccess: () => {
            setRoleBuilderOpen(false);
            setRoleToEdit(null);
            toast("Role access updated", "success");
          },
        },
      );
      return;
    }
    createRole.mutate(input, { onSuccess: () => setRoleBuilderOpen(false) });
  }

  function handleEditRole(role: CustomRole): void {
    setRoleToEdit(role);
    setRoleBuilderOpen(true);
  }

  return (
    <div className="flex flex-col gap-8">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setInviteOpen(true)}>Invite member</Button>
        </div>
      )}

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
        onEdit={handleEditRole}
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
        onOpenChange={(open) => {
          setRoleBuilderOpen(open);
          if (!open) setRoleToEdit(null);
        }}
        existingRoleNames={[...STATIC_ROLE_NAMES, ...customRoleNames]}
        initial={
          roleToEdit
            ? { role: roleToEdit.role, permission: roleToEdit.permission ?? {} }
            : null
        }
        isSubmitting={roleToEdit ? updateRole.isPending : createRole.isPending}
        error={
          (roleToEdit ? updateRole.error?.message : createRole.error?.message) ??
          null
        }
        onSubmit={handleSubmitRole}
      />

      <ConfirmDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        title="Remove member"
        description={
          memberToRemove
            ? `Remove ${memberToRemove.user.name} from this workspace? They will lose access immediately.`
            : ""
        }
        confirmLabel="Remove member"
        variant="danger"
        loading={removeMember.isPending}
        onConfirm={() => {
          if (memberToRemove) {
            removeMember.mutate(memberToRemove.id, {
              onSuccess: () => setMemberToRemove(null),
            });
          }
        }}
      />

      <ConfirmDialog
        open={roleToDelete !== null}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
        title="Delete custom role"
        description={
          roleToDelete
            ? `Delete the role "${roleToDelete.role}"? Members with this role will lose their custom permissions.`
            : ""
        }
        confirmLabel="Delete role"
        variant="danger"
        loading={deleteRole.isPending}
        onConfirm={() => {
          if (roleToDelete) {
            deleteRole.mutate(roleToDelete.role, {
              onSuccess: () => setRoleToDelete(null),
            });
          }
        }}
      />
    </div>
  );
}
