import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  children: ReactNode;
  description?: string;
  /** Style hooks for the screens whose design departs from the defaults. */
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}

export function FormSection({ title, children, description, className, headerClassName, bodyClassName }: FormSectionProps) {
  return (
    <div className={cn("border border-[#EBEBEB]", className)}>
      <div className={cn("border-b border-[#EBEBEB] bg-[#F8F8F8] px-8 py-3.5", headerClassName)}>
        <h3 className="text-body-s font-semibold text-[#1E1E1E]">{title}</h3>
        {description && <p className="text-caption-l text-grey-450">{description}</p>}
      </div>
      <div className={cn("space-y-5 px-8 py-6", bodyClassName)}>{children}</div>
    </div>
  );
}