import { useState } from "react";
import { Avatar } from "@/components/atoms/avatar";
import type { ChannelMemberLite } from "@/lib/project-types";

export function NewDmModal({
  members,
  currentUserId,
  onClose,
  onSelect,
}: {
  members: ChannelMemberLite[];
  currentUserId: string;
  onClose: () => void;
  onSelect: (userId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = members.filter(m => 
    m.id !== currentUserId && 
    (m.name || "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="font-semibold text-gray-900">New Direct Message</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-4">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members..."
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 mb-4"
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map(m => (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-gray-50"
              >
                <Avatar name={m.name ?? "?"} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-gray-900">{m.name}</div>
                  <div className="truncate text-xs text-gray-500">{m.email}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-4 text-center text-sm text-gray-500">No members found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
