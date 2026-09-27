import { cn } from "@/lib/utils";

export function IconBtn({
  label,
  onClick,
  disabled,
  className,
  children,
  ...rest
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
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
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-500 outline-none transition-colors",
        "hover:bg-gray-100 hover:text-gray-700 focus-visible:shadow-focus",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        className,
      )}
    >
      {children}
    </button>
  );
}

IconBtn.displayName = "IconBtn";
