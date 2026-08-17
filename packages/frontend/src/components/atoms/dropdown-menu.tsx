import { Menu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

// Thin styled wrapper over @base-ui/react/menu.
// No rounded corners — per design spec.

interface DropdownMenuItemProps {
  children: React.ReactNode;
  onSelect?: () => void;
  tone?: "default" | "danger";
  className?: string;
  disabled?: boolean;
}

function DropdownMenuItem({ children, onSelect, tone = "default", className, disabled }: DropdownMenuItemProps) {
  return (
    <Menu.Item
      disabled={disabled}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-[14px] outline-none bg-white",
        "transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40",
        tone === "danger"
          ? "text-[#C10007] hover:bg-[#FEF2F2] data-[highlighted]:bg-[#FEF2F2]"
          : "text-[#1E1E1E] hover:bg-[#F5F5F5] data-[highlighted]:bg-[#F5F5F5]",
        className,
      )}
      onClick={onSelect}
    >
      {children}
    </Menu.Item>
  );
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("my-1 h-px bg-[#EBEBEB]", className)} role="separator" />;
}

function DropdownMenuContent({
  children,
  className,
  align = "end",
  sideOffset = 6,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end" | "center";
  sideOffset?: number;
}) {
  return (
    <Menu.Portal>
      <Menu.Positioner align={align} sideOffset={sideOffset} className="z-50">
        <Menu.Popup
          className={cn(
            "flex flex-col gap-2 z-50 min-w-[160px] overflow-hidden border border-[#EBEBEB] bg-grey-50 p-2 shadow-xl",
            "origin-[var(--transform-origin)] transition-[transform,scale,opacity]",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            className,
          )}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuTrigger({
  children,
  className,
  render,
}: {
  children?: React.ReactNode;
  className?: string;
  /**
   * Renders the trigger *as* this element instead of wrapping it. Pass it
   * whenever the trigger is itself a button — Menu.Trigger renders a <button>,
   * so nesting one inside produces invalid HTML that React rejects at runtime.
   */
  render?: React.ReactElement<Record<string, unknown>>;
}) {
  return (
    <Menu.Trigger className={cn("outline-none", className)} render={render}>
      {children}
    </Menu.Trigger>
  );
}

function DropdownMenu({ children }: { children: React.ReactNode }) {
  return <Menu.Root>{children}</Menu.Root>;
}

DropdownMenu.displayName = "DropdownMenu";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
};
