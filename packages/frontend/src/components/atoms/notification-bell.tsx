import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface NotificationBellProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  count?: number;
}

const BellIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5"
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const NotificationBell = forwardRef<HTMLButtonElement, NotificationBellProps>(
  ({ count = 0, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={count > 0 ? `${count} notifications` : "Notifications"}
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-full bg-white text-gray-600",
        "outline-none hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/10",
        className,
      )}
      {...props}
    >
      <BellIcon />
      {count > 0 && (
        <span className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold leading-none text-white tabular-nums">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  ),
);

NotificationBell.displayName = "NotificationBell";

export { NotificationBell, type NotificationBellProps };
