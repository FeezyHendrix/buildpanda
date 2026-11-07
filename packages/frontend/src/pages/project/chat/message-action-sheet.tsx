import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/project-types";
import { COMPOSER_EMOJIS } from "./emoji-popover";
import type { MessageActionHandlers } from "./message-actions";

const ROW_CLASS =
  "flex h-[48px] w-full items-center px-[16px] text-left text-[14px] text-[#1E1E1E] outline-none transition-colors active:bg-[#F5F5F5]";

/**
 * What a long press on a message opens on a phone: the reaction emojis on top,
 * then the same options the desktop chevron menu holds.
 */
export function MessageActionSheet({
  open,
  onOpenChange,
  message,
  isOwn,
  isPinned,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onReply,
  onQuote,
  onReaction,
  onForward,
}: MessageActionHandlers & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ChatMessage;
  isOwn: boolean;
  isPinned: boolean;
}) {
  function run(action: () => void): void {
    onOpenChange(false);
    action();
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/30" />
        <Dialog.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-[60] bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-xl outline-none",
            "[animation:sheet-up_220ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:[animation:none]",
          )}
        >
          <Dialog.Title className="sr-only">Message options</Dialog.Title>
          <div className="grid grid-cols-6 gap-[4px] border-b border-[#EEEEEE] p-[12px]">
            {COMPOSER_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => run(() => onReaction(message, emoji))}
                aria-label={`React ${emoji}`}
                className="flex h-[44px] items-center justify-center text-[22px] outline-none active:bg-[#F5F5F5]"
              >
                {emoji}
              </button>
            ))}
          </div>
          <button type="button" className={ROW_CLASS} onClick={() => run(() => onReply(message))}>
            Reply
          </button>
          {onQuote ? (
            <button type="button" className={ROW_CLASS} onClick={() => run(() => onQuote(message))}>
              Quote
            </button>
          ) : null}
          {onForward ? (
            <button type="button" className={ROW_CLASS} onClick={() => run(() => onForward(message))}>
              Create task
            </button>
          ) : null}
          <button type="button" className={ROW_CLASS} onClick={() => run(() => (isPinned ? onUnpin(message) : onPin(message)))}>
            {isPinned ? "Unpin" : "Pin"}
          </button>
          {isOwn ? (
            <>
              <button type="button" className={ROW_CLASS} onClick={() => run(() => onEdit(message))}>
                Edit
              </button>
              <button type="button" className={cn(ROW_CLASS, "text-negative-500")} onClick={() => run(() => onDelete(message))}>
                Delete
              </button>
            </>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

MessageActionSheet.displayName = "MessageActionSheet";
