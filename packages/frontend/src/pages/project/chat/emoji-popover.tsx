import { useEffect, useRef } from "react";

export const COMPOSER_EMOJIS = ["👍", "❤️", "😄", "🎉", "👀", "✅", "🙏", "🔥", "🚀", "😅", "💯", "👏"];

export function EmojiPopover({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-30 mb-2 grid w-max origin-bottom-left grid-cols-6 gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg motion-safe:animate-[emoji-pop_150ms_cubic-bezier(0.175,0.885,0.32,1.275)]"
    >
      {COMPOSER_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          className="flex size-8 items-center justify-center rounded-md text-lg transition-transform duration-150 ease-out hover:bg-gray-100 active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
