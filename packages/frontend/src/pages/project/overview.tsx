import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { IconBox } from "@/components/atoms/icon-box";
import {
  AlertIcon,
  CalendarIcon,
} from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { TourGuide } from "@/components/molecules/tour-guide";
import {
  UpsertRiskDialog,
  type UpsertRiskValues,
} from "@/components/molecules/upsert-risk-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectUpdates } from "@/hooks/use-updates";
import { useTour } from "@/hooks/use-tour";
import { CONSTRUCTION_TOUR_KEY, CONSTRUCTION_TOUR_STEPS } from "@/lib/tour-steps";
import {
  useCreateRiskFactor,
  useDeleteRiskFactor,
  useEditRiskFactor,
  useProjectRiskFactors,
} from "@/hooks/use-risks";
import { formatCurrency, formatTimeAgo } from "@/lib/formatters";
import {
  UPDATE_CATEGORY_LABEL,
  UPDATE_CATEGORY_TONE,
} from "@/lib/project-meta";
import type {
  PhaseStatus,
  ProjectPhase,
  ProjectUpdate,
  RiskFactor,
} from "@/lib/project-types";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { cn } from "@/lib/utils";

import { WhatsNextCard } from "@/components/organisms/whats-next-card";
import { WeatherDashboard } from "@/components/organisms/weather-dashboard";
import { useSession } from "@/stores/auth";

const RECENT_UPDATE_LIMIT = 2;

