import type { ReactNode } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { cn } from "@/lib/utils";

/**
 * The expenses page's one card: hairline border, square corners, a 36px title
 * bar with the title set 24px in. The stat tiles and both charts use it.
 */
export function ExpensePanel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 border border-[#EEEEEE] bg-white", className)}>
      <h3 className="flex h-[36px] items-center border-b border-[#EEEEEE] px-[24px] text-caption-l font-semibold text-[#1E1E1E]">
        {title}
      </h3>
      {children}
    </section>
  );
}

ExpensePanel.displayName = "ExpensePanel";

/** One headline figure under a title bar. */
export function ExpenseStatCard({ label, value, pending }: { label: string; value: string; pending?: boolean }) {
  return (
    <ExpensePanel title={label}>
      <div className="flex h-[70px] items-center px-[24px] pb-[8px]">
        {pending ? (
          <Spinner size="sm" />
        ) : (
          <p className="truncate text-[24px] font-medium leading-[32px] tracking-[-0.02em] tabular-nums text-[#1E1E1E]">{value}</p>
        )}
      </div>
    </ExpensePanel>
  );
}

ExpenseStatCard.displayName = "ExpenseStatCard";

/** The chart body: a fixed-height well that shows a spinner or an empty line instead of the chart. */
export function ChartWell({
  isLoading,
  isEmpty,
  emptyLabel,
  children,
}: {
  isLoading: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="relative h-[334px] w-full">
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : isEmpty ? (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-caption-l text-[#737373]">{emptyLabel}</p>
      ) : (
        children
      )}
    </div>
  );
}

ChartWell.displayName = "ChartWell";
