import type { Channel } from "@/lib/project-types";
import { cn } from "@/lib/utils";

export function ChannelRow({
  channel,
  isActive,
  onClick,
}: {
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
}) {
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
      <span className="text-gray-400">#</span>
      <span className="flex-1 truncate">{channel.name || "general"}</span>
      {channel.unreadCount > 0 && (
        <span className="flex h-5 items-center justify-center rounded-full bg-primary-500 px-2 text-[10px] font-semibold text-white">
          {channel.unreadCount}
        </span>
      )}
    </button>
  );
}
