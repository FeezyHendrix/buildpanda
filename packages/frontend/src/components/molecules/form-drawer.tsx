import { useFormExit } from "@/hooks/use-form-exit";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";

type FormDrawerWidth = "md" | "lg" | "xl";

const WIDTH_CLASS: Record<FormDrawerWidth, string> = {
  md: "w-[min(480px,100vw)]",
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
  dirty?: boolean;
  onDiscard?: () => void;
  error?: string | null;
  onSubmit: () => void | Promise<void>;
  children: ReactNode;
  width?: FormDrawerWidth;
  className?: string;
  footerVariant?: "default" | "stacked";
}

function OpenFormDrawer({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  submitDisabled = false,
  submitting = false,
  dirty,
  onDiscard,
  error,
  onSubmit,
  children,
  width = "md",
  className,
  footerVariant = "default",
}: FormDrawerProps) {
  const exit = useFormExit(open, submitting, () => onOpenChange(false), { dirty, onDiscard });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (submitting || submitDisabled) return;
    void onSubmit();
  }

  return (
    <>
    <Dialog.Root open={open} onOpenChange={(next) => next ? onOpenChange(true) : exit.close()}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-[#000000]/50 backdrop-blur-[0.5px] transition-opacity duration-300",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-xl outline-none no-scrollbar",
            WIDTH_CLASS[width],
            "transition-transform duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
            className,
          )}
        >
          <form
            onChangeCapture={exit.markDirty}
            onSubmit={handleSubmit}
            className="flex h-full flex-col no-scrollbar"
          >
            <header className="px-6 py-5">
              <Dialog.Title className="text-h6 font-bold text-grey-800">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1.5 text-caption-l font-medium text-grey-450 text-pretty">
                  {description}
                </Dialog.Description>
              )}
            </header>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 no-scrollbar">
              {children}
            </div>

            {error && (
              <p className="mx-6 mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            {footerVariant === "stacked" ? (
              <footer className="flex flex-col gap-2 px-6 pb-6 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={submitting}
                  disabled={submitting || submitDisabled}
                  className="w-full"
                >
                  {submitLabel}
                </Button>
                <Dialog.Close
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="w-full"
                    >
                      {cancelLabel}
                    </Button>
                  }
                />
              </footer>
            ) : (
              <footer className="flex items-center justify-end gap-2 border-t border-[#F0F0F0] px-6 py-4">
                <Dialog.Close
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      className="px-4"
                    >
                      {cancelLabel}
                    </Button>
                  }
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={submitting}
                  disabled={submitting || submitDisabled}
                  className="px-4"
                >
                  {submitLabel}
                </Button>
              </footer>
            )}
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <ConfirmDialog open={exit.confirming} onOpenChange={(next) => { if (!next) exit.keepEditing(); }}
      title="Discard unsaved changes?" description="Your changes have not been saved."
      confirmLabel="Discard changes" cancelLabel="Keep editing" variant="danger" onConfirm={exit.discard} />
    </>
  );
}

// Mounted only while open so a reopened drawer starts from a clean form.
function FormDrawer(props: FormDrawerProps) {
  return props.open ? <OpenFormDrawer {...props} /> : null;
}

FormDrawer.displayName = "FormDrawer";

export { FormDrawer, type FormDrawerProps, type FormDrawerWidth };
