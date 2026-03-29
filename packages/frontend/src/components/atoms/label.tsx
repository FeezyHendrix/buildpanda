import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium text-gray-700 text-pretty",
        className,
      )}
      {...props}
    />
  ),
);

Label.displayName = "Label";

export { Label, type LabelProps };
