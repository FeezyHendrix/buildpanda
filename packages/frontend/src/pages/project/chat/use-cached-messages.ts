import { useEffect, useState } from "react";
import { cacheMessages, readCachedMessages } from "@/lib/chat-cache";
import type { ChatMessage } from "@/lib/project-types";

const EMPTY_MESSAGES: ChatMessage[] = [];

export function useCachedMessages(channelId: string | null, messages: ChatMessage[], hasServerData: boolean) {
  const [cache, setCache] = useState<{ channelId: string; messages: ChatMessage[] }>();
  useEffect(() => {
    if (!channelId) return;
    let active = true;
    void readCachedMessages(channelId).then(rows => {
      if (active) setCache({ channelId, messages: rows });
    });
    return () => { active = false; };
  }, [channelId]);
  useEffect(() => {
    if (channelId && hasServerData) void cacheMessages(channelId, messages);
  }, [channelId, messages, hasServerData]);
  if (hasServerData) return messages;
  return cache?.channelId === channelId ? cache.messages : EMPTY_MESSAGES;
}
