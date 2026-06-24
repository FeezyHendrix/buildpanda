import { Card } from "@/components/atoms/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { BudgetPhase, ProjectFinances } from "@/lib/project-types";

export type PhaseStatus = {
  label: string;
  pill: boolean;
  className: string;
};

export function getPhaseStatus(phase: BudgetPhase): PhaseStatus {
  if (phase.actual === 0) {
    return { label: "Pending",    pill: true, className: "text-black-100 bg-[#F6F6F6]" };
  }
  const variance = phase.actual - phase.planned;
  const pct      = Math.abs(variance / (phase.planned || 1));

  if (variance <= 0) {
    return {
      label: "On budget",
      pill: true,
      className: "bg-primary-50 text-primary",
    };
  }
  if (pct <= 0.05) {
    return { label: "Completed",    pill: true, className: "bg-[#F6F6F6] text-black-300" };
  }
  return {
    label: "Over budget",
    pill: true,
    className: "bg-error-50 text-error-500",
  };
}

export interface VarianceTableProps {
  allocation: BudgetPhase[];
  currency: ProjectFinances["currency"];
  className?: string;
  /** When true: renders without the outer Card shell (for use inside another card) */
  noCard?: boolean;
}

export function VarianceTable({
  allocation,
  currency,
  className,
  noCard = false,
}: VarianceTableProps) {
  const table = (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-[#EDEDED] bg-[#F6F6F6] text-[11px] uppercase tracking-wider text-gray-500">
        <tr>
          <th className="px-6 py-3 font-semibold">Phase</th>
          <th className="px-6 py-3 font-semibold capitalize">Planned</th>
          <th className="px-6 py-3 font-semibold capitalize">Actual Spent</th>
          <th className="px-6 py-3 font-semibold capitalize">Variance</th>
          <th className="px-6 py-3 font-semibold capitalize">Status</th>
        </tr>
      </thead>
      <tbody>
        {allocation.map((phase, idx) => (
          <VarianceRow
            key={phase.id}
            phase={phase}
            currency={currency}
            isLast={idx === allocation.length - 1}
          />
        ))}
      </tbody>
    </table>
  );

  if (noCard) {
    return <div className={cn("overflow-x-auto", className)}>{table}</div>;
  }

  return (
    <Card padding="none" className={cn("overflow-hidden", className)}>
      <div className="border-b border-[#EDEDED] bg-[#FAFAFA] px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">
          Detailed Variance Table
        </h2>
      </div>
      {table}
    </Card>
  );
}

function VarianceRow({
  phase,
  currency,
  isLast,
}: {
  phase: BudgetPhase;
  currency: ProjectFinances["currency"];
  isLast: boolean;
}) {
  const hasActual = phase.actual > 0;
  const variance  = phase.actual - phase.planned;
  const isOver    = variance > 0;
  const status    = getPhaseStatus(phase);

  return (
    <tr className={isLast ? undefined : "border-b border-[#F0F0F0]"}>
      <td className="px-6 py-3 font-medium text-black-500">{phase.name}</td>
      <td className="px-6 py-3 tabular-nums text-[#131B2E]">
        {formatCurrency(phase.planned, currency)}
      </td>
      <td className="px-6 py-3 tabular-nums text-gray-700">
        {hasActual ? formatCurrency(phase.actual, currency) : "-"}
      </td>
      <td
        className={cn(
          "px-6 py-3 font-medium tabular-nums",
          !hasActual ? "text-gray-400" : isOver ? "text-[#BA1A1A]" : "text-[#0039B1]",
        )}
      >
        {!hasActual
          ? "-"
          : `${isOver ? "+" : "−"}${formatCurrency(Math.abs(variance), currency)}`}
      </td>
      <td className="px-6 py-3">
        <span
          className={cn(
            "text-[11px] font-semibold",
            status.pill && "rounded-full px-2.5 py-0.5",
            status.className,
          )}
        >
          {status.label}
        </span>
      </td>
    </tr>
  );
}
