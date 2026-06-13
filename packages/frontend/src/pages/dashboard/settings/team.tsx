import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Avatar } from "@/components/atoms/avatar";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { PageHeader } from "@/components/molecules/page-header";
import { EmptyState } from "@/components/molecules/empty-state";
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

type Member = NonNullable<
  ReturnType<typeof useMembers>["data"]
>["members"][number];
type Invitation = NonNullable<ReturnType<typeof useInvitations>["data"]>[number];
type CustomRole = NonNullable<ReturnType<typeof useRoles>["data"]>[number];

const ROLE_TONES: Record<string, BadgeTone> = {
  owner: "accent",
  admin: "info",
  member: "neutral",
  viewer: "neutral",
};

function roleTone(role: string): BadgeTone {
  return ROLE_TONES[role] ?? "success";
}

function formatRoleLabel(role: string): string {
  return role
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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

  function handleChangeRole(memberId: string, role: string): void {
    updateMemberRole.mutate({ memberId, role });
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-10">
      {!canManage && currentRole && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
          <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm0 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM8 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 5Zm0 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75Z" />
          </svg>
          You are viewing team settings as a {currentRole} — only owners and admins can make changes.
        </div>
      )}
      <PageHeader
        title="Team & Roles"
        description="Invite teammates to your company, assign what each person can do, and build custom roles for your crew."
        actions={
          canManage && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              Invite member
            </Button>
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
        onChangeRole={handleChangeRole}
        onRemove={setMemberToRemove}
      />

      {canManage && (
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

interface MembersSectionProps {
  members: Member[];
  isLoading: boolean;
  currentUserId?: string;
  canManage: boolean;
  assignableRoles: string[];
  isUpdatingRole: boolean;
  onChangeRole: (memberId: string, role: string) => void;
  onRemove: (member: Member) => void;
}

function MembersSection({
  members,
  isLoading,
  currentUserId,
  canManage,
  assignableRoles,
  isUpdatingRole,
  onChangeRole,
  onRemove,
}: MembersSectionProps) {
  return (
    <Section title="Members">
      {isLoading && <RowMessage>Loading members…</RowMessage>}
      {!isLoading && members.length === 0 && (
        <RowMessage>No members yet.</RowMessage>
      )}
      {!isLoading &&
        members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            isSelf={member.userId === currentUserId}
            canManage={canManage}
            assignableRoles={assignableRoles}
            isUpdatingRole={isUpdatingRole}
            onChangeRole={onChangeRole}
            onRemove={onRemove}
          />
        ))}
    </Section>
  );
}

interface MemberRowProps {
  member: Member;
  isSelf: boolean;
  canManage: boolean;
  assignableRoles: string[];
  isUpdatingRole: boolean;
  onChangeRole: (memberId: string, role: string) => void;
  onRemove: (member: Member) => void;
}

function MemberRow({
  member,
  isSelf,
  canManage,
  assignableRoles,
  isUpdatingRole,
  onChangeRole,
  onRemove,
}: MemberRowProps) {
  const isOwner = member.role === "owner";
  const canEditRole = canManage && !isOwner;
  const canRemove = canManage && !isOwner && !isSelf;

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <Avatar name={member.user.name} src={member.user.image} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {member.user.name}
          {isSelf && <span className="ml-2 text-xs text-gray-400">You</span>}
        </p>
        <p className="truncate text-xs text-gray-500">{member.user.email}</p>
      </div>

      {canEditRole ? (
        <RoleSelect
          value={member.role}
          options={assignableRoles}
          disabled={isUpdatingRole}
          onChange={(role) => onChangeRole(member.id, role)}
        />
      ) : (
        <Badge tone={roleTone(member.role)} variant="soft">
          {formatRoleLabel(member.role)}
        </Badge>
      )}

      {canRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(member)}
          className="text-red-600 hover:bg-red-50"
        >
          Remove
        </Button>
      )}
    </div>
  );
}

interface InvitationsSectionProps {
  invitations: Invitation[];
  isCancelling: boolean;
  onCancel: (invitationId: string) => void;
}

function InvitationsSection({
  invitations,
  isCancelling,
  onCancel,
}: InvitationsSectionProps) {
  return (
    <Section title="Pending invitations">
      {invitations.length === 0 && (
        <RowMessage>No pending invitations.</RowMessage>
      )}
      {invitations.map((invitation) => (
        <div key={invitation.id} className="flex items-center gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {invitation.email}
            </p>
            <p className="text-xs text-gray-500">
              Invited as {formatRoleLabel(invitation.role ?? "member")}
            </p>
          </div>
          <Badge tone="warning" variant="soft">
            Pending
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(invitation.id)}
            disabled={isCancelling}
            className="text-red-600 hover:bg-red-50"
          >
            Cancel
          </Button>
        </div>
      ))}
    </Section>
  );
}

interface RolesSectionProps {
  roles: CustomRole[];
  canManage: boolean;
  isDeleting: boolean;
  onCreate: () => void;
  onDelete: (role: CustomRole) => void;
}

function RolesSection({
  roles,
  canManage,
  isDeleting,
  onCreate,
  onDelete,
}: RolesSectionProps) {
  const action = canManage ? (
    <Button variant="secondary" size="sm" onClick={onCreate}>
      Create role
    </Button>
  ) : null;

  if (roles.length === 0) {
    return (
      <Section title="Custom roles" action={action}>
        <div className="px-5 py-8">
          <EmptyState
            title="No custom roles yet"
            description="Create a role to grant a specific set of actions, like a site supervisor who can manage the schedule but not finances."
          />
        </div>
      </Section>
    );
  }

  return (
    <Section title="Custom roles" action={action}>
      {roles.map((role) => (
        <RoleRow
          key={role.id}
          role={role}
          canManage={canManage}
          isDeleting={isDeleting}
          onDelete={onDelete}
        />
      ))}
    </Section>
  );
}

interface RoleRowProps {
  role: CustomRole;
  canManage: boolean;
  isDeleting: boolean;
  onDelete: (role: CustomRole) => void;
}

function RoleRow({ role, canManage, isDeleting, onDelete }: RoleRowProps) {
  const resourceCount = Object.keys(role.permission ?? {}).length;
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {formatRoleLabel(role.role)}
        </p>
        <p className="text-xs text-gray-500">
          {resourceCount} resource{resourceCount === 1 ? "" : "s"} configured
        </p>
      </div>
      {canManage && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(role)}
          disabled={isDeleting}
          className="text-red-600 hover:bg-red-50"
        >
          Delete
        </Button>
      )}
    </div>
  );
}

interface RoleSelectProps {
  value: string;
  options: string[];
  disabled: boolean;
  onChange: (role: string) => void;
}

function RoleSelect({ value, options, disabled, onChange }: RoleSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 rounded-lg bg-[#F6F6F6] px-2.5 text-xs font-medium text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
    >
      {options.map((role) => (
        <option key={role} value={role}>
          {formatRoleLabel(role)}
        </option>
      ))}
    </select>
  );
}

interface SectionProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, action, children }: SectionProps) {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      <div className="mt-4 divide-y divide-[#F6F6F6] overflow-hidden rounded-2xl border border-[#F0F0F0]">
        {children}
      </div>
    </section>
  );
}

function RowMessage({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-6 text-sm text-gray-400">{children}</p>;
}
