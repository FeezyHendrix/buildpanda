import { Dialog } from "@base-ui/react/dialog";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The 22px X in a drawer header. */
function DrawerCloseButton({ className }: { className?: string }) {
  return (
    <Dialog.Close
      aria-label="Close"
      className={cn(
        "flex size-[30px] shrink-0 items-center justify-center rounded-sm text-ink transition-colors hover:bg-black/5",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-[22px]"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </Dialog.Close>
  );
}
DrawerCloseButton.displayName = "DrawerCloseButton";

interface DrawerSectionProps {
  /** Section heading (Ernest's drawer sections carry a 24px title). */
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A drawer body section: title, content, and a rule below it (the last section drops the rule). */
function DrawerSection({ title, actions, children, className }: DrawerSectionProps) {
  return (
    <section className={cn("flex flex-col gap-6 border-b border-line pb-10 last:border-b-0 last:pb-0", className)}>
      {title || actions ? (
        <div className="flex items-center justify-between gap-3">
          {title ? <h3 className="text-lg font-medium text-ink">{title}</h3> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
DrawerSection.displayName = "DrawerSection";

interface DrawerFieldProps {
  label: ReactNode;
  /** Muted helper under the label (e.g. "Confirm by attaching a file"). */
  hint?: ReactNode;
  children: ReactNode;
  /** Let the value grow past one line (long text, chips). */
  multiline?: boolean;
  className?: string;
}

/**
 * Ernest's label/value pair: label in the left 38%, value in the right 62% on
 * a 46px underlined row, so a read-only value and an editable field sit at the
 * same height and nothing shifts when a drawer switches between the two.
 */
function DrawerField({ label, hint, children, multiline = false, className }: DrawerFieldProps) {
  return (
    <div className={cn("flex flex-nowrap gap-3", className)}>
      <div className="flex basis-[38%] shrink-0 flex-col gap-1 pr-2">
        <p className="text-base font-medium text-ink">{label}</p>
        {hint ? <p className="text-sm font-medium text-ink-muted">{hint}</p> : null}
      </div>
      <div
        className={cn(
          "flex min-w-0 basis-[62%] items-center border-b border-line px-3 text-sm text-ink",
          multiline ? "min-h-[46px] py-3" : "h-[46px]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
DrawerField.displayName = "DrawerField";

export { DrawerCloseButton, DrawerSection, DrawerField, type DrawerSectionProps, type DrawerFieldProps };
