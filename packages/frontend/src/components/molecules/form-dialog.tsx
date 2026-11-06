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
  footerVariant?: "default" | "stacked";
  /** `roomy` is the large-title, 40px-padded modal used for short create forms. */
  size?: "default" | "roomy";
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
  footerVariant = "default",
  size = "default",
}: FormDialogProps) {
  const roomy = size === "roomy";
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
            "overflow-hidden bg-white shadow-xl outline-none",
            className,
          )}
        >
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <header className={cn(roomy ? "px-10 pt-10 mb-4" : "px-6 pt-6 mb-5")}>
              <Dialog.Title className={cn("font-bold text-grey-800", roomy ? "text-[32px] leading-10 tracking-tight" : "text-h6")}>
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1.5 text-caption-l text-grey-450 text-pretty font-medium">
                  {description}
                </Dialog.Description>
              )}
            </header>

            <div className={cn("flex flex-col overflow-y-auto", roomy ? "gap-5 px-10 py-3" : "gap-4 px-6 py-5")}>{children}</div>

            {error && (
              <p className="mx-6 mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            {footerVariant === "stacked" ? (
              <footer className={cn("flex shrink-0 flex-col gap-2", roomy ? "px-10 pb-10 pt-8" : "px-6 pb-6 pt-2")}>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={submitting || submitDisabled}
                  className="w-full"
                >
                  {submitting ? "Submitting…" : submitLabel}
                </Button>
                <Dialog.Close
                  render={
                    <Button type="button" variant="ghost" size="lg" className="w-full">
                      {cancelLabel}
                    </Button>
                  }
                />
              </footer>
            ) : (
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
            )}
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

FormDialog.displayName = "FormDialog";

export { FormDialog, type FormDialogProps };
