import { useState } from "react";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { BellIcon, BellOffIcon, StarIcon } from "@/components/atoms/chat-icons";
import type { Channel, ChatMessage } from "@/lib/project-types";
import { DmHeaderTitle } from "./dm-header-title";
import { MessageSearch } from "./message-search";

interface ChannelHeaderProps {
  channel: Channel;
  currentUserId: string;
  pins: ChatMessage[];
  onBack: () => void;
  onSearchSelect: (channelId: string) => void;
  onToggleMute: () => void;
  onUnpin: (message: ChatMessage) => void;
  onReplyToPin: (message: ChatMessage) => void;
}

function PinnedMessages({
  pins,
  onUnpin,
  onReply,
}: {
  pins: ChatMessage[];
  onUnpin: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm font-medium text-ink hover:text-primary-500"
      >
        <span className="text-base">📌</span> {pins.length} Pinned
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-line bg-white p-2 shadow-card">
          {pins.map((p) => (
            <div key={p.id} className="group mb-2 rounded border-b border-line-hair p-2 last:border-0 hover:bg-surface-alt">
              <div className="text-xs font-medium text-ink">{p.authorName}</div>
              <div className="truncate text-xs text-ink">{p.body}</div>
              <div className="mt-2 flex gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                <button onClick={() => onUnpin(p)} className="text-[10px] font-medium text-ink-muted hover:text-negative-500">
                  Unpin
                </button>
                <button
                  onClick={() => {
                    onReply(p);
                    setOpen(false);
                  }}
                  className="text-[10px] font-medium text-ink-muted hover:text-primary-500"
                >
                  Reply
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Channel name, topic, message search, pins and mute: the strip above the conversation. */
export function ChannelHeader({
  channel,
  currentUserId,
  pins,
  onBack,
  onSearchSelect,
  onToggleMute,
  onUnpin,
  onReplyToPin,
}: ChannelHeaderProps) {
  const isDm = channel.type === "dm";
  // On a phone an open search takes over the header: the back button, name, pins and mute step aside.
  const [searching, setSearching] = useState(false);
  const aside = searching && "hidden lg:flex";

  return (
    <div className="relative flex h-[46px] shrink-0 items-center gap-4 border-b border-[#EEEEEE] pl-[10px] pr-[15px] lg:pl-[18px]">
      <button
        type="button"
        onClick={onBack}
        className={cn("rounded-md p-1.5 text-ink-muted hover:bg-black/5 hover:text-ink lg:hidden", searching && "hidden")}
        aria-label="Back to channels"
      >
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className={cn("flex min-w-0 flex-1 items-center gap-[8px]", aside)}>
        {isDm ? (
          <DmHeaderTitle channel={channel} currentUserId={currentUserId} />
        ) : (
          <>
            <Hash className="size-[16px] shrink-0 text-[#737373]" strokeWidth={1.5} />
            <h3 className="truncate text-[14px] font-medium text-[#1E1E1E]">{channel.name || "general"}</h3>
          </>
        )}
        {isDm ? null : <StarIcon className="size-4 shrink-0 text-ink-disabled" />}
        {channel.topic ? (
          <p className="hidden truncate text-xs text-ink-muted sm:block">{channel.topic}</p>
        ) : null}
      </div>

      <div className={cn("flex items-center gap-4", searching && "min-w-0 flex-1 lg:flex-none")}>
        <div className={cn("flex items-center gap-4", aside)}>
          {pins.length > 0 && <PinnedMessages pins={pins} onUnpin={onUnpin} onReply={onReplyToPin} />}
          <button
            type="button"
            onClick={onToggleMute}
            className="rounded-md p-1.5 text-ink-muted hover:bg-black/5 hover:text-ink"
            title={channel.muted ? "Unmute group" : "Mute group"}
          >
            {channel.muted ? <BellOffIcon className="size-5" /> : <BellIcon className="size-5" />}
          </button>
        </div>
        <MessageSearch onSelect={onSearchSelect} mobileOpen={searching} onMobileOpenChange={setSearching} />
      </div>
    </div>
  );
}

ChannelHeader.displayName = "ChannelHeader";
