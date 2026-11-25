import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Building blocks shared by the contract sheet's tabs, so they read as one set. */

export function SheetHeading({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("text-[16px] font-medium leading-[20px] text-[#1E1E1E]", className)}>{children}</h3>;
}

SheetHeading.displayName = "SheetHeading";

export function SheetDivider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-[#EEEEEE]", className)} />;
}

SheetDivider.displayName = "SheetDivider";

/** A label over a value in a hairline box: the Details grid's tile. */
export function SheetMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-h-[62px] border border-[#EEEEEE] bg-white px-[9px] py-[9px]">
      <p className="text-caption-m text-[#737373]">{label}</p>
      <p className="mt-[2px] text-[16px] leading-[22px] text-[#1E1E1E] [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

SheetMetric.displayName = "SheetMetric";

/** A headline figure in a hairline box: the Final account's summary tile. */
export function SheetKpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex h-[90px] flex-col justify-center gap-[6px] border border-[#EEEEEE] bg-white px-[24px]">
      <p className="text-caption-m text-[#525252]">{label}</p>
      <p className="text-[20px] font-semibold leading-[28px] tabular-nums text-[#1E1E1E]">{value}</p>
    </div>
  );
}

SheetKpi.displayName = "SheetKpi";
