import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { IconBox } from "@/components/atoms/icon-box";
import {
  ChevronRightIcon,
  MaterialsIcon,
  PlusIcon,
} from "@/components/atoms/project-nav-icons";
import {
  AiInsightsCard,
  type AiInsight,
} from "@/components/molecules/ai-insights-card";
import { FundProjectDialog } from "@/components/molecules/fund-project-dialog";
import { KpiCard } from "@/components/molecules/kpi-card";
import { MilestoneCard } from "@/components/molecules/milestone-card";
import { PageHeader } from "@/components/molecules/page-header";
import { RaiseDisputeDialog } from "@/components/molecules/raise-dispute-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useFundProject,
  useProjectFinances,
  useRaiseDispute,
  useReleaseMilestone,
} from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
  BudgetPhase,
  MaterialProcurement,
  MilestonePayment,
  ProjectFinances as ProjectFinancesData,
} from "@/lib/project-mock-data";

const INSIGHTS: AiInsight[] = [
  {
    id: "ai1",
    kind: "trend",
    message:
      "Steel prices are 14% above market average for Lagos. Recommend locking bulk purchase now.",
  },
  {
    id: "ai2",
    kind: "good",
    message:
      "Foundation spending is 6% below estimate due to optimized logistics.",
  },
  {
    id: "ai3",
    kind: "warning",
    message:
      "Finishing stage may exceed budget by 5% based on current material selection.",
  },
];

const MATERIALS_PREVIEW_LIMIT = 5;
const VARIANCE_TABLE_LIMIT = 2;

export default function ProjectFinances() {
  const { project } = useProjectContext();
  const { data: finances, isPending } = useProjectFinances(project.id);

  const [fundOpen, setFundOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<MilestonePayment | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<MilestonePayment | null>(null);

  const fundProject = useFundProject();
  const releaseMilestone = useReleaseMilestone();
  const raiseDispute = useRaiseDispute();

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#004DE7]" />
      </div>
    );
  }

  if (!finances) {
    return (
      <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
        <PageHeader
          title="Finances"
          description="Track spending, control payments, and monitor budget transparency across all phases."
        />
        <Card padding="lg" className="mt-8 text-center text-sm text-gray-500">
          No finance data yet for this project.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Finances"
        description="Track spending, control payments, and monitor budget transparency across all phases."
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => setFundOpen(true)}
          >
            <PlusIcon className="size-4" />
            Fund Project
          </Button>
        }
      />

      <section
        aria-label="Finance summary"
        className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
      >
        <SummaryTile
          label="Total Budget"
          value={formatCurrency(finances.totalBudget, finances.currency)}
        />
        <SummaryTile
          label="Funds Deposited"
          value={formatCurrency(finances.fundsDeposited, finances.currency)}
        />
        <SummaryTile
          label="Funds Released"
          value={formatCurrency(finances.fundsReleased, finances.currency)}
        />
        <SummaryTile
          label="Locked In Escrow"
          value={formatCurrency(finances.lockedInEscrow, finances.currency)}
          accent
        />
        <SummaryTile
          label="Remaining Balance"
          value={formatCurrency(finances.remainingBalance, finances.currency)}
          accent
        />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BudgetAllocationCard
          projectId={project.id}
          allocation={finances.budgetAllocation}
          currency={finances.currency}
          className="lg:col-span-2"
        />
        <MaterialsProcurementCard
          projectId={project.id}
          materials={finances.materialsProcured}
          currency={finances.currency}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AiInsightsCard insights={INSIGHTS} className="lg:col-span-1" />
        <MilestonePaymentsCard
          projectId={project.id}
          milestones={finances.milestones}
          currency={finances.currency}
          onRequestRelease={setReleaseTarget}
          onRequestDispute={setDisputeTarget}
          className="lg:col-span-2"
        />
      </div>

      <FundProjectDialog
        open={fundOpen}
        onOpenChange={setFundOpen}
        isSubmitting={fundProject.isPending}
        error={fundProject.error ? (fundProject.error as Error).message : null}
        onSubmit={(input) => {
          fundProject.mutate(
            { projectId: project.id, ...input },
            { onSuccess: () => setFundOpen(false) },
          );
        }}
      />

      <ConfirmDialog
        open={releaseTarget !== null}
        onOpenChange={(next) => {
          if (!next) setReleaseTarget(null);
        }}
        title={`Release ${releaseTarget?.name ?? "milestone"} funds?`}
        description={`${
          releaseTarget ? formatCurrency(releaseTarget.amount, finances.currency) : ""
        } will be released from escrow to the contractor.`}
        confirmLabel="Release funds"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (!releaseTarget) return;
          releaseMilestone.mutate(
            { projectId: project.id, milestoneId: releaseTarget.id },
            { onSettled: () => setReleaseTarget(null) },
          );
        }}
      />

      <RaiseDisputeDialog
        open={disputeTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDisputeTarget(null);
        }}
        milestoneName={disputeTarget?.name ?? ""}
        isSubmitting={raiseDispute.isPending}
        error={raiseDispute.error ? (raiseDispute.error as Error).message : null}
        onSubmit={({ reason }) => {
          if (!disputeTarget) return;
          raiseDispute.mutate(
            { projectId: project.id, milestoneId: disputeTarget.id, reason },
            { onSuccess: () => setDisputeTarget(null) },
          );
        }}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <KpiCard label={label} padding="md">
      <p
        className={cn(
          "text-base font-bold tabular-nums",
          accent ? "text-[#004DE7]" : "text-gray-900",
        )}
      >
        {value}
      </p>
    </KpiCard>
  );
}

