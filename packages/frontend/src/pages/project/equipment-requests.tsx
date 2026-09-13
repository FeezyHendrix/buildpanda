import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { ChevronRightIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { SearchInput } from "@/components/atoms/search-input";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateEquipmentRequest,
  useDeleteEquipmentRequest,
  useEquipmentRequests,
  useUpdateEquipmentRequest,
  type EquipmentRequestInput,
} from "@/hooks/use-materials-equipment";
import { formatCurrency } from "@/lib/formatters";
import type { EquipmentBucket, EquipmentRequest } from "@/lib/project-types";
import { canResourceAction } from "@/lib/project-types";
import { EquipmentRequestDialog } from "./equipment-requests/equipment-request-dialog";
import { EquipmentRequestsTable } from "./equipment-requests/equipment-requests-table";
import {
  DEFAULT_EQUIPMENT_BUCKET,
  EQUIPMENT_BUCKETS,
  EQUIPMENT_BUCKET_TABS,
  matchesEquipmentSearch,
} from "./equipment-requests/equipment-helpers";

/**
 * Plant hire register. The stage tabs are the server-side bucket the list has
 * always been fetched by (they live in the route), so switching one refetches;
 * the search runs over the loaded page in the client.
 */
export default function ProjectEquipmentRequests() {
  const { project, access } = useProjectContext();
  const canRequest = canResourceAction(access, "materials", "request");
  const canApprove = canResourceAction(access, "materials", "approve");
  const params = useParams<{ bucket?: EquipmentBucket }>();
  const navigate = useNavigate();
  const activeBucket: EquipmentBucket = EQUIPMENT_BUCKETS.some(
    (item) => item.bucket === params.bucket,
  )
    ? (params.bucket as EquipmentBucket)
    : "requests";
  const activeMeta =
    EQUIPMENT_BUCKETS.find((item) => item.bucket === activeBucket) ?? DEFAULT_EQUIPMENT_BUCKET;

  const { data: requests = [], isLoading } = useEquipmentRequests(project.id, activeBucket);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EquipmentRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentRequest | null>(null);

  const createRequest = useCreateEquipmentRequest();
  const updateRequest = useUpdateEquipmentRequest();
  const deleteRequest = useDeleteEquipmentRequest();

  const visible = requests.filter((request) => matchesEquipmentSearch(request, search));
  const bookedCost = requests.reduce((sum, request) => sum + request.estimatedCost, 0);
  const lateCount = requests.filter((request) => request.late).length;

  function upsert(values: EquipmentRequestInput): void {
    if (editTarget) {
      updateRequest.mutate(
        { projectId: project.id, requestId: editTarget.id, ...values },
        { onSuccess: () => setEditTarget(null) },
      );
      return;
    }
    createRequest.mutate(
      { projectId: project.id, ...values },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <PageHeader
        title="Equipment requests"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate(`/project/${project.id}/materials`)}
            >
              Materials
              <ChevronRightIcon className="size-4" />
            </Button>
            {canRequest ? (
              <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
                <PlusIcon className="size-4" />
                New equipment request
              </Button>
            ) : null}
          </div>
        }
      />

      <section aria-label="Hire summary" className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Visible requests"
          value={requests.length.toString()}
          helper={activeMeta.helper}
        />
        <KpiCard
          label="Booked cost"
          value={formatCurrency(bookedCost, project.currency, { compact: true })}
          helper="Estimated hire spend recorded on this stage"
        />
        <KpiCard
          label="Late"
          value={lateCount.toString()}
          tone={lateCount > 0 ? "danger" : "default"}
          helper="Wanted on site before today, not yet on hire"
        />
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs rounded-lg border border-line-hair bg-white">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by equipment or supplier"
            aria-label="Search equipment requests"
          />
        </div>
        <FilterTabs
          items={EQUIPMENT_BUCKET_TABS}
          value={activeBucket}
          onChange={(bucket) => navigate(`/project/${project.id}/equipment-requests/${bucket}`)}
          ariaLabel="Equipment request stages"
        />
        <p className="ml-auto text-sm text-ink-muted">
          {visible.length} of {requests.length} request{requests.length === 1 ? "" : "s"}
        </p>
      </div>

      <EquipmentRequestsTable
        requests={visible}
        isPending={isLoading}
        isFiltered={search.trim().length > 0}
        canRequest={canRequest}
        canApprove={canApprove}
        onAdd={() => setCreateOpen(true)}
        onClearFilters={() => setSearch("")}
        onEdit={setEditTarget}
        onDelete={setDeleteTarget}
        onAdvance={(request, status) =>
          updateRequest.mutate({ projectId: project.id, requestId: request.id, status })
        }
      />

      <EquipmentRequestDialog
        open={createOpen || editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditTarget(null);
          }
        }}
        initial={editTarget}
        onSubmit={upsert}
        isSubmitting={createRequest.isPending || updateRequest.isPending}
        error={((createRequest.error ?? updateRequest.error) as Error | null)?.message ?? null}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete equipment request?"
        description="This removes the rental request from the equipment lifecycle board."
        variant="danger"
        confirmLabel="Delete"
        loading={deleteRequest.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteRequest.mutate(
            { projectId: project.id, requestId: deleteTarget.id },
            { onSuccess: () => setDeleteTarget(null) },
          );
        }}
      />
    </div>
  );
}
