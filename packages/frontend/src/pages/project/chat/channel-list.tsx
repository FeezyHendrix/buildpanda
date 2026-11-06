import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Channel } from "@/lib/project-types";
import { ChannelRow } from "./channel-row";
import { DmChannelRow } from "./dm-channel-row";

interface ChannelListProps {
  groups: Channel[];
  directMessages: Channel[];
  currentUserId: string;
  activeChannelId: string | null;
  canCreateGroup: boolean;
  onSelect: (channelId: string) => void;
  onNewGroup: () => void;
  onNewDm: () => void;
  className?: string;
}

function SectionLabel({
  label,
  addLabel,
  hidden = false,
  onAdd,
}: {
  label: string;
  addLabel: string;
  hidden?: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex h-[24px] items-center justify-between px-[15px] text-[12px] text-[#737373]">
      <span>{label}</span>
      {hidden ? null : (
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel}
          className="-mr-[5px] flex size-[24px] items-center justify-center text-[#737373] outline-none hover:text-[#1E1E1E] focus-visible:ring-2 focus-visible:ring-gray-900/10"
        >
          <Plus className="size-[16px]" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

/** The channels panel: groups, direct messages, and a quick filter behind the search icon. */
export function ChannelList({
  groups,
  directMessages,
  currentUserId,
  activeChannelId,
  canCreateGroup,
  onSelect,
  onNewGroup,
  onNewDm,
  className,
}: ChannelListProps) {
  const [filtering, setFiltering] = useState(false);
  const [query, setQuery] = useState("");
  const filter = filtering ? query.trim().toLowerCase() : "";
  const visibleGroups = filter ? groups.filter((c) => (c.name || "general").toLowerCase().includes(filter)) : groups;

  function toggleFilter(): void {
    setFiltering((open) => !open);
    setQuery("");
  }

  return (
    <div className={cn("flex shrink-0 flex-col border-r border-[#EEEEEE] bg-white lg:w-[244px]", className)}>
      <div className="flex h-[46px] shrink-0 items-center justify-between border-b border-[#EEEEEE] px-[16px]">
        <h2 className="text-[16px] font-medium text-[#1E1E1E]">Channels</h2>
        <button
          type="button"
          onClick={toggleFilter}
          aria-label={filtering ? "Close channel filter" : "Filter channels"}
          aria-pressed={filtering}
          className="-mr-[2px] flex size-[24px] items-center justify-center text-[#1E1E1E] outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        >
          <Search className="size-[18px]" strokeWidth={1.5} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-[16px]">
        {filtering ? (
          <div className="px-[7px] pt-[8px]">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter channels"
              aria-label="Filter channels"
              className="h-[32px] w-full border border-[#EEEEEE] px-[12px] text-[12px] text-[#1E1E1E] outline-none placeholder:text-[#A5A5A5] focus:border-primary"
            />
          </div>
        ) : null}

        <div className="pt-[14px]">
          <SectionLabel label="Groups" addLabel="New group" hidden={!canCreateGroup} onAdd={onNewGroup} />
          <div className="mt-[2px] flex flex-col gap-[4px] px-[7px]">
            {visibleGroups.map((c) => (
              <ChannelRow
                key={c.id}
                channel={{ ...c, name: c.name || "general" }}
                isActive={c.id === activeChannelId}
                onClick={() => onSelect(c.id)}
              />
            ))}
          </div>
        </div>

        <div className="mt-[29px]">
          <SectionLabel label="Direct Messages" addLabel="Add direct message" onAdd={onNewDm} />
          <div className="mt-[4px] flex flex-col gap-[4px] px-[7px]">
            {directMessages.map((c) => (
              <DmChannelRow
                key={c.id}
                channel={c}
                currentUserId={currentUserId}
                isActive={c.id === activeChannelId}
                filter={filter}
                onClick={() => onSelect(c.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

ChannelList.displayName = "ChannelList";
