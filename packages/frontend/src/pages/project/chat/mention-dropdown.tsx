import type { ChannelMemberLite } from "@/lib/project-types";
import { Avatar } from "@/components/atoms/avatar";

export type MentionOption =
  | { kind: "user"; member: ChannelMemberLite }
  | { kind: "here"; label: string; helper: string }
  | { kind: "channel"; label: string; helper: string };

type GroupMentionOption = Extract<MentionOption, { kind: "here" | "channel" }>;

export function MentionDropdown({
  members,
  query,
  onSelect,
}: {
  members: ChannelMemberLite[];
  query: string;
  onSelect: (option: MentionOption) => void;
}) {
  const lowered = query.toLowerCase();
  const groupOptions: GroupMentionOption[] = [
    { kind: "here", label: "project-team", helper: "Notify everyone on this project" },
    { kind: "channel", label: "company", helper: "Notify everyone in the company" },
  ];
  const filteredGroups = groupOptions.filter((m) => m.label.includes(lowered));
  const filteredMembers = members
    .filter((m) => (m.name || "").toLowerCase().includes(lowered))
    .map<MentionOption>((member) => ({ kind: "user", member }));
  const filtered = [...filteredGroups, ...filteredMembers];

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 max-h-48 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
      {filtered.map((m) => (
        <button
          key={m.kind === "user" ? m.member.id : m.kind}
          type="button"
          onClick={() => onSelect(m)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100"
        >
          {m.kind === "user" ? (
            <>
              <Avatar name={m.member.name ?? "?"} size="sm" />
              <span className="truncate font-medium text-gray-900">{m.member.name}</span>
            </>
          ) : (
            <>
              <span className="flex size-8 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-500">@</span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-gray-900">{m.label}</span>
                <span className="block truncate text-xs text-gray-500">{m.helper}</span>
              </span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
