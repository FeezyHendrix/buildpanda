import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useUrlState } from "@/hooks/use-url-state";
import { QueryError } from "@/components/molecules/query-error";
import { UnavailableRecord } from "@/components/molecules/unavailable-record";
import { Button } from "@/components/atoms/button";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { SearchInput } from "@/components/atoms/search-input";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { PageHeader } from "@/components/molecules/page-header";
import { CancelInspectionDialog } from "@/components/molecules/cancel-inspection-dialog";
import { InspectionOutcomeDialog } from "@/components/molecules/inspection-outcome-dialog";
import { RequestInspectionDialog } from "@/components/molecules/request-inspection-dialog";
import { UpsertInspectionDialog } from "@/components/molecules/upsert-inspection-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useSession } from "@/stores/auth";
import { useProjectActivities } from "@/hooks/use-activities";
import { useParticipants } from "@/hooks/use-participants";
import {
  useCancelInspection,
  useEditInspection,
  useMarkInspectionAttended,
  useProjectInspections,
  useRequestInspection,
} from "@/hooks/use-inspections";
import { errorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { canResourceAction, type InspectionReport } from "@/lib/project-types";
import { InspectionDetailDrawer } from "./inspections/inspection-detail-drawer";
import { InspectionsTable } from "./inspections/inspections-table";
import {
  canCancelInspection,
  isAssignedInspector,
  matchesInspectionSearch,
  SERVICE_STATUS_TABS,
  type ServiceStatusFilter,
} from "./inspections/inspection-helpers";

const EMPTY_LIST: never[] = [];
const STATUS_FILTERS = SERVICE_STATUS_TABS.map(tab => tab.value);

/**
 * The inspection register. An inspection here is a client-facing service order:
 * the client requests it, BuildPanda assigns an inspector who attends and
 * issues the report, and the contractor is the subject of that report. Nothing
 * on this page lets the party being inspected record its own result.
 */
export default function ProjectInspections() {
  const { project, access } = useProjectContext();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const isPlatformAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  const canRequest = Boolean(access && canResourceAction(access, "inspections", "request"));
  const canManage = Boolean(access && canResourceAction(access, "inspections", "manage"));
  // Only a workspace admin may extend the category list; the API refuses others.
  const canAddCategory = access?.orgRole === "owner" || access?.orgRole === "admin";

  const { data: inspections = EMPTY_LIST, isPending, isFetching, error, refetch } = useProjectInspections(project.id);
  const { data: activities = EMPTY_LIST } = useProjectActivities(project.id);
  const { data: participants = EMPTY_LIST } = useParticipants(
    project.id,
    Boolean(access?.capabilities.canManageParticipants),
  );

  const [, setSearchParams] = useSearchParams();
  const [search, setSearch] = useUrlState<string>("q", "");
  const [statusFilter, setStatusFilter] = useUrlState<ServiceStatusFilter>("status", "all", STATUS_FILTERS);
  const [requestView, setRequestView] = useUrlState<string | null>("request", null);
  const [detailId, setDetailId] = useUrlState<string | null>("inspection", null);
  const [editId, setEditId] = useUrlState<string | null>("edit", null);
  const requestOpen = requestView === "new" && canRequest;
  const editTarget = inspections.find(report => report.id === editId) ?? null;
  const setRequestOpen = (open: boolean) => setRequestView(open ? "new" : null);
  const setDetailTarget = (report: InspectionReport | null) => setDetailId(report?.id ?? null);
  const setEditTarget = (report: InspectionReport | null) => setEditId(report?.id ?? null);
  const [cancelTarget, setCancelTarget] = useState<InspectionReport | null>(null);
  const [outcomeTarget, setOutcomeTarget] = useState<InspectionReport | null>(null);
  const [attendTarget, setAttendTarget] = useState<InspectionReport | null>(null);

  const requestInspection = useRequestInspection();
  const editInspection = useEditInspection();
  const cancelInspection = useCancelInspection();
  const markAttended = useMarkInspectionAttended();

  const activityById = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);
  const activityNames = useMemo(
    () => new Map(activities.map((a) => [a.id, a.name])),
    [activities],
  );
  const nameByUserId = useMemo(
    () =>
      new Map(
        participants
          .filter((p) => p.userId !== null)
          .map((p) => [p.userId as string, p.name ?? p.email]),
      ),
    [participants],
  );

  const filtered = inspections
    .filter((report) => statusFilter === "all" || report.serviceStatus === statusFilter)
    .filter((report) => matchesInspectionSearch(report, search));

  // The record in the drawer must follow the cache, not the click that opened it.
  const detail = inspections.find(report => report.id === detailId) ?? null;

  /** Planned but never started: inspecting it is a wasted trip (finding F44). */
  function notStarted(report: InspectionReport | null): boolean {
    if (!report?.activityId) return false;
    const activity = activityById.get(report.activityId);
    return Boolean(activity && activity.status === "Planned" && !activity.actualStartAt);
  }

  function requesterName(report: InspectionReport): string | null {
    if (!report.requestedById) return null;
    if (report.requestedById === userId) return "You";
    return nameByUserId.get(report.requestedById) ?? null;
  }

  function clearFilters(): void {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete("q");
      next.delete("status");
      return next;
    }, { replace: true });
  }

  return (
    <div className="w-full px-4 pt-4 pb-8 sm:px-10 lg:px-6">
      <PageHeader
        title="Inspections & hold points"
        actions={
          canRequest ? (
            <Button variant="primary" size="md" onClick={() => setRequestOpen(true)}>
              <PlusIcon className="size-4" />
              Request an inspection
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 rounded-lg border border-line-hair bg-white sm:max-w-xs">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, contractor or chainage"
            aria-label="Search inspections"
          />
        </div>
        <FilterTabs
          items={SERVICE_STATUS_TABS}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filter by service status"
        />
        {!isPending && !error ? <p className="ml-auto text-sm text-ink-muted">
          {filtered.length} of {inspections.length} inspections
        </p> : null}
      </div>

      {error ? <QueryError error={error} retry={refetch} noun="inspections" /> : null}
      {!error && !isFetching && !isPending && ((detailId && !detail) || (editId && !editTarget)) ? (
        <UnavailableRecord name="Inspection" returnLabel="Return to inspections" onReturn={() => {
          setSearchParams(previous => {
            const next = new URLSearchParams(previous);
            next.delete("inspection");
            next.delete("edit");
            return next;
          }, { replace: true });
        }} />
      ) : null}
      {!error || inspections.length > 0 ? <InspectionsTable
        inspections={filtered}
        totalCount={inspections.length}
        isPending={isPending}
        activityNames={activityNames}
        onOpen={setDetailTarget}
        onClearFilters={clearFilters}
        onRequest={canRequest ? () => setRequestOpen(true) : undefined}
      /> : null}

      <RequestInspectionDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        projectId={project.id}
        currency={project.currency}
        canAddCategory={canAddCategory}
        error={requestInspection.error ? errorMessage(requestInspection.error) : null}
        onSubmit={async (input) => {
          const report = await requestInspection.mutateAsync({ projectId: project.id, ...input });
          setSearchParams(previous => {
            const next = new URLSearchParams(previous);
            next.delete("request");
            next.set("inspection", report.id);
            return next;
          }, { replace: true });
          toast("Inspection requested — BuildPanda will assign an inspector", "success");
        }}
      />

      <InspectionDetailDrawer
        open={detail !== null && !editId && !cancelTarget && !outcomeTarget}
        report={detail}
        activityName={detail?.activityId ? (activityNames.get(detail.activityId) ?? null) : null}
        activityNotStarted={notStarted(detail)}
        requestedByName={detail ? requesterName(detail) : null}
        isInspector={Boolean(detail && isAssignedInspector(detail, userId, isPlatformAdmin))}
        canEdit={canManage}
        canCancel={Boolean(detail && canCancelInspection(detail, userId, isPlatformAdmin))}
        attending={markAttended.isPending}
        onOpenChange={(next) => {
          if (!next) setDetailTarget(null);
        }}
        onEdit={() => setEditTarget(detail)}
        onCancel={() => setCancelTarget(detail)}
        onMarkAttended={() => setAttendTarget(detail)}
        onRecordOutcome={() => setOutcomeTarget(detail)}
      />

      <UpsertInspectionDialog
        open={editTarget !== null && canManage}
        inspectionId={editId ?? ""}
        onOpenChange={(next) => {
          if (!next) setEditTarget(null);
        }}
        mode="edit"
        projectId={project.id}
        currency={project.currency}
        canAddCategory={canAddCategory}
        initial={
          editTarget
            ? {
                title: editTarget.title,
                category: editTarget.category,
                description: editTarget.description,
                scheduledAt: editTarget.scheduledAt.slice(0, 10),
                activityId: editTarget.activityId,
                location: editTarget.location,
                holdPoint: editTarget.holdPoint,
                contractorName: editTarget.contractorName,
                feeAmount: editTarget.feeAmount,
                feeCurrency: editTarget.feeCurrency,
              }
            : undefined
        }
        error={editInspection.error ? errorMessage(editInspection.error) : null}
        onSubmit={async (values) => {
          if (!editTarget) return;
          await editInspection.mutateAsync({ projectId: project.id, inspectionId: editTarget.id, ...values });
          setEditTarget(null);
          toast("Inspection updated", "success");
        }}
      />

      <CancelInspectionDialog
        open={cancelTarget !== null}
        onOpenChange={(next) => {
          if (!next) setCancelTarget(null);
        }}
        inspectionTitle={cancelTarget?.title ?? ""}
        isSubmitting={cancelInspection.isPending}
        error={cancelInspection.error ? errorMessage(cancelInspection.error) : null}
        onSubmit={(reason) => {
          if (!cancelTarget) return;
          cancelInspection.mutate(
            { projectId: project.id, inspectionId: cancelTarget.id, reason },
            {
              onSuccess: () => {
                setCancelTarget(null);
                setDetailTarget(null);
                toast("Inspection cancelled", "success");
              },
            },
          );
        }}
      />

      <ConfirmDialog
        open={attendTarget !== null}
        onOpenChange={(next) => {
          if (!next) setAttendTarget(null);
        }}
        loading={markAttended.isPending}
        title="Mark attended"
        description="Confirm you attended site for this inspection. The report is issued separately, when you record the outcome."
        confirmLabel="I attended"
        onConfirm={() => {
          if (!attendTarget) return;
          markAttended.mutate(
            { projectId: project.id, inspectionId: attendTarget.id },
            {
              onSuccess: () => {
                setAttendTarget(null);
                toast("Attendance recorded", "success");
              },
              onError: (error) => {
                setAttendTarget(null);
                toast(errorMessage(error), "error");
              },
            },
          );
        }}
      />

      <InspectionOutcomeDialog
        open={outcomeTarget !== null}
        onOpenChange={(next) => {
          if (!next) setOutcomeTarget(null);
        }}
        projectId={project.id}
        inspection={outcomeTarget}
      />
    </div>
  );
}
