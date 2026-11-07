import { useState } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { TextInput } from "@/components/atoms/text-input";
import { ModalShell } from "@/components/molecules/modal-shell";
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
  const filtered = members.filter(
    (m) => m.id !== currentUserId && (m.name || "").toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <ModalShell
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="New Direct Message"
    >
      <TextInput
        autoFocus
        value={query}
        onChange={setQuery}
        placeholder="Search Members"
        aria-label="Search members"
        className="h-[46px] shrink-0 border border-[#EEEEEE] px-4 text-[14px] placeholder:text-[#A5A5A5]"
      />
      <div className="mt-[24px] max-h-[399px] overflow-y-auto">
        {filtered.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className="flex h-[57px] w-full items-center gap-[8px] px-[8px] text-left outline-none transition-colors hover:bg-[#F5F5F5] focus-visible:bg-[#F5F5F5]"
          >
            <Avatar name={m.name ?? "?"} className="size-[36px] bg-primary text-[12px] text-white" />
            <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
              <span className="truncate text-[14px] font-medium leading-[20px] text-[#1E1E1E]">{m.name}</span>
              <span className="truncate text-[12px] leading-[16px] text-[#737373]">{m.email}</span>
            </span>
          </button>
        ))}
        {filtered.length === 0 && <div className="py-4 text-center text-sm text-ink-muted">No members found</div>}
      </div>
    </ModalShell>
  );
}
