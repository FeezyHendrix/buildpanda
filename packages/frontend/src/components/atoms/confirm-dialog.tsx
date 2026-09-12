import { type ReactNode } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/atoms/spinner";

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

/** The 400px confirm modal: title, one sentence, [Cancel · text][Confirm · primary or negative]. */
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
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/20" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[400px] max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line-hair bg-white p-6 shadow-lg">
          <AlertDialog.Title className="text-lg font-medium text-ink text-balance">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-2 text-sm text-ink-muted text-pretty">
              {description}
            </AlertDialog.Description>
          )}
          <div className="mt-8 flex justify-end gap-4">
            <AlertDialog.Close
              className={cn(
                "flex h-[38px] items-center justify-center rounded-lg px-3 text-sm font-semibold select-none",
                "bg-transparent text-primary-500 hover:bg-black/5",
                "outline-none focus-visible:shadow-focus",
              )}
            >
              {cancelLabel}
            </AlertDialog.Close>
            <button
              type="button"
              disabled={loading}
              aria-busy={loading || undefined}
              className={cn(
                "relative flex h-[38px] items-center justify-center rounded-lg px-3 text-sm font-semibold select-none",
                "outline-none transition-colors focus-visible:shadow-focus",
                "disabled:cursor-not-allowed disabled:opacity-60",
                variant === "danger"
                  ? "bg-negative-500 text-white hover:bg-negative-600"
                  : "bg-primary-500 text-white hover:bg-primary-600",
              )}
              onClick={() => {
                onConfirm();
                if (loading === undefined) onOpenChange(false);
              }}
            >
              {loading && (
                <span className="absolute inset-0 inline-flex items-center justify-center">
                  <Spinner size="xs" tone="current" />
                </span>
              )}
              <span className={cn(loading && "invisible")}>{confirmLabel}</span>
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export { ConfirmDialog, type ConfirmDialogProps };
