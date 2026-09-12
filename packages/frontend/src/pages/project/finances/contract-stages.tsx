import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { SearchInput } from "@/components/atoms/search-input";
import { Spinner } from "@/components/atoms/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useProjectScheduleOfValues,
  useStages,
  type StageScheduleOfValue,
} from "@/hooks/use-stages";
import { formatCurrency } from "@/lib/formatters";
import { Money } from "@/lib/money";
import {
  canResourceAction,
  type Currency,
  type Stage,
  type StageStatus,
} from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { ScheduleOfValuesDrawer } from "./schedule-of-values-drawer";
import { StageValueDrawer } from "./stage-value-drawer";
import {
  ScheduleBar,
  formatPercent,
  sharePercent,
} from "./schedule-of-values-parts";

/**
 * Stages & billing — the contract side of a build read stage by stage.
 *
 * Each stage carries a scheduled value (its slice of the contract); the Schedule
 * of Values breaks that value into the months it gets billed in. Everything on
 * this tab is a recorded figure: BuildPanda logs money that moved off-platform,
 * it never bills, charges or transfers anything.
 */

const NO_LINES: StageScheduleOfValue[] = [];

const STATUS_META: Record<StageStatus, { tone: BadgeTone; label: string }> = {
  Pending: { tone: "neutral", label: "Not started" },
  InProgress: { tone: "info", label: "In progress" },
  Done: { tone: "success", label: "Completed" },
};

interface StageRowProps {
  stage: Stage;
  index: number;
  /** This stage's schedule-of-values lines, sliced from the one project-wide query. */
  lines: StageScheduleOfValue[];
  isPending: boolean;
  currency: Currency;
  canManage: boolean;
  onEditValue: (stage: Stage) => void;
  onOpenSchedule: (stage: Stage) => void;
}

