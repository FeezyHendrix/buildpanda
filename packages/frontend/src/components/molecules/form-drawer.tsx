import { Dialog } from "@base-ui/react/dialog";
import { type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { DrawerCloseButton } from "@/components/molecules/drawer-chrome";
import { cn } from "@/lib/utils";

type FormDrawerWidth = "md" | "lg" | "xl";

const WIDTH_CLASS: Record<FormDrawerWidth, string> = {
  md: "w-[min(520px,100vw)]",
  lg: "w-[min(640px,100vw)]",
  xl: "w-[min(750px,100vw)]",
};

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
  width?: FormDrawerWidth;
  className?: string;
}

/**
 * The right-hand form drawer: 24/32 header with a close X, 40px-rhythm body,
 * [Cancel · text][Submit · primary] footer pinned to the bottom right.
 */
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
  width = "md",
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
            "fixed inset-0 z-50 bg-black/30 transition-opacity duration-300",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex flex-col border-l border-line-hair bg-white shadow-drawer outline-none",
            "transition-transform duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
            WIDTH_CLASS[width],
            className,
          )}
        >
          <form onSubmit={handleSubmit} className="flex h-full flex-col">
            <header className="flex items-start justify-between gap-8 border-b border-line px-8 py-6">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-2xl font-medium text-ink">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="mt-1 text-sm text-ink-muted text-pretty">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <DrawerCloseButton />
            </header>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-8 py-8">
              {children}
            </div>

            {error && (
              <p className="mx-8 mb-3 rounded-lg bg-negative-50 px-3 py-2 text-xs text-negative-600">
                {error}
              </p>
            )}

            <footer className="flex items-center justify-end gap-4 px-8 pb-8 pt-6">
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

FormDrawer.displayName = "FormDrawer";

export { FormDrawer, type FormDrawerProps, type FormDrawerWidth };
