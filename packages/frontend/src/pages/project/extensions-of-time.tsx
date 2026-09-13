import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { DecideEotDialog } from "./extensions-of-time/decide-eot-dialog";
import { EotTable } from "./extensions-of-time/eot-table";
import {
  UpsertEotClaimDialog,
  type UpsertEotClaimValues,
} from "./extensions-of-time/upsert-eot-claim-dialog";
import {
  claimableDelays,
  EOT_STATUS_FILTERS,
  type EotStatusFilter,
} from "./extensions-of-time/eot-meta";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectActivities } from "@/hooks/use-activities";
import { useParticipants } from "@/hooks/use-participants";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import {
  useCreateEotClaim,
  useDecideEotClaim,
  useEotClaims,
  useSubmitEotClaim,
  useUpdateEotClaim,
} from "@/hooks/use-extensions-of-time";
import { errorMessage } from "@/lib/api-error";
import { formatShortDate } from "@/lib/formatters";
import { participantChoices } from "@/lib/assignee-options";
import { canResourceAction, type Project } from "@/lib/project-types";
import { icons } from "@/assets/icons/icons";
import type { EotClaim } from "@/api/extensions-of-time";

function CompletionBanner({
  completionDate,
  revisedCompletionDate,
  daysApproved,
  daysPending,
}: {
  completionDate: string | null;
  revisedCompletionDate: string | null;
  daysApproved: number;
  daysPending: number;
}) {
  const revised = revisedCompletionDate ?? completionDate;
  return (
    <section aria-label="Completion position" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Revised completion"
        icon={icons.calendarSearch}
        value={revised ? formatShortDate(revised) : "Not set"}
        helper={
          completionDate && revised !== completionDate
            ? `Contract date ${formatShortDate(completionDate)}`
            : "Moves only on an approved award"
        }
      />
      <KpiCard label="Days awarded" icon={icons.verifiedCheck} value={daysApproved} />
      <KpiCard label="Days claimed, undecided" icon={icons.hourglass} value={daysPending} />
      <KpiCard
        label="Contract completion"
        icon={icons.calendarSearch}
        value={completionDate ? formatShortDate(completionDate) : "Not set"}
      />
    </section>
  );
}

CompletionBanner.displayName = "CompletionBanner";

export default function ProjectExtensionsOfTime() {
  const { project, access } = useProjectContext();
  const typedProject: Project = project;
  const canManage = Boolean(access && canResourceAction(access, "schedule", "manage"));

  const { data: claims = [], isPending } = useEotClaims(typedProject.id);
  const { data: activities = [] } = useProjectActivities(typedProject.id);
  const { data: participants = [] } = useParticipants(typedProject.id, canManage);
  const snapshot = useReportingSnapshot(typedProject.id);

  const createClaim = useCreateEotClaim();
  const updateClaim = useUpdateEotClaim();
  const submitClaim = useSubmitEotClaim();
  const decideClaim = useDecideEotClaim();

  const [statusFilter, setStatusFilter] = useState<EotStatusFilter>("all");
  const [upsertOpen, setUpsertOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EotClaim | null>(null);
  const [decideTarget, setDecideTarget] = useState<EotClaim | null>(null);

  const delays = claimableDelays(activities);
  const namesById = new Map(
    participantChoices(participants).flatMap((c) => (c.userId ? [[c.userId, c.name] as const] : [])),
  );
  const filtered = claims.filter((c) => statusFilter === "all" || c.status === statusFilter);

  const schedule = snapshot.data?.schedule;
  const daysApproved =
    schedule?.eotDaysApproved ??
    claims.reduce((sum, c) => (c.status === "Approved" ? sum + (c.daysAwarded ?? 0) : sum), 0);
  const daysPending =
    schedule?.eotDaysPending ??
    claims.reduce((sum, c) => (c.status === "Submitted" ? sum + c.daysClaimed : sum), 0);

  function handleUpsert(values: UpsertEotClaimValues): void {
    if (editTarget) {
      updateClaim.mutate(
        { projectId: typedProject.id, claimId: editTarget.id, ...values },
        { onSuccess: closeUpsert },
      );
      return;
    }
    createClaim.mutate({ projectId: typedProject.id, ...values }, { onSuccess: closeUpsert });
  }

  function closeUpsert(): void {
    setUpsertOpen(false);
    setEditTarget(null);
  }

  return (
    <div className="w-full px-4 pt-4 pb-8 sm:px-10 lg:px-6">
      <PageHeader
        title="Extensions of time"
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setEditTarget(null);
                createClaim.reset();
                setUpsertOpen(true);
              }}
            >
              <PlusIcon className="size-4" />
              New claim
            </Button>
          ) : undefined
        }
      />

      <CompletionBanner
        completionDate={schedule?.completionDate ?? null}
        revisedCompletionDate={schedule?.revisedCompletionDate ?? null}
        daysApproved={daysApproved}
        daysPending={daysPending}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <FilterTabs
          items={EOT_STATUS_FILTERS}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filter claims"
        />
        <p className="ml-auto text-sm text-ink-muted">
          {filtered.length} of {claims.length} {claims.length === 1 ? "claim" : "claims"}
        </p>
      </div>

      {submitClaim.error ? (
        <p className="mt-3 text-sm text-negative-600">{errorMessage(submitClaim.error)}</p>
      ) : null}

      <EotTable
        claims={filtered}
        totalCount={claims.length}
        isPending={isPending}
        canManage={canManage}
        namesById={namesById}
        onEdit={(claim) => {
          setEditTarget(claim);
          updateClaim.reset();
          setUpsertOpen(true);
        }}
        onSubmit={(claim) => {
          submitClaim.reset();
          submitClaim.mutate({ projectId: typedProject.id, claimId: claim.id });
        }}
        onDecide={(claim) => {
          decideClaim.reset();
          setDecideTarget(claim);
        }}
      />

      <UpsertEotClaimDialog
        open={upsertOpen}
        onOpenChange={(next) => {
          if (!next) closeUpsert();
          else setUpsertOpen(true);
        }}
        initial={editTarget}
        delays={delays}
        isSubmitting={createClaim.isPending || updateClaim.isPending}
        error={
          createClaim.error || updateClaim.error
            ? errorMessage(createClaim.error ?? updateClaim.error)
            : null
        }
        onSubmit={handleUpsert}
      />

      <DecideEotDialog
        open={decideTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDecideTarget(null);
        }}
        claim={decideTarget}
        isSubmitting={decideClaim.isPending}
        error={decideClaim.error ? errorMessage(decideClaim.error) : null}
        onSubmit={(values) => {
          if (!decideTarget) return;
          decideClaim.mutate(
            { projectId: typedProject.id, claimId: decideTarget.id, ...values },
            { onSuccess: () => setDecideTarget(null) },
          );
        }}
      />
    </div>
  );
}