function StageRow({
  stage,
  index,
  lines,
  isPending,
  currency,
  canManage,
  onEditValue,
  onOpenSchedule,
}: StageRowProps) {
  const status = STATUS_META[stage.status];

  // Amounts come back priced by the backend; summing them through Money keeps
  // the row's totals identical to the drawer's, to the cent.
  const summary = useMemo(
    () => ({
      count: lines.length,
      totalPercent: Money.sum(lines.map((row) => row.percent)),
      scheduled: Money.sum(lines.map((row) => row.amount)),
      billed: Money.sum(lines.flatMap((row) => (row.billed ? [row.amount] : []))),
    }),
    [lines],
  );

  const isOverBooked = summary.totalPercent.gt(100);
  const handleEditValue = useCallback(
    () => onEditValue(stage),
    [onEditValue, stage],
  );
  const handleOpenSchedule = useCallback(
    () => onOpenSchedule(stage),
    [onOpenSchedule, stage],
  );

  return (
    <TableRow className="hover:bg-[#FAFAFA]">
      <TableCell>
        <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-[#F6F6F6] text-[12px] font-medium text-black-500">
          {index + 1}
        </span>
      </TableCell>

      <TableCell className="font-medium text-black-500">{stage.name}</TableCell>

      <TableCell>
        <Badge tone={status.tone}>{status.label}</Badge>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-2">
          <ProgressBar
            tone={stage.status === "Done" ? "success" : "brand"}
            value={stage.progressPercent}
            className="w-20 bg-grey-50"
          />
          <span className="w-9 text-right text-[12px] tabular-nums text-black-400">
            {stage.progressPercent}%
          </span>
        </div>
      </TableCell>

      <TableCell align="right" className="whitespace-nowrap font-semibold tabular-nums text-black-500">
        {stage.value > 0 ? (
          formatCurrency(stage.value, currency)
        ) : (
          <span className="font-normal text-black-200">Not priced</span>
        )}
      </TableCell>

      <TableCell className="w-[240px]">
        {isPending ? (
          <Spinner size="xs" />
        ) : summary.count === 0 ? (
          <span className="text-[12px] text-black-200">Not scheduled</span>
        ) : (
          <div className="flex flex-col gap-1.5">
            <ScheduleBar
              billedShare={sharePercent(summary.billed, stage.value)}
              scheduledShare={sharePercent(summary.scheduled, stage.value)}
              overBooked={isOverBooked}
              showLegend={false}
            />
            <p className="flex items-center gap-1.5 text-[11px] tabular-nums text-black-300">
              <span
                className={cn(
                  "font-semibold",
                  isOverBooked ? "text-error-600" : "text-black-500",
                )}
              >
                {formatPercent(summary.totalPercent)}% scheduled
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {formatCurrency(summary.billed.round().toNumber(), currency)}{" "}
                billed
              </span>
            </p>
            {isOverBooked ? (
              <Badge tone="danger">Over 100%</Badge>
            ) : null}
          </div>
        )}
      </TableCell>

      <TableCell>
        <div className="flex items-center justify-end gap-1.5">
          {canManage ? (
            <Button variant="ghost" size="sm" onClick={handleEditValue}>
              Edit value
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={handleOpenSchedule}>
            {canManage ? "Schedule" : "View schedule"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

StageRow.displayName = "StageRow";

export function ContractStagesTab() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "stages", "manage");
  const { data: stages = [], isPending } = useStages(project.id);
  const { data: allLines, isPending: linesPending } = useProjectScheduleOfValues(project.id);

  const [search, setSearch] = useState("");
  const [valueTarget, setValueTarget] = useState<Stage | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<Stage | null>(null);

  const totals = useMemo(() => {
    const priced = stages.filter((stage) => stage.value > 0).length;
    return {
      value: Money.sum(stages.map((stage) => stage.value)),
      priced,
      unpriced: stages.length - priced,
    };
  }, [stages]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return stages;
    return stages.filter((stage) => stage.name.toLowerCase().includes(query));
  }, [stages, search]);

  /** Row numbers stay tied to the build order, not to the filtered view. */
  const positionById = useMemo(
    () => new Map(stages.map((stage, index) => [stage.id, index])),
    [stages],
  );

  /** One request for every stage's schedule, sliced per row (no N+1). */
  const linesByStage = useMemo(() => {
    const map = new Map<string, StageScheduleOfValue[]>();
    for (const line of allLines ?? []) {
      const rows = map.get(line.stageId);
      if (rows) rows.push(line);
      else map.set(line.stageId, [line]);
    }
    return map;
  }, [allLines]);

  const handleSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
    [],
  );
  const closeValueDrawer = useCallback((next: boolean) => {
    if (!next) setValueTarget(null);
  }, []);
  const closeScheduleDrawer = useCallback((next: boolean) => {
    if (!next) setScheduleTarget(null);
  }, []);

  return (
    <section aria-label="Stages and billing">
      <section
        aria-label="Contract summary"
        className="grid gap-4 sm:grid-cols-2"
      >
        <KpiCard
          label="Scheduled contract value"
          value={formatCurrency(totals.value.round().toNumber(), project.currency)}
          helper="Across every stage on this build"
        />
        <KpiCard
          label="Stages priced"
          value={`${totals.priced} of ${stages.length}`}
          helper={
            totals.unpriced > 0
              ? `${totals.unpriced} still carry no value`
              : "Every stage carries a value"
          }
        />
      </section>

      <div className="mt-6 w-full max-w-xs rounded-lg bg-[#F6F6F6]">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search stages"
          aria-label="Search stages"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-grey-50 bg-white">
        <Table className="min-w-[900px]">
          <TableHead>
            <tr>
              <TableHeaderCell scope="col" className="w-14" />
              <TableHeaderCell scope="col">Stage</TableHeaderCell>
              <TableHeaderCell scope="col">Status</TableHeaderCell>
              <TableHeaderCell scope="col">Build progress</TableHeaderCell>
              <TableHeaderCell scope="col" align="right">Scheduled value</TableHeaderCell>
              <TableHeaderCell scope="col">Schedule of values</TableHeaderCell>
              <TableHeaderCell scope="col" align="right">Actions</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {isPending ? (
              <TableEmptyRow colSpan={7} className="py-12">
                <div className="flex items-center justify-center">
                  <Spinner size="md" />
                </div>
              </TableEmptyRow>
            ) : visible.length === 0 ? (
              <TableEmptyRow colSpan={7}>
                <EmptyState
                  variant="inline"
                  title={
                    stages.length === 0
                      ? "No stages on this build yet"
                      : "No stages match that search"
                  }
                  description={
                    stages.length === 0
                      ? "Stages come from the build plan, and once they exist you can price them and schedule how each one gets billed."
                      : "Try a different stage name."
                  }
                />
              </TableEmptyRow>
            ) : (
              visible.map((stage) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  index={positionById.get(stage.id) ?? 0}
                  lines={linesByStage.get(stage.id) ?? NO_LINES}
                  isPending={linesPending}
                  currency={project.currency}
                  canManage={canManage}
                  onEditValue={setValueTarget}
                  onOpenSchedule={setScheduleTarget}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="mt-3 text-[12px] text-black-200">
        Recorded, not transacted — BuildPanda logs money that moved off-platform.
      </p>

      <StageValueDrawer
        open={valueTarget !== null}
        onOpenChange={closeValueDrawer}
        projectId={project.id}
        stage={valueTarget}
        currency={project.currency}
      />

      <ScheduleOfValuesDrawer
        open={scheduleTarget !== null}
        onOpenChange={closeScheduleDrawer}
        projectId={project.id}
        stage={scheduleTarget}
        currency={project.currency}
        canManage={canManage}
      />
    </section>
  );
}

ContractStagesTab.displayName = "ContractStagesTab";
