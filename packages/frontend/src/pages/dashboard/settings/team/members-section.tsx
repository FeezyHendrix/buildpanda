import { useState, useMemo } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { Button } from "@/components/atoms/button";
import { Select } from "@/components/atoms/select";
import { formatRoleLabel, roleTone } from "./utils";
import { RowMessage } from "./section";
import type { Member } from "./types";
import { Search, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { TextInput } from "@/components/atoms/text-input";

// ─── Role Select ──────────────────────────────────────────────────────────────

interface RoleSelectProps {
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (role: string) => void;
}

export function RoleSelect({ value, options, disabled, onChange }: RoleSelectProps) {
  return (
    <div className="w-[80px] shrink-0">
      <Select
        value={value}
        options={options.map((r) => ({
          value: r,
          label: formatRoleLabel(r),
        }))}
        onChange={(v) => v && onChange(v)}
        disabled={disabled}
        className="h-9 w-full px-3 text-caption-l !gap-1"
      />
    </div>
  );
}

// ─── Member Row ───────────────────────────────────────────────────────────────

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
  const canEditRole = canManage && !isOwner && !isSelf;
  const canRemove = canManage && !isOwner && !isSelf;

  return (
    <div className="flex items-center gap-4 px-6 py-3.5 border-b border-[#F0F0F0] last:border-b-0">
      <Avatar name={member.user.name} src={member.user.image} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-caption-l font-semibold text-black-500">
          {member.user.name}
          {isSelf && <span className="ml-2 text-caption-s font-normal text-grey-450">You</span>}
        </p>
        <p className="truncate text-caption-m text-grey-450">{member.user.email}</p>
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
          variant="danger-outline"
          size="md"
          onClick={() => onRemove(member)}
        >
          Remove
        </Button>
      )}
    </div>
  );
}

// ─── Members Section ──────────────────────────────────────────────────────────

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
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const uniqueRoles = useMemo(
    () => ["all", ...Array.from(new Set(members.map((m) => m.role)))],
    [members],
  );

  const filtered = useMemo(() => {
    let result = members;
    if (roleFilter !== "all") result = result.filter((m) => m.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.user.name.toLowerCase().includes(q) ||
          m.user.email.toLowerCase().includes(q),
      );
    }
    return result;
  }, [members, roleFilter, search]);

  return (
    <div className="overflow-hidden rounded-none border border-[#F0F0F0]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b-[0.5px] border-border px-6 py-3">
        {/* Member count */}
        <div className="flex items-center gap-1 bg-grey-50 px-3 py-1.5 h-[36px]">
          <ReactSVG src={icons2.person} className='[&_svg]:size-[16px]' />
          <span className="text-caption-l font-semibold text-black-500">{members.length}</span>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-[311px] h-[36px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-5 text-black-500" />
          <TextInput
            type="text"
            placeholder="Search team members"
            value={search}
            onChange={setSearch}
            className='h-[36px] indent-8'
          />
        </div>

        {/* Role filter */}
        <div className='flex items-center gap-3 h-11'>
          <div className="h-full w-[80px] shrink-0">
            <Select
              value={roleFilter}
              options={uniqueRoles.map((r) => ({
                value: r,
                label: r === "all" ? "Roles" : formatRoleLabel(r),
              }))}
              onChange={(v) => setRoleFilter(v ?? "all")}
              className="h-full w-full px-3 text-caption-l !gap-1"
            />
          </div>

          {/* Sort button */}
          <Button
            type="button"
            variant='outline'
            className='h-full'
          >
            Newest
            <ArrowUpDown className="size-3.5 text-grey-450" />
          </Button>
        </div>
      </div>

      {/* Rows */}
      {isLoading && <RowMessage>Loading members…</RowMessage>}
      {!isLoading && filtered.length === 0 && (
        <RowMessage>{search || roleFilter !== "all" ? "No members match your filters." : "No members yet."}</RowMessage>
      )}
      {!isLoading &&
        filtered.map((member) => (
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
    </div>
  );
}
