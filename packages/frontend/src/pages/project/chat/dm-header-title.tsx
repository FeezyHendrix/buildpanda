import { Avatar } from "@/components/atoms/avatar";
import { useChannelMembers } from "@/hooks/use-chat";
import type { Channel } from "@/lib/project-types";

/**
 * Who a direct message is with: their avatar, their name and, beneath it, their
 * profession (architect, site engineer…) when they have set one on their profile.
 */
export function DmHeaderTitle({ channel, currentUserId }: { channel: Channel; currentUserId: string }) {
  const { data: members = [] } = useChannelMembers(channel.id);
  const other = members.find((m) => m.id !== currentUserId);
  const name = other?.name || channel.name || "Direct message";
  const profession = other?.profession?.trim() || null;

  return (
    <div className="flex min-w-0 items-center gap-[10px]">
      <Avatar name={name} className="size-[30px] bg-primary text-[10px] text-white" />
      <div className="min-w-0">
        <h3 className="truncate text-[14px] font-medium leading-[18px] text-[#1E1E1E]">{name}</h3>
        {profession ? <p className="truncate text-[12px] leading-[14px] text-[#737373]">{profession}</p> : null}
      </div>
    </div>
  );
}
