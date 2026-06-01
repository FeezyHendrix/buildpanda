import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { IconBox } from "@/components/atoms/icon-box";
import { ProgressBar } from "@/components/atoms/progress-bar";
import {
  AlertIcon,
  CalendarIcon,
  CheckIcon,
  HeartPulseIcon,
  PlusIcon,
  ShieldIcon,
} from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { InsightsSummary } from "@/components/molecules/insights-summary";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertRiskDialog,
  type UpsertRiskValues,
} from "@/components/molecules/upsert-risk-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectActivities } from "@/hooks/use-activities";
import { useProjectFinances } from "@/hooks/use-finances";
import { useProjectUpdates } from "@/hooks/use-updates";
import {
  useCreateRiskFactor,
  useDeleteRiskFactor,
  useEditRiskFactor,
  useProjectRiskFactors,
} from "@/hooks/use-risks";
import { formatCurrency, formatTimeAgo, pct } from "@/lib/formatters";
import {
  PROJECT_STATUS_TONE,
  UPDATE_CATEGORY_LABEL,
  UPDATE_CATEGORY_TONE,
} from "@/lib/project-meta";
import type {
  Activity,
  Currency,
  MilestonePayment,
  PhaseStatus,
  ProjectPhase,
  ProjectUpdate,
  RiskFactor,
} from "@/lib/project-mock-data";

const RECENT_UPDATE_LIMIT = 2;

