import { useChannelMembers } from "@/hooks/use-chat";
import { Avatar } from "@/components/atoms/avatar";
import { cn } from "@/lib/utils";
import type { Channel } from "@/lib/project-types";

export function DmChannelRow({
  channel,
  currentUserId,
  isActive,
  onClick,
}: {
  channel: Channel;
  currentUserId: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const { data: members = [] } = useChannelMembers(channel.id);
  const otherMember = members.find(m => m.id !== currentUserId);
  const displayName = otherMember?.name || channel.name || "Unknown User";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
        isActive
          ? "bg-primary-50 text-primary-500"
          : "text-gray-700 hover:bg-gray-100",
        channel.muted && !isActive && "text-gray-400"
      )}
    >
      <div className="shrink-0 relative">
        <Avatar name={displayName} size="sm" />
      </div>
      <span className="flex-1 truncate">{displayName}</span>
      {channel.unreadCount > 0 && (
        <span className="flex h-5 items-center justify-center rounded-full bg-primary-500 px-2 text-[10px] font-semibold text-white">
          {channel.unreadCount}
        </span>
      )}
    </button>
  );
}
