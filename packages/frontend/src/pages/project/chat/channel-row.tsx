import { Hash } from "lucide-react";
import type { Channel } from "@/lib/project-types";
import { cn } from "@/lib/utils";

/** One row of the channel list; `UnreadBadge` is shared with the direct-message rows. */
export const CHANNEL_ROW_CLASS =
  "flex h-[32px] w-full items-center text-left text-[12px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900/10";

export function channelRowTone(isActive: boolean, muted: boolean): string {
  if (isActive) return "bg-[#E6EDFD] text-primary";
  return cn("hover:bg-[#F5F5F5]", muted ? "text-[#737373]" : "text-[#262626]");
}

export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex h-5 items-center justify-center rounded-full bg-primary-500 px-2 text-[10px] font-semibold text-white">
      {count}
    </span>
  );
}

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
      aria-current={isActive ? "true" : undefined}
      className={cn(CHANNEL_ROW_CLASS, "gap-[4px] px-[12px]", channelRowTone(isActive, Boolean(channel.muted)))}
    >
      <Hash className={cn("size-[16px] shrink-0", isActive ? "text-primary" : "text-[#737373]")} strokeWidth={1.5} />
      <span className="flex-1 truncate">{channel.name || "general"}</span>
      <UnreadBadge count={channel.unreadCount} />
    </button>
  );
}
