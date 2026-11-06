import { type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

interface ModalShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * A compact, square modal: 24px all round, a bold title with 40px beneath it,
 * and whatever the dialog holds. Forms and pickers that need no header or
 * footer chrome of their own sit in this.
 */
function ModalShell({ open, onOpenChange, title, children, className }: ModalShellProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(466px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col",
            "overflow-hidden bg-white p-[24px] shadow-xl outline-none",
            className,
          )}
        >
          <Dialog.Title className="mb-[40px] text-h6! font-bold text-[#111111]">{title}</Dialog.Title>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

ModalShell.displayName = "ModalShell";

export { ModalShell, type ModalShellProps };
