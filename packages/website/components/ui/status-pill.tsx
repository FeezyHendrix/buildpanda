import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
} as const;

type StatusPillProps = { tone: keyof typeof tones; children: ReactNode; className?: string };

/** A small status label, as the product shows them. The wording carries the meaning; colour only supports it. */
export function StatusPill({ tone, children, className }: StatusPillProps) {
  return (
    <span className={cn("rounded-full px-2 py-[0.1875rem] text-[0.6875rem] font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}
