import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { IconBox } from "@/components/atoms/icon-box";
import { ProgressBar } from "@/components/atoms/progress-bar";
import {
  AlertIcon,
  CalendarIcon,
  CheckIcon,
  HeartPulseIcon,
  ShieldIcon,
} from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectUpdates } from "@/hooks/use-updates";
import { useProjectRiskFactors } from "@/hooks/use-risks";
import { formatCurrency, formatTimeAgo, pct } from "@/lib/formatters";
import {
  PROJECT_STATUS_TONE,
  UPDATE_CATEGORY_LABEL,
  UPDATE_CATEGORY_TONE,
} from "@/lib/project-meta";
import type {
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
            onClick={() => navigate(`/project/${project.id}/schedule`)}
          >
            View Detailed Gantt
          </Button>
        </div>
        <TimelineStepper phases={project.timeline} />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RecentUpdatesPanel
          updates={recent}
          projectId={project.id}
          className="lg:col-span-2"
        />
        <RiskFactorsPanel risks={risks} />
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

function RiskFactorsPanel({ risks }: { risks: RiskFactor[] }) {
  return (
    <Card padding="lg">
      <h2 className="mb-4 text-base font-semibold text-gray-900">
        Identified Risk Factors
      </h2>
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
          description="Risks identified by Panda AI will appear here as they're detected."
          className="py-6"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {risks.map((risk) => (
            <li
              key={risk.id}
              className="flex items-start gap-3 rounded-xl border border-[#FDECEC] bg-[#FFF7F7] p-3"
            >
              <IconBox
                tone="red"
                size="sm"
                icon={<AlertIcon className="size-4" />}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {risk.title}
                </p>
                <p className="mt-1 text-xs text-gray-500">{risk.description}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TimelineStepper({ phases }: { phases: ProjectPhase[] }) {
  return (
    <ol className="relative flex flex-col gap-6 sm:flex-row sm:gap-0">
      {phases.map((phase, idx) => (
        <TimelineStep
          key={phase.id}
          phase={phase}
          index={idx + 1}
          isLast={idx === phases.length - 1}
        />
      ))}
    </ol>
  );
}

function TimelineStep({
  phase,
  index,
  isLast,
}: {
  phase: ProjectPhase;
  index: number;
  isLast: boolean;
}) {
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
