import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, X } from "lucide-react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

export interface PopoverAnchor {
  /** Viewport coordinates of the pin the popover hangs off. */
  x: number;
  y: number;
}

const MARGIN = 12;
const WIDTH = 320;

/** Where a popover opened from a pin hangs: centred under the pin's element. */
export function anchorBelow(el: Element): PopoverAnchor {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.bottom + 8 };
}

/**
 * Shell shared by the composer and the thread: portalled to <body> so it
 * escapes the sheet's CSS transform, kept on screen, closed by Esc or the X.
 */
export function PinPopover({
  anchor,
  title,
  color,
  onClose,
  children,
}: {
  anchor: PopoverAnchor;
  title: string;
  color: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState(anchor);

  // Flip above the pin when the popover would overflow the bottom and clamp
  // its centre so the edges never leave the viewport.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const { height } = el.getBoundingClientRect();
    const half = WIDTH / 2;
    const x = Math.min(Math.max(anchor.x, half + MARGIN), window.innerWidth - half - MARGIN);
    const overflowsBottom = anchor.y + height + MARGIN > window.innerHeight;
    setPlacement({ x, y: overflowsBottom ? Math.max(MARGIN, anchor.y - height - 36) : anchor.y });
  }, [anchor]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-label={title}
      style={{ left: placement.x, top: placement.y, width: WIDTH }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="fixed z-[60] -translate-x-1/2 rounded-lg bg-white p-3 border border-line shadow-card"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }}>
          <MessageSquare size={12} strokeWidth={2.5} />
        </span>
        <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
        <button
          type="button"
          aria-label="Close"
          title="Close"
          onClick={onClose}
          className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-alt hover:text-gray-700"
        >
          <X size={14} />
        </button>
      </div>
      {children}
    </div>,
    document.body,
  );
}
PinPopover.displayName = "PinPopover";

export const TEXTAREA_CLASS = cn(INPUT_CLASS, "h-auto min-h-24 resize-none py-3");
