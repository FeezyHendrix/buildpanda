import { Card } from "@/components/atoms/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
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
    <Table wrapperClassName={noCard ? className : undefined}>
      <TableHead>
        <tr>
          <TableHeaderCell>Phase</TableHeaderCell>
          <TableHeaderCell>Planned</TableHeaderCell>
          <TableHeaderCell>Actual Spent</TableHeaderCell>
          <TableHeaderCell>Variance</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {allocation.map((phase) => (
          <VarianceRow key={phase.id} phase={phase} currency={currency} />
        ))}
      </TableBody>
    </Table>
  );

  if (noCard) {
    return table;
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
}: {
  phase: BudgetPhase;
  currency: ProjectFinances["currency"];
}) {
  const hasActual = phase.actual > 0;
  const variance  = phase.actual - phase.planned;
  const isOver    = variance > 0;
  const status    = getPhaseStatus(phase);

  return (
    <TableRow>
      <TableCell className="font-medium text-black-500">{phase.name}</TableCell>
      <TableCell className="tabular-nums">{formatCurrency(phase.planned, currency)}</TableCell>
      <TableCell className="tabular-nums text-gray-700">
        {hasActual ? formatCurrency(phase.actual, currency) : "-"}
      </TableCell>
      <TableCell
        className={cn(
          "font-medium tabular-nums",
          !hasActual ? "text-gray-400" : isOver ? "text-[#BA1A1A]" : "text-[#0039B1]",
        )}
      >
        {!hasActual
          ? "-"
          : `${isOver ? "+" : "−"}${formatCurrency(Math.abs(variance), currency)}`}
      </TableCell>
      <TableCell>
        <span
          className={cn(
            "text-[11px] font-semibold",
            status.pill && "rounded-full px-2.5 py-0.5",
            status.className,
          )}
        >
          {status.label}
        </span>
      </TableCell>
    </TableRow>
  );
}
