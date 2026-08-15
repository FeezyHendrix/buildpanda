import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { Button } from "./button";

interface NotificationBellProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  count?: number;
}

const NotificationBell = forwardRef<HTMLButtonElement, NotificationBellProps>(
  ({ count = 0, className, ...props }, ref) => (
    <Button
      ref={ref}
      variant='outline'
      type="button"
      aria-label={count > 0 ? `${count} notifications` : "Notifications"}
      className={cn(
        "relative w-9 h-9 inline-flex items-center justify-center bg-white text-gray-600",
        "outline-none hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/10",
        className,
      )}
      {...props}
    >
      <ReactSVG src={icons2.notification} className='size-5' />
      {count > 0 && (
        <span
          className={cn(
            "absolute right-0 top-0 flex items-center justify-center rounded-full bg-red-500 font-semibold leading-none text-white tabular-nums",
            count > 9
              ? "h-4 min-w-4 px-1 text-[8px]"
              : "size-4 text-[10px]",
          )}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Button>
  ),
);

NotificationBell.displayName = "NotificationBell";

export { NotificationBell, type NotificationBellProps };
