import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { CreateButton } from "@/components/molecules/create-button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { ChevronRightIcon } from "@/components/atoms/project-nav-icons";
import { SearchInput } from "@/components/atoms/search-input";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { ReasonDialog } from "@/components/molecules/reason-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useCreateEquipmentRequest,
  useDeleteEquipmentRequest,
  useEquipmentRequests,
  useExtendHire,
  useUpdateEquipmentRequest,
  type EquipmentRequestInput,
} from "@/hooks/use-materials-equipment";
import { errorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import type { EquipmentBucket, EquipmentRequest, EquipmentRequestStatus } from "@/lib/project-types";
import { canResourceAction } from "@/lib/project-types";
import { EquipmentRequestDialog } from "./equipment-requests/equipment-request-dialog";
import { EquipmentRequestsTable } from "./equipment-requests/equipment-requests-table";
import { ExtendHireDialog } from "./equipment-requests/extend-hire-dialog";
import { ReturnHireDialog } from "./equipment-requests/return-hire-dialog";
import {
  DEFAULT_EQUIPMENT_BUCKET,
  EQUIPMENT_BUCKETS,
  EQUIPMENT_BUCKET_TABS,
  matchesEquipmentSearch,
} from "./equipment-requests/equipment-helpers";

type HireDialog =
  | { kind: "create" }
  | { kind: "edit"; request: EquipmentRequest }
  | { kind: "delete"; request: EquipmentRequest }
  | { kind: "cancel"; request: EquipmentRequest }
  | { kind: "extend"; request: EquipmentRequest }
  | { kind: "return"; request: EquipmentRequest }
  | null;

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
  const [dialog, setDialog] = useState<HireDialog>(null);

  const createRequest = useCreateEquipmentRequest();
  const updateRequest = useUpdateEquipmentRequest();
  const deleteRequest = useDeleteEquipmentRequest();
  const extendHire = useExtendHire();

  const visible = requests.filter((request) => matchesEquipmentSearch(request, search));
  const bookedCost = requests
    .filter((request) => request.status !== "Cancelled")
    .reduce((sum, request) => sum + request.estimatedCost, 0);
  const lateCount = requests.filter((request) => request.late).length;

  function close(): void {
    setDialog(null);
  }

  function upsert(values: EquipmentRequestInput): void {
    if (dialog?.kind === "edit") {
      updateRequest.mutate(
        { projectId: project.id, requestId: dialog.request.id, ...values },
        { onSuccess: close },
      );
      return;
    }
    createRequest.mutate({ projectId: project.id, ...values }, { onSuccess: close });
  }

  function advance(request: EquipmentRequest, status: EquipmentRequestStatus): void {
    updateRequest.mutate(
      { projectId: project.id, requestId: request.id, status },
      { onError: (error) => toast(errorMessage(error)) },
    );
  }

  const isUpsert = dialog?.kind === "create" || dialog?.kind === "edit";
  const upsertError = dialog?.kind === "edit" ? updateRequest.error : createRequest.error;

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
              <CreateButton onClick={() => setDialog({ kind: "create" })}>
                New equipment request
       </CreateButton>
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
          helper="Recorded hire spend, cancelled hires excluded"
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
            placeholder="Search by equipment, plant ref or supplier"
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
        onAdd={() => setDialog({ kind: "create" })}
        onClearFilters={() => setSearch("")}
        onEdit={(request) => setDialog({ kind: "edit", request })}
        onDelete={(request) => setDialog({ kind: "delete", request })}
        onCancel={(request) => setDialog({ kind: "cancel", request })}
        onExtend={(request) => setDialog({ kind: "extend", request })}
        onReturn={(request) => setDialog({ kind: "return", request })}
        onAdvance={advance}
      />

      <EquipmentRequestDialog
        open={isUpsert}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        projectId={project.id}
        initial={dialog?.kind === "edit" ? dialog.request : null}
        onSubmit={upsert}
        isSubmitting={createRequest.isPending || updateRequest.isPending}
        error={upsertError ? errorMessage(upsertError) : null}
        currency={project.currency}
      />

      {dialog?.kind === "extend" ? (
        <ExtendHireDialog
          open
          onOpenChange={(open) => {
            if (!open) close();
          }}
          request={dialog.request}
          isSubmitting={extendHire.isPending}
          error={extendHire.error ? errorMessage(extendHire.error) : null}
          onSubmit={({ offHireAt, reason }) =>
            extendHire.mutate(
              { projectId: project.id, requestId: dialog.request.id, offHireAt, reason },
              {
                onSuccess: () => {
                  close();
                  toast("Hire extended — the original period is kept.", "success");
                },
              },
            )
          }
        />
      ) : null}

      {dialog?.kind === "return" ? (
        <ReturnHireDialog
          open
          onOpenChange={(open) => {
            if (!open) close();
          }}
          request={dialog.request}
          isSubmitting={updateRequest.isPending}
          error={updateRequest.error ? errorMessage(updateRequest.error) : null}
          onSubmit={({ offHireAt, notes }) =>
            updateRequest.mutate(
              {
                projectId: project.id,
                requestId: dialog.request.id,
                status: "Returned",
                offHireAt,
                ...(notes ? { notes } : {}),
              },
              {
                onSuccess: () => {
                  close();
                  toast("Plant returned — hire closed at that date.", "success");
                },
              },
            )
          }
        />
      ) : null}

      {dialog?.kind === "cancel" ? (
        <ReasonDialog
          open
          onOpenChange={(open) => {
            if (!open) close();
          }}
          title="Cancel this hire?"
          description="The hire order stays on file as cancelled with your reason, and the reason shows on the row."
          label="Why is it being cancelled?"
          placeholder="Plant no longer needed, supplier could not mobilise, duplicate booking…"
          submitLabel="Cancel hire"
          isSubmitting={updateRequest.isPending}
          error={updateRequest.error ? errorMessage(updateRequest.error) : null}
          onSubmit={(reason) =>
            updateRequest.mutate(
              {
                projectId: project.id,
                requestId: dialog.request.id,
                status: "Cancelled",
                reason,
              },
              {
                onSuccess: () => {
                  close();
                  toast("Hire cancelled", "success");
                },
              },
            )
          }
        />
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title="Delete this draft?"
        description="Only a draft can be deleted. Anything further along is cancelled with a reason so the hire order survives."
        variant="danger"
        confirmLabel="Delete"
        loading={deleteRequest.isPending}
        onConfirm={() => {
          if (dialog?.kind !== "delete") return;
          deleteRequest.mutate(
            { projectId: project.id, requestId: dialog.request.id },
            { onSuccess: close, onError: (error) => toast(errorMessage(error)) },
          );
        }}
      />
    </div>
  );
}