interface BudgetAllocationCardProps {
  projectId: string;
  allocation: BudgetPhase[];
  currency: ProjectFinancesData["currency"];
  className?: string;
}

function BudgetAllocationCard({
  projectId,
  allocation,
  currency,
  className,
}: BudgetAllocationCardProps) {
  const maxValue = useMemo(
    () => Math.max(...allocation.flatMap((p) => [p.planned, p.actual]), 1),
    [allocation],
  );
  const variancePhases = useMemo(
    () => allocation.filter((p) => p.actual > 0).slice(0, VARIANCE_TABLE_LIMIT),
    [allocation],
  );

  return (
    <Card padding="lg" className={className}>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Budget Allocation & Analysis
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Planned vs actual spend across construction phases.
          </p>
        </div>
        <Link
          to={`/project/${projectId}/finances/budget-allocation`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#004DE7] hover:underline"
        >
          View More
          <ChevronRightIcon className="size-3.5" />
        </Link>
      </div>

      <ChartLegend />

      <div className="flex h-44 items-stretch gap-3">
        {allocation.map((phase) => (
          <PhaseBars
            key={phase.id}
            phase={phase}
            maxValue={maxValue}
            currency={currency}
          />
        ))}
      </div>

      <VarianceTable phases={variancePhases} currency={currency} />
    </Card>
  );
}

function ChartLegend() {
  return (
    <div className="mb-4 flex items-center gap-4 text-xs">
      <span className="inline-flex items-center gap-1.5 text-gray-600">
        <span className="size-2.5 rounded-sm bg-[#004DE7]" /> Planned
      </span>
      <span className="inline-flex items-center gap-1.5 text-gray-600">
        <span className="size-2.5 rounded-sm bg-[#1B8E45]" /> Actual
      </span>
    </div>
  );
}

function PhaseBars({
  phase,
  maxValue,
  currency,
}: {
  phase: BudgetPhase;
  maxValue: number;
  currency: ProjectFinancesData["currency"];
}) {
  const plannedH = Math.max(4, (phase.planned / maxValue) * 100);
  const actualH = Math.max(2, (phase.actual / maxValue) * 100);
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <div className="flex w-full flex-1 items-end justify-center gap-1">
        <div
          className="w-3 rounded-t-md bg-[#004DE7]"
          style={{ height: `${plannedH}%` }}
          title={`Planned: ${formatCurrency(phase.planned, currency)}`}
        />
        <div
          className="w-3 rounded-t-md bg-[#1B8E45]"
          style={{ height: `${actualH}%` }}
          title={`Actual: ${formatCurrency(phase.actual, currency)}`}
        />
      </div>
      <span className="line-clamp-1 max-w-full text-[10px] text-gray-500">
        {phase.name}
      </span>
    </div>
  );
}

