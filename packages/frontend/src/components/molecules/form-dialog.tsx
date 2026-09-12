import { Dialog } from "@base-ui/react/dialog";
import { type ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  submitDisabled?: boolean;
  submitting?: boolean;
  error?: string | null;
  onSubmit: () => void | Promise<void>;
  children: ReactNode;
  className?: string;
}

interface SubmitEventLike {
  preventDefault(): void;
}

/** Centred form modal: 12px corners, 24px padding, [Cancel · text][Submit · primary] footer. */
function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  submitDisabled = false,
  submitting = false,
  error,
  onSubmit,
  children,
  className,
}: FormDialogProps) {
  function handleSubmit(event: SubmitEventLike): void {
    event.preventDefault();
    if (submitting || submitDisabled) return;
    void onSubmit();
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col",
            "overflow-hidden rounded-lg border border-line-hair bg-white shadow-lg outline-none",
            className,
          )}
        >
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <header className="px-6 pt-6">
              <Dialog.Title className="text-lg font-medium text-ink">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-ink-muted text-pretty">
                  {description}
                </Dialog.Description>
              )}
            </header>

            <div className="flex flex-col gap-4 overflow-y-auto px-6 py-6">{children}</div>

            {error && (
              <p className="mx-6 mb-3 rounded-lg bg-negative-50 px-3 py-2 text-xs text-negative-600">
                {error}
              </p>
            )}

            <footer className="flex shrink-0 items-center justify-end gap-4 px-6 pb-6">
              <Dialog.Close
                render={
                  <Button type="button" variant="ghost" size="md">
                    {cancelLabel}
                  </Button>
                }
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={submitting}
                disabled={submitting || submitDisabled}
              >
                {submitLabel}
              </Button>
            </footer>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

FormDialog.displayName = "FormDialog";

export { FormDialog, type FormDialogProps };
