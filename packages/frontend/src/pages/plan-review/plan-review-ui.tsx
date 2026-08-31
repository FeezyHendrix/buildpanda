import { cn } from "@/lib/utils";
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "rounded border border-[#E2E2E2] bg-[#F6F6F6] px-1.5 py-0.5 font-mono text-[10px] leading-none text-gray-500",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function IconBtn({
  label,
  onClick,
  active,
  pressed,
  disabled,
  expanded,
  hasPopup,
  className,
  children,
  ...rest
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  hasPopup?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled" | "className" | "children">) {
  return (
    <button
      type="button"
      {...rest}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-haspopup={hasPopup ? "true" : undefined}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 outline-none transition-colors",
        "hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900/10",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        active && "bg-primary-600 text-white ring-1 ring-primary-200 hover:bg-primary-600 hover:text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PopShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      data-popover-root
      className={cn(
        "absolute z-50 mt-2 rounded-xl bg-white p-2 text-sm text-gray-700 shadow-lg ring-1 ring-black/5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const POP_ITEM_CLS =
  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-gray-700 hover:bg-[#F6F6F6]";
