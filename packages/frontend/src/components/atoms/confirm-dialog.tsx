import { type ReactNode } from "react";
import { AlertDialog } from "@base-ui-components/react/alert-dialog";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  children?: ReactNode;
}

function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/20" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-96 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg">
          <AlertDialog.Title className="text-lg font-semibold text-gray-900 text-balance">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-2 text-sm text-gray-500 text-pretty">
              {description}
            </AlertDialog.Description>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Close
              className={cn(
                "flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium select-none",
                "bg-[#F6F6F6] text-gray-700 hover:bg-gray-200",
                "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
              )}
            >
              {cancelLabel}
            </AlertDialog.Close>
            <button
              type="button"
              className={cn(
                "flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold select-none",
                "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
                variant === "danger"
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-[#004DE7] text-white hover:bg-[#0041c4]",
              )}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export { ConfirmDialog, type ConfirmDialogProps };
