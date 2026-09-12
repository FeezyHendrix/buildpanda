import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

/** Field label: 14/22 medium ink (Ernest's subtitle-3). */
const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium text-ink text-pretty",
        className,
      )}
      {...props}
    />
  ),
);

Label.displayName = "Label";

export { Label, type LabelProps };
