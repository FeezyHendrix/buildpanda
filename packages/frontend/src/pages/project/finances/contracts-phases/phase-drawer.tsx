import { ArrowUpRight } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import type { Contract } from "@/hooks/use-contracts";
import { useScheduleOfValues } from "@/hooks/use-stages";
import { formatCurrency } from "@/lib/formatters";
import type { Currency, Stage, StageStatus } from "@/lib/project-types";
import { formatPeriodHeading } from "../contract/billing-sheet-model";
import { formatPercent, formatSignedDate, percentOfContract } from "./contract-model";
import { DetailSheet } from "./detail-sheet";
import { SheetHeading, SheetMetric } from "./sheet-parts";

/**
 * One phase, read in place: its particulars, the estimates and the used
 * figures, then its schedule-of-values lines. Edit value / Schedule open the
 * existing drawers on top.
 */

const STATUS_META: Record<StageStatus, { tone: BadgeTone; label: string }> = {
  Pending: { tone: "warning", label: "Pending" },
  InProgress: { tone: "info", label: "In progress" },
  Done: { tone: "success", label: "Completed" },
};

const HEADER_CELL = "h-[35px] px-[24px] py-0 text-caption-m font-medium normal-case text-[#525252]";
const BODY_CELL = "whitespace-nowrap px-[24px] py-0 text-caption-l text-[#1E1E1E] tabular-nums";

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

/** "Main contract · 15 Oct 2026 – 22 Oct 2026": the contract and the dates the phase runs. */
function phaseSubtitle(stage: Stage, contract: Contract): string {
  const range =
    stage.startDate && stage.endDate
      ? `${formatSignedDate(stage.startDate)} – ${formatSignedDate(stage.endDate)}`
      : stage.dateRange;
  return range ? `${contract.title} · ${range}` : contract.title;
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
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      widthClassName="w-[min(592px,100vw)]"
      className={stacked ? "z-[60]" : undefined}
      title={stage.name}
      status={
        <Badge tone={status.tone} size="sm" className="text-caption-m font-medium">
          {status.label}
        </Badge>
      }
      subtitle={phaseSubtitle(stage, contract)}
      headerAction={
        <button
          type="button"
          onClick={() => onOpenSchedule(stage)}
          className="mt-[15px] inline-flex shrink-0 items-center gap-[8px] text-caption-l font-medium text-[#004DE7] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#004DE7]/25"
        >
          {canManage ? "Schedule" : "View Schedule"}
          <ArrowUpRight className="size-[18px]" strokeWidth={1.5} aria-hidden />
        </button>
      }
      action={
        canManage ? (
          <Button type="button" size="lg" className="h-[46px] w-[179px]" onClick={() => onEditValue(stage)}>
            Edit Value
          </Button>
        ) : undefined
      }
    >
      <section>
        <SheetHeading>Details</SheetHeading>
        <div className="mt-[18px] grid grid-cols-1 gap-x-[24px] gap-y-[16px] sm:grid-cols-2">
          <SheetMetric label="Scheduled value" value={stage.value > 0 ? formatCurrency(stage.value, currency) : "Not priced"} />
          <SheetMetric label="% of contract" value={formatPercent(percentOfContract(stage.value, contract.total))} />
          <SheetMetric label="Progress" value={`${stage.progressPercent}%`} />
          <SheetMetric label="Contract" value={contract.title} />
        </div>
      </section>

      <section className="mt-[26px]">
        <SheetHeading>Estimates and costs</SheetHeading>
        <div className="mt-[18px] grid grid-cols-1 gap-x-[24px] gap-y-[16px] sm:grid-cols-2">
          <SheetMetric label="Est. total costs" value={money(stage.expectedCost, currency)} />
          <SheetMetric label="Total costs" value={money(stage.totalCost, currency)} />
          <SheetMetric label="Est. labour hours" value={hours(stage.estimatedLaborHours)} />
          <SheetMetric label="Used labour hours" value={hours(stage.usedLaborHours)} />
          <SheetMetric label="Labour budget" value={money(stage.laborBudget, currency)} />
          <SheetMetric label="Material budget" value={money(stage.materialBudget, currency)} />
          <SheetMetric label="Used material costs" value={money(stage.usedMaterialCost, currency)} />
        </div>
      </section>

      <section className="mt-[26px]">
        <SheetHeading>Schedule of values</SheetHeading>
        {isPending ? (
          <div className="mt-[18px] flex justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : lines.length === 0 ? (
          <p className="mt-[18px] flex h-[36px] items-center justify-center bg-[#F6F6F6] px-4 text-caption-m text-[#737373]">
            No billing months planned for this phase yet.
          </p>
        ) : (
          <div className="mt-[18px] border border-[#EEEEEE]">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell className={HEADER_CELL}>Month</TableHeaderCell>
                  <TableHeaderCell className={HEADER_CELL}>Planned %</TableHeaderCell>
                  <TableHeaderCell className={HEADER_CELL}>Amount</TableHeaderCell>
                  <TableHeaderCell className={HEADER_CELL}>Billed</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.id} className="h-[46px] border-[#EEEEEE]">
                    <TableCell className={BODY_CELL}>{formatPeriodHeading(line.period)}</TableCell>
                    <TableCell className={BODY_CELL}>{formatPercent(line.percent)}</TableCell>
                    <TableCell className={BODY_CELL}>{formatCurrency(line.amount, currency)}</TableCell>
                    <TableCell className={BODY_CELL}>
                      <Badge tone={line.billed ? "success" : "neutral"} size="sm" className="text-caption-m font-medium">
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
    </DetailSheet>
  );
}

PhaseDrawer.displayName = "PhaseDrawer";
