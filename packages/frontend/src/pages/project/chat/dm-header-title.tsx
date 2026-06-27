import { useChannelMembers } from "@/hooks/use-chat";
import type { Channel } from "@/lib/project-types";

export function DmHeaderTitle({
  channel,
  currentUserId,
}: {
  channel: Channel;
  currentUserId: string;
}) {
  const { data: members = [] } = useChannelMembers(channel.id);
  const otherMember = members.find((m) => m.id !== currentUserId);
  return <>{otherMember?.name || channel.name || "Direct message"}</>;
}
