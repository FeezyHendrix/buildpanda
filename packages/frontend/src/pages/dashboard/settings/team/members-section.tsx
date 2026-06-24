import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { formatRoleLabel, roleTone } from "./utils";
import { Section, RowMessage } from "./section";
import type { Member } from "./types";

interface RoleSelectProps {
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (role: string) => void;
}

export function RoleSelect({ value, options, disabled, onChange }: RoleSelectProps) {
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

interface MemberRowProps {
  member: Member;
  isSelf: boolean;
  canManage: boolean;
  assignableRoles: string[];
  isUpdatingRole: boolean;
  onChangeRole: (memberId: string, role: string) => void;
  onRemove: (member: Member) => void;
}

export function MemberRow({
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

export function MembersSection({
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