export default function ProjectOverview() {
  const { project } = useProjectContext();
  const { data: session } = useSession();
  const { data: updates = [] } = useProjectUpdates(project.id);
  const { data: risks = [] } = useProjectRiskFactors(project.id);

  const firstName = (session?.user?.name ?? "").trim().split(" ")[0] || "there";
  const recent = updates.slice(0, RECENT_UPDATE_LIMIT);

  const tour = useTour({
    tourKey: CONSTRUCTION_TOUR_KEY,
    steps: CONSTRUCTION_TOUR_STEPS,
    enabled: true,
  });

  return (
    <div className="w-full px-6 py-8 sm:px-10">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Stay in control with real-time updates on progress, payments, and site activity."
        badges={
          <div className="flex items-center gap-2">
            <Badge size="md" className={cn('bg-[#F6F6F6] flex items-center gap-2 h-[21px]')}>
              <div className='flex items-center justify-center rounded-full bg-white h-[17px] w-[17px]'>
                <ReactSVG src={icons.love} />
            </div>
            <p className='text-[13px] font-semibold text-black-200'><span className='text-primary'>{project.healthScore}</span>/100</p>
            </Badge>
            <Badge size="md" className={cn('bg-[#F6F6F6] flex items-center gap-2 h-[21px]')}>
              <div className='flex items-center justify-center rounded-full bg-white h-[17px] w-[17px]'>
                <ReactSVG src={icons.shield} />
            </div>
              <p className='text-[13px] font-semibold text-black-200'>{project.risk}</p>
            </Badge>
          </div>
        }
      />

      {/* <div className="mt-6">
        <InsightsSummary projectId={project.id} />
      </div> */}

      <div className="mt-8">
        <WeatherDashboard projectId={project.id} />
      </div>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div data-tour="construction-progress">
          <KpiCard
            title="Construction Progress"
            icon={icons.constructionProgress}
            progress={project.progressPercent}
            className="rounded-tl-[16px] rounded-tr-[1px] rounded-br-[1px] rounded-bl-[16px]"
          />
        </div>
        <div data-tour="construction-budget">
          <KpiCard
            title="Budget Used"
            value={formatCurrency(project.budgetUsed, project.currency)}
            subValue={`of ${formatCurrency(project.budgetTotal, project.currency)}`}
            icon={icons.card}
          />
        </div>
        <div data-tour="construction-approvals">
          <KpiCard
            title="Pending Approvals"
            value={project.pendingApprovals}
            subValue={project.pendingApprovals > 0 ? "Awaiting your review" : "Nothing pending"}
            icon={icons.penSquare}
          />
        </div>
        <KpiCard
          title="Next Inspection"
          value={project.nextInspection.date || "None scheduled"}
          subValue={project.nextInspection.type || undefined}
          icon={icons.calendarSearch}
          className="rounded-tl-[1px] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[1px]"
        />
      </section>

      <div className="mt-6">
        <WhatsNextCard projectId={project.id} />
      </div>

      <Card data-tour="construction-timeline" className="rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0 mt-6">
        <div className="flex items-center justify-between py-3 px-5">
          <div className="flex gap-2 items-center">
            <ReactSVG src={icons.hourglass} />
            <h3 className="text-[13px] font-semibold text-black-300">
              Project Timeline
            </h3>
          </div>
          <Link
            to={`/project/${project.id}/project-chart`}
            className="text-xs font-semibold text-[#004DE7] bg-white rounded-[100px] py-[4px] px-[16px]"
          >
            View Detailed Gantt
          </Link>
        </div>
        <div className="bg-white rounded-[12px] h-full m-1 p-6">
          <TimelineStepper phases={project.timeline} />
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 pb-8 lg:grid-cols-2">
        <RecentUpdatesPanel
          updates={recent}
          projectId={project.id}
          className="rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0"
        />
        <RiskFactorsPanel projectId={project.id} risks={risks} className="rounded-[16px] bg-[#F8F8F8] flex flex-col h-full py-0 px-0 border-none" />
      </div>

      <TourGuide
        active={tour.active}
        step={tour.step}
        index={tour.index}
        total={tour.total}
        onNext={tour.next}
        onBack={tour.back}
        onSkip={tour.skip}
      />
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
    <Card className={className}>
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <ReactSVG src={icons.refresh} />
          <h3 className="text-[13px] font-semibold text-black-300">
            Latest Site Updates
          </h3>
        </div>
        <Link
          to={`/project/${projectId}/updates`}
          className="text-xs font-semibold text-[#004DE7] bg-white rounded-[100px] py-[4px] px-[16px]"
        >
          View All
        </Link>
      </div>

      <div className="bg-white rounded-[12px] h-full m-1 p-6">
        <div className="flex flex-col gap-6">
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
        </div>
      </div>

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
  className,
}: {
  projectId: string;
  risks: RiskFactor[];
  className?: string;
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
    <Card className={className}>
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <ReactSVG src={icons.refresh} />
          <h3 className="text-[13px] font-semibold text-black-300">
            Identified Risk Factors
          </h3>
        </div>
      </div>
      <div className="bg-white rounded-[12px] h-full m-1 p-6">
        {risks.length === 0 ? (
          <EmptyState
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

      </div>

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
          descriptionHtml: risk.descriptionHtml,
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

function TimelineStepper({ phases }: { phases: ProjectPhase[] }) {
  return (
    <ol className="flex flex-row">
      {phases.map((phase, idx) => (
        <TimelineStep
          key={phase.id}
          phase={phase}
          prevPhase={idx > 0 ? phases[idx - 1] : undefined}
          isFirst={idx === 0}
        />
      ))}
    </ol>
  );
}

function TimelineStep({
  phase,
  prevPhase,
  isFirst,
}: {
  phase: ProjectPhase;
  prevPhase?: ProjectPhase;
  isFirst: boolean;
}) {
  // Each line segment is blue when the dot on its LEFT is Done.
  // For the first step's left stub, the "dot on the left" is the first dot itself.
  const leftDone  = isFirst ? phase.status === "Done" : prevPhase?.status === "Done";
  const rightDone = phase.status === "Done";

  return (
    <li className="flex flex-1 flex-col items-center">
      {/* [left-line][dot][right-line] — dot centred in its column */}
      <div className="flex w-full items-center">
        <div className={cn("h-1 flex-1", leftDone  ? "bg-primary" : "bg-[#EDEDED]")} />
        <StepDot status={phase.status} />
        <div className={cn("h-1 flex-1", rightDone ? "bg-primary" : "bg-[#EDEDED]")} />
      </div>

      {/* Labels centred below the dot */}
      <div className="mt-3 w-full px-1 text-center">
        <p className="text-[13px] font-semibold text-gray-900">{phase.name}</p>
        {phase.status === "InProgress" ? (
          <p className="mt-0.5 text-[11px] font-medium text-primary">In Progress</p>
        ) : (
          <p className="mt-0.5 text-[11px] text-gray-400">{phase.dateRange}</p>
        )}
      </div>
    </li>
  );
}

function StepDot({ status }: { status: PhaseStatus }) {
  if (status === "Done") {
    return (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#004DE7]">
        <ReactSVG
          src={icons.verifiedCheck}
          className="[&_circle]:fill-white [&_path]:fill-white [&_path]:stroke-white [&_svg]:size-4"
        />
      </div>
    );
  } else if (status === "InProgress") {
    return (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#004DE7]">
        <ReactSVG src={icons.verifyLine} />
      </div>
    )
  }
  // Pending
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F4F4F4]">
      <ReactSVG
        src={icons.pending}
        className="[&_path]:fill-[#C0C0C0] [&_circle]:fill-[#C0C0C0] [&_circle]:stroke-[#C0C0C0] [&_svg]:size-4"
      />
    </div>
  );
}

function UpdatePreview({ update }: { update: ProjectUpdate }) {
  const preview = update.media[0];
  return (
    <div className="flex gap-6">
      <div className="rounded-[8px] w-[50%] relative">
      {/* <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-[#F6F6F6]"> */}
        {preview ? (
          <img
            src={preview.url}
            alt=""
            className='rounded-[8px] w-full h-full'
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-gray-300">
            <CalendarIcon className="size-5" />
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#00000000_0%,#00000066_40%)] rounded-[8px]" />
        <Badge tone={UPDATE_CATEGORY_TONE[update.category]} size="sm" className="absolute bottom-4 left-3 bg-[#E6EDFD80] backdrop-blur-[12px] px-[8px] py-[4px] rounded-[2px] text-[11px] font-medium text-[#F6F6F6]">
            {UPDATE_CATEGORY_LABEL[update.category]}
          </Badge>
      </div>
      <div className='flex flex-col gap-2 w-[50%]'>
        <h1 className="text-[#131B2E] text-[16px] font-semibold">
          {update.title}
        </h1>
        <p className="text-[#606060] text-[13px]">
          {update.description}
        </p>
        <p className="text-black-300 text-[11px] font-medium">
          {formatTimeAgo(update.createdAt)} • By {update.author.name}
        </p>
        <Button variant="ghost" className='hover:bg-transparent hover:text-primary text-primary flex items-center justify-start pl-0 cursor-pointer'>
          <Link to={`/project/${update.projectId}/updates`} className='p-0'>View Full Update</Link>
        </Button>
      </div>
    </div>
  );
}
