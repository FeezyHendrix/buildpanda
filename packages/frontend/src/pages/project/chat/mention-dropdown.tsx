import type { ChannelMemberLite } from "@/lib/project-types";
import { Avatar } from "@/components/atoms/avatar";

export function MentionDropdown({
  members,
  query,
  onSelect,
}: {
  members: ChannelMemberLite[];
  query: string;
  onSelect: (m: ChannelMemberLite) => void;
}) {
  const filtered = members.filter((m) =>
    (m.name || "").toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 max-h-48 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
      {filtered.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelect(m)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100"
        >
          <Avatar name={m.name ?? "?"} size="sm" />
          <span className="truncate font-medium text-gray-900">{m.name}</span>
        </button>
      ))}
    </div>
  );
}

