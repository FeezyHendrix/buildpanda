import { Dialog } from "@base-ui-components/react/dialog";
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
            "overflow-hidden rounded-2xl bg-white shadow-xl outline-none",
            className,
          )}
        >
          <form onSubmit={handleSubmit} className="flex flex-col">
            <header className="px-6 pt-6">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1.5 text-sm text-gray-500 text-pretty">
                  {description}
                </Dialog.Description>
              )}
            </header>

            <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">{children}</div>

            {error && (
              <p className="mx-6 mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[#F0F0F0] px-6 py-4">
              <Dialog.Close
                render={
                  <Button type="button" variant="secondary" size="sm" className="h-9 px-4 text-sm">
                    {cancelLabel}
                  </Button>
                }
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submitting || submitDisabled}
                className="h-9 px-4 text-sm"
              >
                {submitting ? "Submitting…" : submitLabel}
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
