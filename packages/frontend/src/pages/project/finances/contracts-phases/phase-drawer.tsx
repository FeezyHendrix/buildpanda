import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { DetailDrawer, DrawerMetric, DrawerSectionTitle } from "../finance-drawer";
import type { Contract } from "@/hooks/use-contracts";
import { useScheduleOfValues } from "@/hooks/use-stages";
import { formatCurrency } from "@/lib/formatters";
import type { Currency, Stage, StageStatus } from "@/lib/project-types";
import { formatPeriodHeading } from "../contract/billing-sheet-model";
import { formatPercent, percentOfContract } from "./contract-model";

/**
 * One phase, read in place: its particulars, the estimates and the used
 * figures, then its schedule-of-values lines. Edit value / Schedule open the
 * existing drawers on top.
 */

const STATUS_META: Record<StageStatus, { tone: BadgeTone; label: string; marker: string }> = {
  Pending: { tone: "neutral", label: "Not started", marker: "○" },
  InProgress: { tone: "info", label: "In progress", marker: "◑" },
  Done: { tone: "success", label: "Completed", marker: "●" },
};

interface PhaseDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  stage: Stage;
  contract: Contract;
  currency: Currency;
  canManage: boolean;
  /** Set when this drawer sits on top of the contract drawer. */
  stacked?: boolean;
  onEditValue: (stage: Stage) => void;
  onOpenSchedule: (stage: Stage) => void;
}

function money(value: number | null | undefined, currency: Currency): string {
  return value == null ? "—" : formatCurrency(value, currency);
}

function hours(value: number | null | undefined): string {
  return value == null ? "—" : `${value.toLocaleString("en-GB")} h`;
}

export function PhaseDrawer({
  open,
  onOpenChange,
  projectId,
  stage,
  contract,
  currency,
  canManage,
  stacked = false,
  onEditValue,
  onOpenSchedule,
}: PhaseDrawerProps) {
  const status = STATUS_META[stage.status];
  const { data: lines = [], isPending } = useScheduleOfValues(open ? projectId : undefined, stage.id);

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      width={stacked ? "lg" : "xl"}
      className={stacked ? "z-[60]" : undefined}
      title={stage.name}
      headerMeta={
        <>
          <Badge tone={status.tone} size="md" className="gap-1.5">
            <span aria-hidden="true">{status.marker}</span>
            {status.label}
          </Badge>
          <span className="text-sm text-ink-muted">{contract.title}</span>
          {stage.dateRange ? <span className="text-sm text-ink-muted">· {stage.dateRange}</span> : null}
        </>
      }
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={() => onOpenSchedule(stage)}>
            {canManage ? "Schedule" : "View schedule"}
          </Button>
          {canManage ? (
            <Button size="sm" onClick={() => onEditValue(stage)}>
              Edit value
            </Button>
          ) : null}
        </>
      }
    >
      <section>
        <DrawerSectionTitle>Details</DrawerSectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <DrawerMetric label="Scheduled value" value={stage.value > 0 ? formatCurrency(stage.value, currency) : "Not priced"} />
          <DrawerMetric label="% of contract" value={formatPercent(percentOfContract(stage.value, contract.total))} />
          <DrawerMetric label="Progress" value={`${stage.progressPercent}%`} />
          <DrawerMetric label="Contract" value={contract.title} />
        </div>
      </section>

      <section>
        <DrawerSectionTitle>Estimates and costs</DrawerSectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <DrawerMetric label="Est. total costs" value={money(stage.expectedCost, currency)} />
          <DrawerMetric label="Total costs" value={money(stage.totalCost, currency)} />
          <DrawerMetric label="Est. labour hours" value={hours(stage.estimatedLaborHours)} />
          <DrawerMetric label="Used labour hours" value={hours(stage.usedLaborHours)} />
          <DrawerMetric label="Labour budget" value={money(stage.laborBudget, currency)} />
          <DrawerMetric label="Material budget" value={money(stage.materialBudget, currency)} />
          <DrawerMetric label="Used material costs" value={money(stage.usedMaterialCost, currency)} />
        </div>
      </section>

      <section>
        <DrawerSectionTitle>Schedule of values</DrawerSectionTitle>
        {isPending ? (
          <div className="mt-3 flex justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : lines.length === 0 ? (
          <p className="mt-3 rounded-lg bg-surface-alt p-4 text-sm text-ink-muted">
            No billing months planned for this phase yet.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-line-hair">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell className="px-4">Month</TableHeaderCell>
                  <TableHeaderCell align="right" className="px-4">Planned %</TableHeaderCell>
                  <TableHeaderCell align="right" className="px-4">Amount</TableHeaderCell>
                  <TableHeaderCell align="right" className="px-4">Complete</TableHeaderCell>
                  <TableHeaderCell className="px-4">Billed</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="whitespace-nowrap px-4">{formatPeriodHeading(line.period)}</TableCell>
                    <TableCell align="right" className="px-4 tabular-nums">{formatPercent(line.percent)}</TableCell>
                    <TableCell align="right" className="whitespace-nowrap px-4 tabular-nums">{formatCurrency(line.amount, currency)}</TableCell>
                    <TableCell align="right" className="px-4 tabular-nums">{formatPercent(line.percentComplete)}</TableCell>
                    <TableCell className="px-4">
                      <Badge tone={line.billed ? "success" : "neutral"} size="sm">
                        {line.billed ? "Billed" : "Not billed"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </DetailDrawer>
  );
}

PhaseDrawer.displayName = "PhaseDrawer";
