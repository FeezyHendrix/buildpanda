import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type FieldProps = {
  /** The id of the control this labels. */
  htmlFor: string;
  label: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
};

/** A form control under its label. */
export function Field({ htmlFor, label, optional, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-[0.8125rem] font-semibold">
        {label}
        {optional ? <span className="ml-1 font-normal text-ink-soft">(optional)</span> : null}
      </label>
      {children}
    </div>
  );
}
