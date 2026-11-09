import { useChannelMembers } from "@/hooks/use-chat";
import { Avatar } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";
import type { Channel } from "@/lib/project-types";
import { CHANNEL_ROW_CLASS, channelRowTone, UnreadBadge } from "./channel-row";

export function DmChannelRow({
  channel,
  currentUserId,
  isActive,
  filter = "",
  onClick,
}: {
  channel: Channel;
  currentUserId: string;
  isActive: boolean;
  /** Lower-cased text the channel list is being filtered by; rows that don't match hide. */
  filter?: string;
  onClick: () => void;
}) {
  const { data: members = [] } = useChannelMembers(channel.id);
  const otherMember = members.find((m) => m.id !== currentUserId);
  const displayName = otherMember?.name || channel.name || "Unknown User";

  if (filter && !displayName.toLowerCase().includes(filter)) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "true" : undefined}
      className={cn(CHANNEL_ROW_CLASS, "gap-[8px] px-[12px]", channelRowTone(isActive, Boolean(channel.muted)))}
    >
      <Avatar name={displayName} className="size-[26px] bg-primary text-[9px] text-white" />
      <span className="flex-1 truncate">{displayName}</span>
      <UnreadBadge count={channel.unreadCount} />
    </button>
  );
}
