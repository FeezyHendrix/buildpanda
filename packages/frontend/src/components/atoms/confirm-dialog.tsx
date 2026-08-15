import { type ReactNode } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/atoms/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  // When provided, the confirm button shows a busy state and the dialog stays
  // open while the action runs; the caller closes it on success/error.
  loading?: boolean;
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
  loading,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-[#000000]/50 backdrop-blur-[0.5px] transition-opacity duration-150 ease-out",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <AlertDialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 bg-white py-8 px-10 shadow-xl outline-none",
            "transition-[transform,opacity] duration-200 ease-out",
            "data-[starting-style]:translate-y-[calc(-50%+12px)] data-[starting-style]:opacity-0",
            "data-[ending-style]:translate-y-[calc(-50%+12px)] data-[ending-style]:opacity-0",
          )}
        >
          <AlertDialog.Title className="text-h4 font-bold text-black-500 text-balance">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-2 mb-16 text-caption-l font-medium text-grey-450 text-pretty">
              {description}
            </AlertDialog.Description>
          )}
          <div className="mt-8 flex w-full items-center gap-3">
            <AlertDialog.Close className="text-caption-l font-medium text-grey-450 outline-none hover:text-black-500 w-[50%]">
              {cancelLabel}
            </AlertDialog.Close>
            <Button
              type="button"
              variant={variant === "danger" ? "danger" : "primary"}
              size="lg"
              loading={loading}
              className="px-8 w-[50%]"
              onClick={() => {
                onConfirm();
                if (loading === undefined) onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export { ConfirmDialog, type ConfirmDialogProps };
