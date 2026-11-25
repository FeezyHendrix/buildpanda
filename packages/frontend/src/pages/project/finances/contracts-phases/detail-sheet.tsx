import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";

/**
 * The right-hand sheet for a contract or a phase: a name with its status, a
 * line under it, optional pill tabs, a scrolling body and a Cancel / primary
 * footer. It is its own shell (not the shared `DetailDrawer`) because the
 * design has no title rule or close X; Cancel, Esc and the backdrop close it.
 */

interface SheetTab<T extends string> {
  id: T;
  label: string;
}

interface DetailSheetProps<T extends string> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The status pill beside the title. */
  status: ReactNode;
  /** The line under the title: a contract number, a date range. */
  subtitle: string;
  /** A link-like action at the top right of the header. */
  headerAction?: ReactNode;
  tabs?: readonly SheetTab<T>[];
  activeTab?: T;
  onTabChange?: (tab: T) => void;
  /** The footer's primary action; omitted when the reader cannot edit. */
  action?: ReactNode;
  /** Cancel's width class: it is sized so its label centres where the design puts it. */
  cancelWidthClassName?: string;
  /** Popup width classes; the contract sheet is wider than the phase one. */
  widthClassName?: string;
  /** Stacking, for a sheet opened from another sheet. */
  className?: string;
  children: ReactNode;
}

export function DetailSheet<T extends string>({
  open,
  onOpenChange,
  title,
  status,
  subtitle,
  headerAction,
  tabs,
  activeTab,
  onTabChange,
  action,
  cancelWidthClassName = "w-[179px]",
  widthClassName = "w-[min(836px,100vw)]",
  className,
  children,
}: DetailSheetProps<T>) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/30 transition-opacity duration-300",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
            className,
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-drawer outline-none",
            "transition-transform duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
            widthClassName,
            className,
          )}
        >
          <header className="px-[24px] pt-[39px]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-[8px]">
                  <Dialog.Title className="truncate text-[20px] font-medium leading-[28px] text-[#1E1E1E]">{title}</Dialog.Title>
                  {status}
                </div>
                <Dialog.Description className="mt-[2px] text-caption-m text-[#737373]">{subtitle}</Dialog.Description>
              </div>
              {headerAction}
            </div>

            {tabs && activeTab && onTabChange ? (
              <div role="tablist" aria-label="Sections" className="mt-[25px] flex flex-wrap gap-[8px]">
                {tabs.map((tab) => {
                  const selected = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => onTabChange(tab.id)}
                      className={cn(
                        "h-[36px] rounded-full border px-[16px] text-caption-l font-medium outline-none transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-[#004DE7]/25",
                        selected
                          ? "border-[#1E1E1E] bg-[#1E1E1E] text-white"
                          : "border-[#EEEEEE] bg-white text-[#1E1E1E] hover:bg-[#F6F6F6]",
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </header>

          <div className={cn("flex-1 overflow-y-auto px-[24px] pb-[24px] no-scrollbar", tabs ? "pt-[26px]" : "pt-[28px]")}>{children}</div>

          <footer className="flex items-center justify-end gap-[8px] px-[24px] pb-[16px] pt-[16px]">
            <Dialog.Close
              render={
                <Button type="button" variant="ghost" size="lg" className={cn("h-[46px]", cancelWidthClassName)}>
                  Cancel
                </Button>
              }
            />
            {action}
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

DetailSheet.displayName = "DetailSheet";
