import { Dialog } from "@base-ui/react/dialog";
import { type ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";

type DetailDrawerWidth = "md" | "lg" | "xl";

const WIDTH_CLASS: Record<DetailDrawerWidth, string> = {
  md: "w-[min(520px,100vw)]",
  lg: "w-[min(640px,100vw)]",
  xl: "w-[min(750px,100vw)]",
};

interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Pills and one-line context rendered under the title. */
  headerMeta?: ReactNode;
  /** Controls at the top-right of the header (a status select, a back button). */
  headerActions?: ReactNode;
  /** Buttons for the footer next to Close; the footer is omitted when nothing is passed and `hideClose` is set. */
  footer?: ReactNode;
  hideClose?: boolean;
  width?: DetailDrawerWidth;
  /** Applied to the popup — e.g. a higher `z-*` so a drawer opened from another one stacks on top. */
  className?: string;
  children: ReactNode;
}

/**
 * The one read-mostly right-hand drawer: title + meta header, scrolling body,
 * Close footer. Look-aheads, daily logs and the finance drawers all render
 * through it. For forms use `FormDrawer` instead.
 */
function DetailDrawer({
  open,
  onOpenChange,
  title,
  headerMeta,
  headerActions,
  footer,
  hideClose = false,
  width = "md",
  className,
  children,
}: DetailDrawerProps) {
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
            "fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-xl outline-none",
            "transition-transform duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
            WIDTH_CLASS[width],
            className,
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-[#F0F0F0] px-6 py-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-lg font-semibold text-gray-900">{title}</Dialog.Title>
              {headerMeta ? <div className="mt-2 flex flex-wrap items-center gap-2">{headerMeta}</div> : null}
            </div>
            {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
          </header>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">{children}</div>

          {hideClose && !footer ? null : (
            <footer className="flex items-center justify-end gap-2 border-t border-[#F0F0F0] px-6 py-4">
              {hideClose ? null : (
                <Dialog.Close render={<Button type="button" variant="secondary" size="sm">Close</Button>} />
              )}
              {footer}
            </footer>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

DetailDrawer.displayName = "DetailDrawer";

/** Uppercase section caption used inside a detail drawer. */
function DrawerSectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{children}</p>
      {actions}
    </div>
  );
}

DrawerSectionTitle.displayName = "DrawerSectionTitle";

/** A label/value tile for a drawer's Details grid. */
function DrawerMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#EDEDED] bg-white p-3">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900 [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

DrawerMetric.displayName = "DrawerMetric";

export { DrawerSection, DrawerField } from "@/components/molecules/drawer-chrome";
export { DetailDrawer, DrawerSectionTitle, DrawerMetric, type DetailDrawerProps, type DetailDrawerWidth };