export default function ProjectOverview() {
  const { project } = useProjectContext();
  const navigate = useNavigate();
  const { data: updates = [] } = useProjectUpdates(project.id);
  const { data: risks = [] } = useProjectRiskFactors(project.id);
  const { data: activities = [] } = useProjectActivities(project.id);
  const { data: finances } = useProjectFinances(project.id);

  const budgetPct = pct(project.budgetUsed, project.budgetTotal);
  const recent = updates.slice(0, RECENT_UPDATE_LIMIT);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Overview"
        description="Stay in control with real-time updates on progress, payments, and site activity."
        badges={
          <div className="flex items-center gap-2">
            <Badge tone="success" size="md" className="gap-1.5">
              <HeartPulseIcon className="size-3.5" />
              {project.healthScore}/100
            </Badge>
            <Badge tone="info" size="md" className="gap-1.5">
              <ShieldIcon className="size-3.5" />
              {project.risk}
            </Badge>
          </div>
        }
      />

      <div className="mt-6">
        <InsightsSummary projectId={project.id} />
      </div>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Construction Progress">
          <div className="flex items-center justify-between">
            <p className="text-3xl font-bold tabular-nums text-gray-900">
              {project.progressPercent}%
            </p>
            <Badge tone={PROJECT_STATUS_TONE[project.status]} dot>
              {project.status}
            </Badge>
          </div>
          <ProgressBar
            value={project.progressPercent}
            tone="success"
            className="mt-4"
          />
        </KpiCard>

        <KpiCard label="Budget Used">
          <p className="text-2xl font-bold tabular-nums text-gray-900">
            {formatCurrency(project.budgetUsed, project.currency)}
          </p>
          <p className="mt-1 text-xs tabular-nums text-gray-500">
            of {formatCurrency(project.budgetTotal, project.currency)}
          </p>
          <ProgressBar value={budgetPct} tone="brand" className="mt-3" />
        </KpiCard>

        <KpiCard label="Pending Approvals">
          <p className="text-3xl font-bold tabular-nums text-gray-900">
            {project.pendingApprovals}
          </p>
          {project.pendingApprovals > 0 ? (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-medium text-[#C26A00]">
                Requires attention
              </span>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-3 text-xs"
                onClick={() =>
                  navigate(`/project/${project.id}/finances/milestone-payments`)
                }
              >
                Open
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-500">All clear</p>
          )}
        </KpiCard>

        <KpiCard label="Next Inspection">
          <p className="text-2xl font-bold text-gray-900">
            {project.nextInspection.date}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
            <CalendarIcon className="size-3.5" />
            {project.nextInspection.type}
          </p>
        </KpiCard>
      </section>

      <Card className="mt-6" padding="lg">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Project Timeline
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              5-stage construction roadmap
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/project/${project.id}/project-chart`)}
          >
            View Project Chart
          </Button>
        </div>
        <TimelineStepper
          phases={project.timeline}
          activities={activities}
          milestones={finances?.milestones ?? []}
          currency={project.currency}
        />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RecentUpdatesPanel
          updates={recent}
          projectId={project.id}
          className="lg:col-span-2"
        />
        <RiskFactorsPanel projectId={project.id} risks={risks} />
      </div>
    </div>
  );
}

interface RecentUpdatesPanelProps {
  updates: ProjectUpdate[];
  projectId: string;
  className?: string;
}

function RecentUpdatesPanel({
  updates,
  projectId,
  className,
}: RecentUpdatesPanelProps) {
  return (
    <Card padding="lg" className={className}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          Latest Site Updates
        </h2>
        <Link
          to={`/project/${projectId}/updates`}
          className="text-xs font-semibold text-[#004DE7] hover:underline"
        >
          View All
        </Link>
      </div>

      {updates.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No updates yet</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {updates.map((update) => (
            <li key={update.id}>
              <UpdatePreview update={update} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const RISK_SEVERITY_TONE: Record<
  RiskFactor["severity"],
  "success" | "warning" | "danger"
> = {
  Low: "success",
  Medium: "warning",
  High: "danger",
};

function RiskFactorsPanel({
  projectId,
  risks,
}: {
  projectId: string;
  risks: RiskFactor[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const createRisk = useCreateRiskFactor();

  function handleCreate(values: UpsertRiskValues): void {
    createRisk.mutate(
      { projectId, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <Card padding="lg">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">
          Identified Risk Factors
        </h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          <PlusIcon className="size-4" />
          Add risk
        </Button>
      </div>
      {risks.length === 0 ? (
        <EmptyState
          icon={
            <IconBox
              tone="green"
              size="md"
              icon={<CheckIcon className="size-5" />}
            />
          }
          title="No active risks"
          description="Add a risk factor to track and mitigate issues on this project."
          className="py-6"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {risks.map((risk) => (
            <RiskFactorRow key={risk.id} projectId={projectId} risk={risk} />
          ))}
        </ul>
      )}

      <UpsertRiskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createRisk.isPending}
        error={(createRisk.error as Error | undefined)?.message ?? null}
      />
    </Card>
  );
}

function RiskFactorRow({
  projectId,
  risk,
}: {
  projectId: string;
  risk: RiskFactor;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editRisk = useEditRiskFactor();
  const deleteRisk = useDeleteRiskFactor();

  function handleEdit(values: UpsertRiskValues): void {
    editRisk.mutate(
      { projectId, riskId: risk.id, ...values },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  function handleDelete(): void {
    deleteRisk.mutate({ projectId, riskId: risk.id });
  }

  return (
    <li className="flex items-start gap-3 rounded-xl border border-[#FDECEC] bg-[#FFF7F7] p-3">
      <IconBox tone="red" size="sm" icon={<AlertIcon className="size-4" />} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{risk.title}</p>
        <p className="mt-1 text-xs text-gray-500">{risk.description}</p>
        <div className="mt-2 flex items-center gap-3">
          <Badge tone={RISK_SEVERITY_TONE[risk.severity]} size="sm">
            {risk.severity}
          </Badge>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="text-xs font-medium text-red-500 hover:text-red-600"
          >
            Delete
          </button>
        </div>
      </div>

      <UpsertRiskDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={{
          title: risk.title,
          description: risk.description,
          severity: risk.severity,
        }}
        onSubmit={handleEdit}
        isSubmitting={editRisk.isPending}
        error={(editRisk.error as Error | undefined)?.message ?? null}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete risk factor"
        description="This permanently removes the risk factor. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </li>
  );
}

function TimelineStepper({
  phases,
  activities,
  milestones,
  currency,
}: {
  phases: ProjectPhase[];
  activities: Activity[];
  milestones: MilestonePayment[];
  currency: Currency;
}) {
  return (
    <ol className="relative flex flex-col gap-6 sm:flex-row sm:gap-0">
      {phases.map((phase, idx) => (
        <TimelineStep
          key={phase.id}
          phase={phase}
          activities={activities.filter((activity) => activity.phaseId === phase.id)}
          milestone={milestones.find((milestone) => milestone.phase === phase.name)}
          currency={currency}
          index={idx + 1}
          isLast={idx === phases.length - 1}
        />
      ))}
    </ol>
  );
}

function TimelineStep({
  phase,
  activities,
  milestone,
  currency,
  index,
  isLast,
}: {
  phase: ProjectPhase;
  activities: Activity[];
  milestone: MilestonePayment | undefined;
  currency: Currency;
  index: number;
  isLast: boolean;
}) {
  const delayCount = activities.reduce(
    (count, activity) => count + activity.delays.length,
    0,
  );

  return (
    <li className="flex flex-1 items-start gap-3 sm:flex-col sm:gap-2">
      <div className="relative flex items-center sm:w-full sm:justify-start">
        <StepDot status={phase.status} index={index} />
        {!isLast && (
          <div
            className={`hidden h-0.5 flex-1 sm:block ${
              phase.status === "Done" ? "bg-[#1B8E45]" : "bg-[#EDEDED]"
            }`}
          />
        )}
      </div>
      <div className="min-w-0 sm:pr-3">
        <p className="text-sm font-semibold text-gray-900">{phase.name}</p>
        <p className="mt-0.5 text-xs text-gray-500">{phase.dateRange}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="neutral" size="sm">
            {activities.length} work item{activities.length === 1 ? "" : "s"}
          </Badge>
          {milestone && (
            <Badge tone="warning" size="sm">
              {formatCurrency(milestone.amount, currency, { compact: true })}
            </Badge>
          )}
          {delayCount > 0 && (
            <Badge tone="danger" size="sm" dot>
              {delayCount} delay{delayCount === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        {phase.status === "InProgress" && (
          <Badge tone="info" size="sm" dot className="mt-1.5">
            In Progress
          </Badge>
        )}
        {phase.status === "Done" && (
          <Badge tone="success" size="sm" dot className="mt-1.5">
            Done
          </Badge>
        )}
      </div>
    </li>
  );
}

function StepDot({ status, index }: { status: PhaseStatus; index: number }) {
  if (status === "Done") {
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1B8E45] text-white">
        <CheckIcon className="size-4 text-white" />
      </div>
    );
  }
  if (status === "InProgress") {
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#004DE7] text-xs font-semibold text-white">
        {index}
      </div>
    );
  }
  return (
    <div className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-[#EDEDED] bg-white text-xs font-semibold text-gray-400">
      {index}
    </div>
  );
}

function UpdatePreview({ update }: { update: ProjectUpdate }) {
  const preview = update.media[0];
  return (
    <div className="flex gap-3">
      <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-[#F6F6F6]">
        {preview ? (
          <img
            src={preview.url}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-gray-300">
            <CalendarIcon className="size-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge tone={UPDATE_CATEGORY_TONE[update.category]} size="sm">
            {UPDATE_CATEGORY_LABEL[update.category]}
          </Badge>
          <span className="text-[11px] text-gray-400">
            {formatTimeAgo(update.createdAt)}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-gray-900">
          {update.title}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
          by {update.author.name}
        </p>
      </div>
    </div>
  );
}
