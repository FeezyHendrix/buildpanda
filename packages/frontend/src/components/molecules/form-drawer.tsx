import { Dialog } from "@base-ui/react/dialog";
import { type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";

interface FormDrawerProps {
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

function FormDrawer({
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
}: FormDrawerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (submitting || submitDisabled) return;
    void onSubmit();
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-[min(480px,100vw)] flex-col bg-white shadow-xl outline-none",
            "transition-transform duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
            className,
          )}
        >
          <form onSubmit={handleSubmit} className="flex h-full flex-col">
            <header className="border-b border-[#F0F0F0] px-6 py-5">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1.5 text-sm text-gray-500 text-pretty">
                  {description}
                </Dialog.Description>
              )}
            </header>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
              {children}
            </div>

            {error && (
              <p className="mx-6 mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <footer className="flex items-center justify-end gap-2 border-t border-[#F0F0F0] px-6 py-4">
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

FormDrawer.displayName = "FormDrawer";

export { FormDrawer, type FormDrawerProps };
