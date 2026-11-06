import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A small bordered fact on an RFI: a bold label over its value. */
export function InfoCard({
  label,
  children,
  className,
  labelClassName,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col justify-center border border-[#EEEEEE] px-[16px]", className)}>
      <p className={cn("text-[12px] font-semibold leading-[16px] text-[#1E1E1E]", labelClassName)}>{label}</p>
      {children}
    </div>
  );
}

InfoCard.displayName = "InfoCard";
