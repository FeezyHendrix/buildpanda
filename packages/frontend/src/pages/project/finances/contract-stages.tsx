import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { SearchInput } from "@/components/atoms/search-input";
import { Spinner } from "@/components/atoms/spinner";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import { useScheduleOfValues, useStages } from "@/hooks/use-stages";
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
 * Contract & stages — the contract side of a build read stage by stage.
 *
 * Each stage carries a scheduled value (its slice of the contract); the Schedule
 * of Values breaks that value into the months it gets billed in. Everything on
 * this page is a recorded figure: BuildPanda logs money that moved off-platform,
 * it never bills, charges or transfers anything.
 */

const STATUS_META: Record<StageStatus, { tone: BadgeTone; label: string }> = {
  Pending: { tone: "neutral", label: "Not started" },
  InProgress: { tone: "info", label: "In progress" },
  Done: { tone: "success", label: "Completed" },
};

const HEAD_CELL =
  "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-black-200";

function StatBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-black-200">
        {label}
      </span>
      <span className="text-lg font-bold tabular-nums text-black-500">
        {value}
      </span>
      <span className="text-[11px] text-black-300">{hint}</span>
    </div>
  );
}

StatBlock.displayName = "StatBlock";

interface StageRowProps {
  stage: Stage;
  index: number;
  projectId: string;
  currency: Currency;
  canManage: boolean;
  onEditValue: (stage: Stage) => void;
  onOpenSchedule: (stage: Stage) => void;
}

function StageRow({
  stage,
  index,
  projectId,
  currency,
  canManage,
  onEditValue,
  onOpenSchedule,
}: StageRowProps) {
  const { data: lines, isPending } = useScheduleOfValues(projectId, stage.id);
  const status = STATUS_META[stage.status];

  // Amounts come back priced by the backend; summing them through Money keeps
  // the row's totals identical to the drawer's, to the cent.
  const summary = useMemo(() => {
    const rows = lines ?? [];
    return {
      count: rows.length,
      totalPercent: Money.sum(rows.map((row) => row.percent)),
      scheduled: Money.sum(rows.map((row) => row.amount)),
      billed: Money.sum(
        rows.flatMap((row) => (row.billed ? [row.amount] : [])),
      ),
    };
  }, [lines]);

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
    <tr className="hover:bg-[#FAFAFA]">
      <td className="px-4 py-3">
        <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-[#F6F6F6] text-[12px] font-medium text-black-500">
          {index + 1}
        </span>
      </td>

      <td className="px-4 py-3 text-[13px] font-medium text-black-500">
        {stage.name}
      </td>

      <td className="px-4 py-3">
        <Badge tone={status.tone}>{status.label}</Badge>
      </td>

      <td className="px-4 py-3">
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
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-black-500">
        {stage.value > 0 ? (
          formatCurrency(stage.value, currency)
        ) : (
          <span className="font-normal text-black-200">Not priced</span>
        )}
      </td>

      <td className="w-[240px] px-4 py-3">
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
      </td>

      <td className="px-4 py-3">
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
      </td>
    </tr>
  );
}

StageRow.displayName = "StageRow";

export default function ContractStages() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "stages", "manage");
  const { data: stages = [], isPending } = useStages(project.id);

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
    <div className="w-full px-4 py-8 sm:px-10 lg:px-6">
      <Breadcrumbs
        items={[
          { label: "Finance", to: `/project/${project.id}/finances` },
          { label: "Contract & stages" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Contract & stages"
        description="What each stage of the build is worth, and which months that value gets billed in."
      />

      <section
        aria-label="Contract summary"
        className="mt-6 grid grid-cols-1 divide-y divide-grey-50 overflow-hidden rounded-2xl border border-grey-50 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        <StatBlock
          label="Scheduled contract value"
          value={formatCurrency(totals.value.round().toNumber(), project.currency)}
          hint="Across every stage on this build"
        />
        <StatBlock
          label="Stages priced"
          value={`${totals.priced} of ${stages.length}`}
          hint={
            totals.unpriced > 0
              ? `${totals.unpriced} still carry no value`
              : "Every stage carries a value"
          }
        />
        <StatBlock
          label="Recorded, not transacted"
          value="Bookkeeping only"
          hint="BuildPanda logs money that moved off-platform"
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-grey-50 bg-[#FAFAFA]">
              <tr>
                <th scope="col" className={cn(HEAD_CELL, "w-14")} />
                <th scope="col" className={HEAD_CELL}>
                  Stage
                </th>
                <th scope="col" className={HEAD_CELL}>
                  Status
                </th>
                <th scope="col" className={HEAD_CELL}>
                  Build progress
                </th>
                <th scope="col" className={cn(HEAD_CELL, "text-right")}>
                  Scheduled value
                </th>
                <th scope="col" className={HEAD_CELL}>
                  Schedule of values
                </th>
                <th scope="col" className={cn(HEAD_CELL, "text-right")}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-50">
              {isPending ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12">
                    <div className="flex items-center justify-center">
                      <Spinner size="md" />
                    </div>
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10">
                    <EmptyState
                      className="py-2"
                      title={
                        stages.length === 0
                          ? "No stages on this build yet"
                          : "No stages match that search"
                      }
                      description={
                        stages.length === 0
                          ? "Stages come from the build plan. Once they exist you can price them and schedule how each one gets billed."
                          : "Try a different stage name."
                      }
                    />
                  </td>
                </tr>
              ) : (
                visible.map((stage) => (
                  <StageRow
                    key={stage.id}
                    stage={stage}
                    index={positionById.get(stage.id) ?? 0}
                    projectId={project.id}
                    currency={project.currency}
                    canManage={canManage}
                    onEditValue={setValueTarget}
                    onOpenSchedule={setScheduleTarget}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
    </div>
  );
}
