import { Dialog } from "@base-ui/react/dialog";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The close X in a drawer header. */
function DrawerCloseButton({ className }: { className?: string }) {
  return (
    <Dialog.Close
      aria-label="Close"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </Dialog.Close>
  );
}
DrawerCloseButton.displayName = "DrawerCloseButton";

interface DrawerSectionProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A drawer body section: uppercase caption, content, and a rule below it (the last section drops the rule). */
function DrawerSection({ title, actions, children, className }: DrawerSectionProps) {
  return (
    <section className={cn("flex flex-col gap-4 border-b border-[#F0F0F0] pb-6 last:border-b-0 last:pb-0", className)}>
      {title || actions ? (
        <div className="flex items-center justify-between gap-3">
          {title ? (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{title}</p>
          ) : (
            <span />
          )}
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
  /** Muted helper under the label. */
  hint?: ReactNode;
  children: ReactNode;
  /** Let the value grow past one line (long text, chips). */
  multiline?: boolean;
  className?: string;
}

/** A label/value row: label on the left, value on the right on a hairline rule. */
function DrawerField({ label, hint, children, multiline = false, className }: DrawerFieldProps) {
  return (
    <div className={cn("flex flex-nowrap gap-3", className)}>
      <div className="flex basis-[38%] shrink-0 flex-col gap-0.5 pr-2">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
      </div>
      <div
        className={cn(
          "flex min-w-0 basis-[62%] items-center border-b border-[#F0F0F0] px-2 text-sm text-gray-900",
          multiline ? "min-h-10 py-2" : "h-10",
        )}
      >
        {children}
      </div>
    </div>
  );
}
DrawerField.displayName = "DrawerField";

export { DrawerCloseButton, DrawerSection, DrawerField, type DrawerSectionProps, type DrawerFieldProps };
