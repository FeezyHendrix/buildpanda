import { useState } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg border border-line-hair bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-line-hair px-4 py-3">
          <h3 className="font-semibold text-ink">New Direct Message</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-ink-muted hover:bg-black/5 hover:text-ink" aria-label="Close">✕</button>
        </div>
        <div className="p-4">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members..."
            className={cn(INPUT_CLASS, "mb-4")}
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map(m => (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-surface-alt"
              >
                <Avatar name={m.name ?? "?"} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-ink">{m.name}</div>
                  <div className="truncate text-xs text-ink-muted">{m.email}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-4 text-center text-sm text-ink-muted">No members found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