function VarianceTable({
  phases,
  currency,
}: {
  phases: BudgetPhase[];
  currency: ProjectFinancesData["currency"];
}) {
  return (
    <table className="mt-6 w-full text-left text-xs">
      <thead>
        <tr className="border-b border-[#F0F0F0] text-gray-500">
          <th className="py-2 font-medium">Phase</th>
          <th className="py-2 text-right font-medium">Planned</th>
          <th className="py-2 text-right font-medium">Actual</th>
          <th className="py-2 text-right font-medium">Variance</th>
        </tr>
      </thead>
      <tbody>
        {phases.map((phase) => (
          <VarianceRow key={phase.id} phase={phase} currency={currency} />
        ))}
      </tbody>
    </table>
  );
}

function VarianceRow({
  phase,
  currency,
}: {
  phase: BudgetPhase;
  currency: ProjectFinancesData["currency"];
}) {
  const variance = phase.actual - phase.planned;
  const isOver = variance > 0;
  const pctOff = Math.abs((variance / phase.planned) * 100).toFixed(1);
  return (
    <tr className="border-b border-[#F8F8F8]">
      <td className="py-2.5 text-gray-700">{phase.name}</td>
      <td className="py-2.5 text-right tabular-nums text-gray-700">
        {formatCurrency(phase.planned, currency)}
      </td>
      <td className="py-2.5 text-right tabular-nums text-gray-700">
        {formatCurrency(phase.actual, currency)}
      </td>
      <td
        className={cn(
          "py-2.5 text-right font-semibold tabular-nums",
          isOver ? "text-[#C72525]" : "text-[#1B8E45]",
        )}
      >
        {isOver ? "+" : "−"}
        {formatCurrency(Math.abs(variance), currency)} ({pctOff}%)
      </td>
    </tr>
  );
}

interface MaterialsProcurementCardProps {
  projectId: string;
  materials: MaterialProcurement[];
  currency: ProjectFinancesData["currency"];
}

function MaterialsProcurementCard({
  projectId,
  materials,
  currency,
}: MaterialsProcurementCardProps) {
  const preview = materials.slice(0, MATERIALS_PREVIEW_LIMIT);
  return (
    <Card padding="lg">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Materials Procurement
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">Recent purchases.</p>
        </div>
        <Link
          to={`/project/${projectId}/materials`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#004DE7] hover:underline"
        >
          View More
          <ChevronRightIcon className="size-3.5" />
        </Link>
      </div>
      <ul className="flex flex-col">
        {preview.map((material, idx) => (
          <MaterialRow
            key={`${material.id}-${idx}`}
            material={material}
            currency={currency}
          />
        ))}
      </ul>
    </Card>
  );
}

function MaterialRow({
  material,
  currency,
}: {
  material: MaterialProcurement;
  currency: ProjectFinancesData["currency"];
}) {
  return (
    <li className="flex items-center gap-3 border-b border-[#F0F0F0] py-3 last:border-b-0">
      <IconBox
        tone={material.thumbnailTone}
        size="sm"
        icon={<MaterialsIcon className="size-4" />}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {material.name}
        </p>
        <p className="text-[11px] text-gray-500">
          {material.purchasedAt} ·{" "}
          <a className="text-[#004DE7] hover:underline" href="#">
            {material.receipt}
          </a>
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
        {formatCurrency(material.amount, currency)}
      </p>
    </li>
  );
}

interface MilestonePaymentsCardProps {
  projectId: string;
  milestones: MilestonePayment[];
  currency: ProjectFinancesData["currency"];
  onRequestRelease: (milestone: MilestonePayment) => void;
  onRequestDispute: (milestone: MilestonePayment) => void;
  className?: string;
}

function MilestonePaymentsCard({
  projectId,
  milestones,
  currency,
  onRequestRelease,
  onRequestDispute,
  className,
}: MilestonePaymentsCardProps) {
  return (
    <Card padding="lg" className={className}>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Milestone Payments
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Release funds based on verified completion.
          </p>
        </div>
        <Link
          to={`/project/${projectId}/finances/milestone-payments`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#004DE7] hover:underline"
        >
          View More
          <ChevronRightIcon className="size-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {milestones.map((milestone, idx) => (
          <MilestoneCard
            key={`${milestone.id}-${idx}`}
            milestone={milestone}
            currency={currency}
            variant="compact"
            onReleaseFunds={() => onRequestRelease(milestone)}
            onRaiseDispute={() => onRequestDispute(milestone)}
          />
        ))}
      </div>
    </Card>
  );
}
