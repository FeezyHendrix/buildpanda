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
  useUpdateRole,
} from "@/hooks/use-organization";
import { toast } from "@/lib/toast";

import { MembersSection } from "./team/members-section";
import { InvitationsSection } from "./team/invitations-section";
import { RolesSection } from "./team/roles-section";
import { formatRoleLabel } from "./team/utils";
import type { Member, CustomRole } from "./team/types";
import { Link, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";

const TABS = [
  { id: "members", label: "Members" },
  { id: "invitations", label: "Invitations" },
  { id: "roles", label: "Roles & Permissions" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function TeamSettings() {
  const [searchParams] = useSearchParams();
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
  const activeTabId = (searchParams.get("tab") as TabId) || "members";

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
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="My Team"
        description="Manage people, invitations and roles in your workspace"
        actions={
          canManage && (
            <Button size='lg' onClick={() => setInviteOpen(true)}>
              <ReactSVG src={icons2.addUser} />
              Invite member
            </Button>
          )
        }
      />

      <div className="border-gray-200 my-6">
        <nav className="-mb-px flex space-x-2" aria-label="Tabs">
          {TABS.map((tab) => {
            const isActive = activeTabId === tab.id;
            return (
              <Link
                key={tab.id}
                to={`?tab=${tab.id}`}
                className={cn(
                  "whitespace-nowrap px-4 py-2 !text-caption-l font-semibold border-[0.5px] rounded-full",
                  isActive
                    ? "border-none bg-black-500 text-white"
                    : "border-border border text-black-500 hover:border-gray-300 hover:text-gray-700",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mx-auto mt-8 w-full">
        {activeTabId === 'members' && (
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
        )}
        {activeTabId === 'invitations' && (
          <>
            {(canManage || pendingInvitations.length > 0) && (
              <InvitationsSection
                invitations={pendingInvitations}
                isLoading={invitationsQuery.isPending}
                canManage={canManage}
                isCancelling={cancelInvitation.isPending}
                onCancel={(id, options) => cancelInvitation.mutate(id, options)}
              />
            )}
          </>
        )}
        {activeTabId === 'roles' && (
          <RolesSection
            roles={customRoles}
            canManage={canManage}
            isDeleting={deleteRole.isPending}
            onCreate={() => setRoleBuilderOpen(true)}
            onEdit={handleEditRole}
            onDelete={setRoleToDelete}
          />
        )}
      </div>

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
          (roleToEdit
            ? updateRole.error?.message
            : createRole.error?.message) ?? null
        }
        onSubmit={handleSubmitRole}
      />

      <ConfirmDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        title="Remove Team Member"
        description={
          memberToRemove
            ? `Are you sure you want to remove ${memberToRemove.user.name}? They will lose access to your workspace and its projects. This action can be reversed later by sending a new invitation.`
            : ""
        }
        confirmLabel="Remove member"
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
