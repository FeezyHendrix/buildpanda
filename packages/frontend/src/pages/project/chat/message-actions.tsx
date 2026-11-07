import { useState } from "react";
import { ChevronDown, Smile } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/project-types";
import { EmojiPopover } from "./emoji-popover";

export interface MessageActionHandlers {
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onPin: (m: ChatMessage) => void;
  onUnpin: (m: ChatMessage) => void;
  onReply: (m: ChatMessage) => void;
  onQuote?: (m: ChatMessage) => void;
  onReaction: (m: ChatMessage, emoji: string) => void;
  onForward?: (m: ChatMessage) => void;
}

/** Both hover controls stay out of the way until the message is hovered, focused or one is open. */
const REVEAL_CLASS =
  "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100";

/**
 * The smiley beside a bubble (on the side facing the page, as in WhatsApp):
 * click it to pick a reaction.
 */
export function ReactionButton({
  message,
  isOwn,
  onReaction,
}: {
  message: ChatMessage;
  isOwn: boolean;
  onReaction: MessageActionHandlers["onReaction"];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "absolute top-1/2 hidden -translate-y-1/2 lg:block",
        isOwn ? "right-full mr-[8px]" : "left-full ml-[8px]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="React to message"
        aria-expanded={open}
        className={cn(
          "flex size-[28px] items-center justify-center rounded-full border border-[#EEEEEE] bg-white text-[#4D4D4D] shadow-sm outline-none hover:text-[#1E1E1E]",
          open ? "opacity-100" : REVEAL_CLASS,
        )}
      >
        <Smile className="size-[16px]" strokeWidth={1.5} />
      </button>
      <EmojiPopover
        open={open}
        onClose={() => setOpen(false)}
        onPick={(emoji) => {
          onReaction(message, emoji);
          setOpen(false);
        }}
      />
    </div>
  );
}

ReactionButton.displayName = "ReactionButton";

/** The chevron in a bubble's top corner, opening everything else you can do with the message. */
export function MessageMenu({
  message,
  isOwn,
  isPinned,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onReply,
  onQuote,
  onForward,
}: Omit<MessageActionHandlers, "onReaction"> & { message: ChatMessage; isOwn: boolean; isPinned: boolean }) {
  return (
    <div className="absolute right-[3px] top-[3px] z-10 hidden lg:block">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Message options"
              className={cn(
                "flex size-[20px] items-center justify-center rounded-full outline-none",
                isOwn ? "bg-black/25 text-white hover:bg-black/40" : "bg-white/90 text-[#1E1E1E] shadow-sm hover:bg-white",
                REVEAL_CLASS,
              )}
            >
              <ChevronDown className="size-[14px]" strokeWidth={2} />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="w-[168px]">
          <DropdownMenuItem onSelect={() => onReply(message)}>Reply</DropdownMenuItem>
          {onQuote ? <DropdownMenuItem onSelect={() => onQuote(message)}>Quote</DropdownMenuItem> : null}
          {onForward ? <DropdownMenuItem onSelect={() => onForward(message)}>Create task</DropdownMenuItem> : null}
          <DropdownMenuItem onSelect={() => (isPinned ? onUnpin(message) : onPin(message))}>
            {isPinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          {isOwn ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onEdit(message)}>Edit</DropdownMenuItem>
              <DropdownMenuItem tone="danger" onSelect={() => onDelete(message)}>
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

MessageMenu.displayName = "MessageMenu";
